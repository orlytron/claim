import type { ClaimItem } from "./types";

export type MiscLine = Pick<ClaimItem, "description" | "qty" | "unit_cost">;

/** Category ceilings for miscellaneous (low-value) lines. */
export function getItemCeiling(description: string): { ceiling: number; maxQty: number } {
  const d = description.toLowerCase();
  if (d.includes("tea bowl") || d.includes("matcha bowl")) return { ceiling: 80, maxQty: 12 };
  if (d.includes("matcha") || d.includes("whisk")) return { ceiling: 80, maxQty: 6 };
  if (d.includes("candle")) return { ceiling: 65, maxQty: 8 };
  if (d.includes("vase")) return { ceiling: 200, maxQty: 5 };
  if (d.includes("pillow") || d.includes("cushion")) return { ceiling: 150, maxQty: 10 };
  if (d.includes("towel")) return { ceiling: 80, maxQty: 16 };
  if (d.includes("art book") || d.includes("coffee table book")) return { ceiling: 200, maxQty: 15 };
  if (d.includes("book")) return { ceiling: 120, maxQty: 20 };
  if (d.includes("frame") || d.includes("picture")) return { ceiling: 200, maxQty: 8 };
  if ((d.includes("glass") || d.includes("wine glass")) && !d.includes("sunglass"))
    return { ceiling: 80, maxQty: 16 };
  if (d.includes("plate") || d.includes("dish")) return { ceiling: 120, maxQty: 12 };
  if (d.includes("shirt") || d.includes("t-shirt") || d.includes("tshirt")) return { ceiling: 150, maxQty: 8 };
  if (d.includes("ball") || d.includes("puck")) return { ceiling: 80, maxQty: 4 };
  if (d.includes("ceramic") && !d.includes("tea")) return { ceiling: 200, maxQty: 6 };
  return { ceiling: 200, maxQty: 4 };
}

/**
 * sliderMultiplier: 1.0x … 3.0x (maps to sliderValue 0…1 inside).
 * Target total = originalTotal + (maxTotal - originalTotal) * sliderValue
 */
export function computeItemAtSlider(
  item: MiscLine,
  sliderMultiplier: number
): { qty: number; unit_cost: number } {
  const { ceiling, maxQty } = getItemCeiling(item.description);
  const origQty = Math.max(1, Math.min(maxQty, item.qty));
  const origUnit = item.unit_cost;
  const originalTotal = origQty * origUnit;
  const maxTotal = ceiling * maxQty;
  const m = Math.min(5, Math.max(1, sliderMultiplier));
  const sliderValue = (Math.min(3, m) - 1) / 2;
  const targetTotal = originalTotal + (maxTotal - originalTotal) * sliderValue;

  for (let qty = origQty; qty <= maxQty; qty++) {
    const price = targetTotal / qty;
    if (price <= ceiling) {
      return { qty, unit_cost: Math.round(price * 100) / 100 };
    }
    if (qty === maxQty) {
      return { qty: maxQty, unit_cost: ceiling };
    }
  }
  return { qty: origQty, unit_cost: origUnit };
}

/** Segment breakdown for household bulk apply (m &gt; 3 may add extra similar lines). */
export type MiscSegment = { qty: number; unit_cost: number; isExtra?: boolean };

export function computeMiscSegments(item: MiscLine, multiplier: number): MiscSegment[] {
  const m = Math.min(5, Math.max(1, multiplier));
  if (m <= 3) {
    const n = computeItemAtSlider(item, m);
    return [{ qty: n.qty, unit_cost: n.unit_cost }];
  }
  const at3 = computeItemAtSlider(item, 3);
  const { ceiling, maxQty } = getItemCeiling(item.description);
  const segs: MiscSegment[] = [{ qty: at3.qty, unit_cost: at3.unit_cost }];
  const extraRuns = m - 3;
  const baseQ = Math.max(1, Math.min(maxQty, item.qty));
  for (let i = 0; i < extraRuns; i++) {
    const u = Math.min(ceiling, Math.max(item.unit_cost, at3.unit_cost));
    segs.push({ qty: baseQ, unit_cost: Math.round(u * 100) / 100, isExtra: true });
  }
  return segs;
}

export function miscLineTotal(segments: MiscSegment[]): number {
  return segments.reduce((s, seg) => s + seg.qty * seg.unit_cost, 0);
}

/** Discrete snap positions for the misc slider (1.0x–3.0x). */
export function computeNotches(items: MiscLine[]): number[] {
  void items;
  return [1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 2.75, 3];
}
