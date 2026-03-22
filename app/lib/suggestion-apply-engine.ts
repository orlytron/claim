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

function findIndex(claim: ClaimItem[], room: string, matchDescription: string): number {
  const m = norm(matchDescription);
  return claim.findIndex((i) => i.room === room && norm(i.description) === m);
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
      i.room === p.room &&
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

export function suggestionDeltaForClaim(claim: ClaimItem[], room: string, s: SuggestedUpgrade): number {
  const applied = applyOneSuggestionImmutable(claim, room, s);
  if (!applied) return 0;
  return Math.round((claimSum(applied) - claimSum(claim)) * 100) / 100;
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
