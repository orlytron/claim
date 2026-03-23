import type { Bundle, BundleItem, BundleTierBlock, BundleTiers5 } from "./bundles-data";

export type Tiered5CumulativeInput = {
  room: string;
  bundle_code: string;
  name: string;
  description: string;
  total_value: number;
  sweet_spot: boolean;
  plausibility: Bundle["plausibility"];
  essential: BundleTierBlock;
  enhanced: BundleTierBlock;
  complete: BundleTierBlock;
  full: BundleTierBlock;
  ultimate: BundleTierBlock;
};

function ensureTotals(items: BundleItem[]): BundleItem[] {
  return items.map((i) => ({
    ...i,
    total: Math.round((i.total ?? i.unit_cost * i.qty) * 100) / 100,
  }));
}

function normBlock(b: BundleTierBlock): BundleTierBlock {
  return { total: b.total, items: ensureTotals(b.items) };
}

/**
 * 5-tier focused bundles with cumulative tier snapshots (each tier’s `items` includes all prior lines).
 */
export function tiered5(o: Tiered5CumulativeInput): Bundle {
  const tiers: BundleTiers5 = {
    essential: normBlock(o.essential),
    enhanced: normBlock(o.enhanced),
    complete: normBlock(o.complete),
    full: normBlock(o.full),
    ultimate: normBlock(o.ultimate),
  };
  return {
    room: o.room,
    bundle_code: o.bundle_code,
    name: o.name,
    description: o.description,
    tier: "focused",
    sweet_spot: o.sweet_spot,
    plausibility: o.plausibility,
    total_value: o.total_value,
    items: tiers.ultimate.items.map((i) => ({ ...i })),
    tiers,
    tiersCumulative: true,
  };
}
