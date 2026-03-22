import { ORIGINAL_CLAIM_ITEMS } from "./original-claim-data";
import type { ClaimItem } from "./types";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Same line identity as room review row operations. */
export function sameSuggestionLine(a: ClaimItem, b: ClaimItem): boolean {
  return (
    a.room === b.room &&
    a.description === b.description &&
    Math.abs(a.unit_cost - b.unit_cost) < 0.01 &&
    a.qty === b.qty
  );
}

function revertSplit(claim: ClaimItem[], item: ClaimItem): ClaimItem[] | null {
  const rev = item.suggestion_revert;
  if (rev?.kind !== "split_part") return null;
  const p = rev.partner;
  const idxSelf = claim.findIndex((c) => sameSuggestionLine(c, item));
  const idxPartner = claim.findIndex(
    (c) =>
      c.room === item.room &&
      norm(c.description) === norm(p.description) &&
      Math.abs(c.unit_cost - p.unit_cost) < 0.01 &&
      c.qty === p.qty
  );
  if (idxSelf < 0 || idxPartner < 0 || idxSelf === idxPartner) return null;
  const orig = JSON.parse(JSON.stringify(rev.original)) as ClaimItem;
  delete orig.suggestion_revert;
  const next = claim.filter((_, i) => i !== idxSelf && i !== idxPartner);
  const insertAt = Math.min(idxSelf, idxPartner);
  next.splice(insertAt, 0, orig);
  return next;
}

/** Revert a single line that carries `suggestion_revert` (not REMOVE). */
export function applySuggestionRevert(claim: ClaimItem[], item: ClaimItem): ClaimItem[] | null {
  const rev = item.suggestion_revert;
  if (!rev) return null;

  if (rev.kind === "split_part") {
    return revertSplit(claim, item);
  }

  const idx = claim.findIndex((c) => sameSuggestionLine(c, item));
  if (idx < 0) return null;
  const cur = claim[idx]!;
  const next = [...claim];

  switch (rev.kind) {
    case "rename":
      next[idx] = { ...cur, description: rev.prevDescription, suggestion_revert: undefined };
      return next;
    case "price":
      next[idx] = {
        ...cur,
        unit_cost: rev.prevUnitCost,
        qty: rev.prevQty !== undefined ? rev.prevQty : cur.qty,
        description: rev.prevDescription !== undefined ? rev.prevDescription : cur.description,
        suggestion_revert: undefined,
      };
      return next;
    case "qty":
      next[idx] = {
        ...cur,
        qty: rev.prevQty,
        unit_cost: rev.prevUnitCost !== undefined ? rev.prevUnitCost : cur.unit_cost,
        suggestion_revert: undefined,
      };
      return next;
    case "move":
      next[idx] = { ...cur, room: rev.prevRoom, suggestion_revert: undefined };
      return next;
    case "add":
      return claim.filter((c) => !sameSuggestionLine(c, item));
    default:
      return null;
  }
}

/** Restore a line removed by scripted REMOVE suggestion (from original seed data). */
export function restoreRemovedOriginalLine(claim: ClaimItem[], room: string, matchDescription: string): ClaimItem[] | null {
  const m = norm(matchDescription);
  if (claim.some((i) => i.room === room && norm(i.description) === m)) return null;
  const orig = ORIGINAL_CLAIM_ITEMS.find((i) => i.room === room && norm(i.description) === m);
  if (!orig) return null;
  const line: ClaimItem = {
    room: orig.room,
    description: orig.description,
    brand: orig.brand,
    model: orig.model,
    qty: orig.qty,
    age_years: orig.age_years,
    age_months: orig.age_months,
    condition: orig.condition,
    unit_cost: orig.unit_cost,
    category: orig.category,
    source: "original",
  };
  return [...claim, line];
}
