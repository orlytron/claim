/**
 * Apply scripted suggestion upgrades to a claim (immutable helpers for client + script).
 */
import type { ClaimItem } from "./types";
import type { SuggestedAddItem, SuggestedSplitPart, SuggestedUpgrade } from "./suggested-upgrades";

export function norm(s: string): string {
  return s.trim().toLowerCase();
}

function stripRevert(i: ClaimItem): ClaimItem {
  const { suggestion_revert: _r, ...rest } = i;
  return { ...rest };
}

function normRoom(r: string): string {
  return norm(r);
}

function findIndex(claim: ClaimItem[], room: string, matchDescription: string): number {
  const m = norm(matchDescription);
  const rr = normRoom(room);
  return claim.findIndex((i) => normRoom(i.room) === rr && norm(i.description) === m);
}

/** Case-insensitive description + room match (trim / casefold). */
export function findClaimLineInRoom(
  claim: ClaimItem[],
  room: string,
  matchDescription: string
): ClaimItem | undefined {
  const m = norm(matchDescription);
  const rr = normRoom(room);
  return claim.find((i) => normRoom(i.room) === rr && norm(i.description) === m);
}

function addItemFromSuggestion(p: SuggestedAddItem): ClaimItem {
  return {
    room: p.room,
    description: p.description,
    brand: p.brand ?? "",
    model: "",
    qty: p.qty,
    age_years: p.age_years,
    age_months: 0,
    condition: p.condition,
    unit_cost: p.unit_cost,
    category: p.category,
    source: "suggestion",
    suggestion_revert: { kind: "add" },
  };
}

function mergeSplitPart(orig: ClaimItem, part: SuggestedSplitPart, partner: SuggestedSplitPart): ClaimItem {
  return {
    ...orig,
    description: part.description,
    brand: part.brand ?? orig.brand,
    unit_cost: part.unit_cost,
    qty: part.qty,
    suggestion_revert: {
      kind: "split_part",
      original: JSON.parse(JSON.stringify(stripRevert(orig))) as ClaimItem,
      partner: {
        description: partner.description,
        unit_cost: partner.unit_cost,
        qty: partner.qty,
      },
    },
  };
}

function addAlreadyPresent(claim: ClaimItem[], p: SuggestedAddItem): boolean {
  return claim.some(
    (i) =>
      normRoom(i.room) === normRoom(p.room) &&
      norm(i.description) === norm(p.description) &&
      Math.abs(i.unit_cost - p.unit_cost) < 0.01 &&
      i.qty === p.qty
  );
}

function claimSum(claim: ClaimItem[]): number {
  return claim.reduce((s, i) => s + i.qty * i.unit_cost, 0);
}

/** @returns null if no-op (skipped), else new claim snapshot */
export function applyOneSuggestionImmutable(
  claim: ClaimItem[],
  room: string,
  s: SuggestedUpgrade
): ClaimItem[] | null {
  const next = JSON.parse(JSON.stringify(claim)) as ClaimItem[];
  const before = claimSum(next);

  switch (s.type) {
    case "RENAME": {
      const idx = findIndex(next, room, s.match_description);
      if (idx < 0) {
        if (findIndex(next, room, s.new_description) >= 0) return null;
        return null;
      }
      const cur = next[idx]!;
      next[idx] = {
        ...cur,
        description: s.new_description,
        suggestion_revert: { kind: "rename", prevDescription: cur.description },
      };
      break;
    }
    case "PRICE": {
      const idx = findIndex(next, room, s.match_description);
      if (idx < 0) return null;
      const cur = next[idx]!;
      const prevCost = cur.unit_cost;
      const prevQty = cur.qty;
      const prevDesc = cur.description;
      const row: ClaimItem = {
        ...cur,
        unit_cost: s.new_unit_cost,
        suggestion_revert: {
          kind: "price",
          prevUnitCost: prevCost,
          prevQty: s.new_qty !== undefined ? prevQty : undefined,
          prevDescription: s.new_description !== undefined ? prevDesc : undefined,
        },
      };
      if (s.new_description !== undefined) row.description = s.new_description;
      if (s.new_qty !== undefined) row.qty = s.new_qty;
      next[idx] = row;
      break;
    }
    case "QTY": {
      const idx = findIndex(next, room, s.match_description);
      if (idx < 0) return null;
      const cur = next[idx]!;
      next[idx] = {
        ...cur,
        qty: s.new_qty,
        unit_cost: s.new_unit_cost !== undefined ? s.new_unit_cost : cur.unit_cost,
        suggestion_revert: {
          kind: "qty",
          prevQty: cur.qty,
          prevUnitCost: s.new_unit_cost !== undefined ? cur.unit_cost : undefined,
        },
      };
      break;
    }
    case "MOVE": {
      const idx = findIndex(next, room, s.match_description);
      if (idx < 0) return null;
      const cur = next[idx]!;
      next[idx] = {
        ...cur,
        room: s.new_room,
        suggestion_revert: { kind: "move", prevRoom: cur.room },
      };
      break;
    }
    case "ADD": {
      if (addAlreadyPresent(next, s.item)) return null;
      next.push(addItemFromSuggestion(s.item));
      break;
    }
    case "REMOVE": {
      const idx = findIndex(next, room, s.match_description);
      if (idx < 0) return null;
      next.splice(idx, 1);
      break;
    }
    case "SPLIT": {
      const idx = findIndex(next, room, s.match_description);
      if (idx < 0) return null;
      const raw = next[idx]!;
      const orig = JSON.parse(JSON.stringify(stripRevert(raw))) as ClaimItem;
      const a = mergeSplitPart(orig, s.item_a, s.item_b);
      const b = mergeSplitPart(orig, s.item_b, s.item_a);
      next.splice(idx, 1, a, b);
      break;
    }
    default:
      return null;
  }

  const after = claimSum(next);
  if (Math.abs(after - before) < 0.001 && s.type !== "RENAME" && s.type !== "MOVE") {
    // RENAME/MOVE can keep same $ total
  }
  return next;
}

