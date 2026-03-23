/**
 * Complete ★ tier value & line detection — aligned with FocusedAdditionCard tier logic.
 */
import type { Bundle, BundleItem, BundleTiers3, BundleTiers5, BundleTiersDef } from "./bundles-data";
import { isBundleTiers5 } from "./bundles-data";
import type { ClaimItem } from "./types";

function lineTotal(i: BundleItem): number {
  return i.total ?? i.unit_cost * i.qty;
}

function ensureTotals(items: BundleItem[]): BundleItem[] {
  return items.map((i) => ({ ...i, total: lineTotal(i) }));
}

function autoGenerateTiers3(bundle: Bundle): BundleTiers3 {
  const items = ensureTotals([...bundle.items]).sort((a, b) => b.unit_cost - a.unit_cost);
  const n = items.length;
  const third = Math.ceil(n / 3);
  const essentialItems = items.slice(n - third);
  const middleStart = Math.max(0, n - third * 2);
  const middleEnd = n - third;
  const completeItems = items.slice(middleStart, middleEnd);
  const fullItems = items.slice(0, middleStart);
  const sum = (arr: BundleItem[]) => arr.reduce((s, i) => s + lineTotal(i), 0);
  return {
    essential: { total: sum(essentialItems), items: essentialItems },
    complete: { total: sum(completeItems), items: completeItems },
    full: { total: sum(fullItems), items: fullItems },
  };
}

function autoGenerateTiers5(bundle: Bundle): BundleTiers5 {
  const items = ensureTotals([...bundle.items]).sort((a, b) => b.unit_cost - a.unit_cost);
  const n = items.length;
  const fifth = Math.max(1, Math.ceil(n / 5));
  const b0 = items.slice(0, Math.min(n, fifth));
  const b1 = items.slice(Math.min(n, fifth), Math.min(n, fifth * 2));
  const b2 = items.slice(Math.min(n, fifth * 2), Math.min(n, fifth * 3));
  const b3 = items.slice(Math.min(n, fifth * 3), Math.min(n, fifth * 4));
  const b4 = items.slice(Math.min(n, fifth * 4), n);
  const sum = (arr: BundleItem[]) => arr.reduce((s, i) => s + lineTotal(i), 0);
  return {
    essential: { total: sum(b0), items: b0 },
    enhanced: { total: sum(b1), items: b1 },
    complete: { total: sum(b2), items: b2 },
    full: { total: sum(b3), items: b3 },
    ultimate: { total: sum(b4), items: b4 },
  };
}

function effectiveTiersDef(bundle: Bundle): BundleTiersDef {
  if (bundle.tiers) return bundle.tiers;
  if (bundle.items.length === 0) {
    return {
      essential: { total: 0, items: [] },
      complete: { total: 0, items: [] },
      full: { total: 0, items: [] },
    };
  }
  return bundle.items.length >= 8 ? autoGenerateTiers5(bundle) : autoGenerateTiers3(bundle);
}

function tierBlocksList(t: BundleTiersDef, isExplicit: boolean): BundleItem[][] {
  if (isBundleTiers5(t)) {
    return [
      t.essential.items,
      t.enhanced.items,
      t.complete.items,
      t.full.items,
      t.ultimate.items,
    ];
  }
  if (isExplicit) {
    return [
      t.essential.items,
      (t as BundleTiers3).complete.items,
      (t as BundleTiers3).full.items,
    ];
  }
  return [t.essential.items, (t as BundleTiers3).complete.items, (t as BundleTiers3).full.items];
}

function cumulativeTotals(blocks: BundleItem[][]): number[] {
  const out: number[] = [];
  let s = 0;
  for (const b of blocks) {
    s += b.reduce((a, i) => a + lineTotal(i), 0);
    out.push(Math.round(s * 100) / 100);
  }
  return out;
}

function normDesc(d: string): string {
  return d.trim().toLowerCase();
}

/** Dollar total shown at Complete ★ in FocusedAdditionCard. */
export function getCompleteTierDollarTotal(bundle: Bundle): number {
  const tiersDef = effectiveTiersDef(bundle);
  const five = isBundleTiers5(tiersDef);
  const isExplicit = Boolean(bundle.tiers);
  const blocks = tierBlocksList(tiersDef, isExplicit);
  const completeIdx = five ? 2 : 1;
  const cumulativeFive = Boolean(bundle.tiersCumulative && five);
  if (cumulativeFive && isBundleTiers5(tiersDef)) {
    return tiersDef.complete.total;
  }
  if (isExplicit && !five) {
    return (tiersDef as BundleTiers3).complete.total;
  }
  const totals = cumulativeTotals(blocks);
  return totals[completeIdx] ?? 0;
}

/** Line descriptions that belong to the Complete tier selection (for in-claim detection). */
export function getCompleteTierLineDescriptions(bundle: Bundle): string[] {
  const tiersDef = effectiveTiersDef(bundle);
  const five = isBundleTiers5(tiersDef);
  const isExplicit = Boolean(bundle.tiers);
  const blocks = tierBlocksList(tiersDef, isExplicit);
  const completeIdx = five ? 2 : 1;
  const cumulativeFive = Boolean(bundle.tiersCumulative && five);
  if (cumulativeFive) {
    return (blocks[completeIdx] ?? []).map((i) => i.description);
  }
  if (isExplicit && !five) {
    return (blocks[completeIdx] ?? []).map((i) => i.description);
  }
  const out: string[] = [];
  for (let b = 0; b <= completeIdx; b++) {
    for (const row of blocks[b] ?? []) {
      out.push(row.description);
    }
  }
  return out;
}

export function isCompleteTierLikelyInClaim(bundle: Bundle, roomName: string, claimItems: ClaimItem[]): boolean {
  const descs = getCompleteTierLineDescriptions(bundle);
  if (descs.length === 0) return false;
  const rr = roomName.trim().toLowerCase();
  const roomLines = claimItems.filter(
    (i) => i.room.trim().toLowerCase() === rr && (i.source ?? "original") === "bundle"
  );
  const claimed = new Set(roomLines.map((i) => normDesc(i.description)));
  return descs.every((d) => claimed.has(normDesc(d)));
}

export function sumPendingCompleteTierFocusedBundles(
  roomName: string,
  claimItems: ClaimItem[],
  bundles: Bundle[]
): number {
  let s = 0;
  for (const b of bundles) {
    if (isCompleteTierLikelyInClaim(b, roomName, claimItems)) continue;
    s += getCompleteTierDollarTotal(b);
  }
  return Math.round(s * 100) / 100;
}
