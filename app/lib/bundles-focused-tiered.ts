import type { Bundle, BundleItem, BundleTiersDef, TierLineSource } from "./bundles-data";

export type TieredBundle = Omit<Bundle, "items"> & {
  items: BundleItem[];
  tiers: BundleTiersDef;
};

function sumLinesBI(lines: BundleItem[]): number {
  return lines.reduce((s, l) => s + l.qty * l.unit_cost, 0);
}

function toBI(l: TierLineSource): BundleItem {
  return {
    description: l.description,
    brand: l.brand,
    qty: l.qty,
    unit_cost: l.unit_cost,
    total: l.qty * l.unit_cost,
    category: l.category,
  };
}

/** Cumulative totals; complete/full `items` are incremental adds only. */
function tiers(
  essentialItems: TierLineSource[],
  completeAdds: TierLineSource[],
  fullAdds: TierLineSource[]
): BundleTiersDef {
  const eItems = essentialItems.map(toBI);
  const cItems = completeAdds.map(toBI);
  const fItems = fullAdds.map(toBI);
  const e = sumLinesBI(eItems);
  const c = sumLinesBI(cItems);
  const f = sumLinesBI(fItems);
  return {
    essential: { total: e, items: eItems },
    complete: { total: e + c, items: [...eItems, ...cItems] },
    full: { total: e + c + f, items: [...eItems, ...cItems, ...fItems] },
  };
}

function focusedBundle(
  base: Omit<TieredBundle, "items" | "tiers" | "total_value"> & { tiers: BundleTiersDef }
): TieredBundle {
  const t = base.tiers;
  const flat: BundleItem[] = [...t.essential.items, ...t.complete.items, ...t.full.items];
  return {
    ...base,
    items: flat,
    tiers: t,
    total_value: t.complete.total,
  };
}

const L = (description: string, brand: string, unit_cost: number, qty: number, category: string): TierLineSource => ({
  description,
  brand,
  unit_cost,
  qty,
  category,
});

/** Laundry + smart home only — room-specific tiered sets live in bundles-tiered-new. */
export const FOCUSED_TIERED_BUNDLES: TieredBundle[] = [
  focusedBundle({
    room: "Master Bathroom",
    bundle_code: "LAUN-1",
    name: "Laundry Room Setup",
    description: "Washer dryer and laundry essentials",
    tier: "focused",
    sweet_spot: true,
    plausibility: "easy",
    tiers: tiers(
      [
        L("LG front load washer", "LG", 1299, 1, "Appliances"),
        L("LG front load dryer", "LG", 1299, 1, "Appliances"),
        L("Ironing board premium", "Brabantia", 180, 1, "Appliances"),
      ],
      [
        L("LG SideKick pedestal washer", "LG", 799, 1, "Appliances"),
        L("Rowenta steam iron", "Rowenta", 180, 1, "Appliances"),
        L("Steamery Cirrus garment steamer", "Steamery", 195, 1, "Appliances"),
        L("Laundry hampers set", "Yamazaki", 85, 3, "Household"),
      ],
      [
        L("Miele washer W1 front load", "Miele", 1999, 1, "Appliances"),
        L("Miele dryer T1 heat pump", "Miele", 1999, 1, "Appliances"),
        L("Laundry room custom cabinetry", "", 3800, 1, "Furniture"),
      ]
    ),
  }),
  focusedBundle({
    room: "Living Room",
    bundle_code: "SMART-1",
    name: "Smart Home & Security",
    description: "Home automation and security systems",
    tier: "focused",
    sweet_spot: false,
    plausibility: "easy",
    tiers: tiers(
      [
        L("Nest Learning Thermostat", "Google", 250, 3, "Electronics"),
        L("Ring security camera outdoor", "Ring", 180, 4, "Electronics"),
        L("Ring video doorbell Pro", "Ring", 250, 1, "Electronics"),
        L("Lutron smart switches", "Lutron", 85, 8, "Electronics"),
      ],
      [
        L("Sonos whole home audio system", "Sonos", 499, 4, "Electronics"),
        L("Apple TV 4K", "Apple", 130, 4, "Electronics"),
        L("Smart lock August Pro", "August", 280, 3, "Electronics"),
        L("Alarm system ADT panel", "ADT", 380, 1, "Electronics"),
      ],
      [
        L("Control4 smart home controller", "Control4", 3800, 1, "Electronics"),
        L("In-ceiling speakers whole home", "Sonance", 480, 8, "Electronics"),
        L("Security camera system NVR 8-channel", "Hikvision", 1200, 1, "Electronics"),
      ]
    ),
  }),
];