/**
 * Dollar delta for one suggestion. Pass the **full** claim so matches work across rooms
 * (MOVE / ADD / descriptions that may exist outside the current room).
 */
export function getSuggestionDelta(suggestion: SuggestedUpgrade, claimItems: ClaimItem[]): number {
  const findItem = (desc: string) =>
    claimItems.find((i) => i.description.toLowerCase().trim() === desc.toLowerCase().trim());

  switch (suggestion.type) {
    case "RENAME":
    case "MOVE":
      return 0;
    case "PRICE": {
      const orig = findItem(suggestion.match_description);
      if (!orig) return 0;
      const newCost = suggestion.new_unit_cost ?? orig.unit_cost;
      const newQty = suggestion.new_qty ?? orig.qty;
      return newQty * newCost - orig.qty * orig.unit_cost;
    }
    case "QTY": {
      const orig = findItem(suggestion.match_description);
      if (!orig) return 0;
      const newQty = suggestion.new_qty ?? orig.qty;
      const newCost = suggestion.new_unit_cost ?? orig.unit_cost;
      return newQty * newCost - orig.qty * orig.unit_cost;
    }
    case "ADD": {
      const addDesc = (suggestion.item?.description ?? "").toLowerCase().trim();
      const exists = claimItems.find(
        (i) => i.description.toLowerCase().trim() === addDesc
      );
      if (exists) return 0;
      return (suggestion.item?.unit_cost ?? 0) * (suggestion.item?.qty ?? 1);
    }
    case "SPLIT": {
      const orig = findItem(suggestion.match_description);
      if (!orig) return 0;
      const newTotal =
        suggestion.item_a.unit_cost * suggestion.item_a.qty +
        suggestion.item_b.unit_cost * suggestion.item_b.qty;
      return newTotal - orig.qty * orig.unit_cost;
    }
    case "REMOVE": {
      const orig = findItem(suggestion.match_description);
      if (!orig) return 0;
      return -(orig.unit_cost * orig.qty);
    }
    default:
      return 0;
  }
}

/** Dollar delta if applied — full claim + room name (filters by room). */
export function suggestionDeltaForClaim(claim: ClaimItem[], room: string, s: SuggestedUpgrade): number {
  const rr = normRoom(room);
  const roomItems = claim.filter((i) => normRoom(i.room) === rr);
  return Math.round(getSuggestionDelta(s, roomItems) * 100) / 100;
}

/** Sum of per-suggestion deltas for checked indices (matches banner/modal “Apply selected” total). */
export function suggestionSelectedDeltaSum(
  claim: ClaimItem[],
  room: string,
  list: SuggestedUpgrade[],
  checked: Set<number>,
  /** @deprecated Ignored; deltas always use full `claim` for cross-room matching. */
  _sessionItems?: ClaimItem[]
): number {
  void room;
  let t = 0;
  for (const i of [...checked].sort((a, b) => a - b)) {
    if (i < 0 || i >= list.length) continue;
    t += getSuggestionDelta(list[i]!, claim);
  }
  return Math.round(t * 100) / 100;
}

export function suggestionNonZeroDeltaIndices(
  claim: ClaimItem[],
  room: string,
  list: SuggestedUpgrade[],
  /** @deprecated Ignored; deltas always use full `claim`. */
  _sessionItems?: ClaimItem[]
): number[] {
  void room;
  return list.map((_, i) => i).filter((i) => getSuggestionDelta(list[i]!, claim) !== 0);
}

export function suggestionIsRenameOrMove(s: SuggestedUpgrade): boolean {
  return s.type === "RENAME" || s.type === "MOVE";
}

/** Collapsed preview: first 4 non-zero-delta indices. Expanded: full list order. */
export function suggestionCollapsedRowIndices(
  claim: ClaimItem[],
  room: string,
  list: SuggestedUpgrade[],
  sessionItems?: ClaimItem[]
): number[] {
  const nz = suggestionNonZeroDeltaIndices(claim, room, list, sessionItems);
  return nz.slice(0, 4);
}

export function suggestionCollapsedHiddenCount(
  claim: ClaimItem[],
  room: string,
  list: SuggestedUpgrade[],
  sessionItems?: ClaimItem[]
): number {
  const nz = suggestionNonZeroDeltaIndices(claim, room, list, sessionItems);
  const hiddenNz = Math.max(0, nz.length - 4);
  const renameMove = list.filter(suggestionIsRenameOrMove).length;
  return hiddenNz + renameMove;
}

export function applySuggestionIndices(
  claim: ClaimItem[],
  room: string,
  indices: number[],
  list: SuggestedUpgrade[]
): ClaimItem[] {
  const sorted = [...new Set(indices)].filter((i) => i >= 0 && i < list.length).sort((a, b) => a - b);
  let cur = claim;
  for (const i of sorted) {
    const nxt = applyOneSuggestionImmutable(cur, room, list[i]!);
    if (nxt) cur = nxt;
  }
  return cur;
}
