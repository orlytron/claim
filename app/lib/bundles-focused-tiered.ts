import type { Bundle, BundleItem, BundleTiersDef, TierLineSource } from "./bundles-data";

export type TieredBundle = Omit<Bundle, "items"> & {
  items: BundleItem[];
  tiers: BundleTiersDef;
};

function sumLines(lines: TierLineSource[] | undefined): number {
  if (!lines?.length) return 0;
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

/** Build tier blocks with totals = cumulative value at that tier. */
function tiers(
  essentialItems: TierLineSource[],
  completeAdds: TierLineSource[],
  fullAdds: TierLineSource[]
): BundleTiersDef {
  const e = sumLines(essentialItems);
  const c = e + sumLines(completeAdds);
  const f = c + sumLines(fullAdds);
  return {
    essential: { total: e, items: essentialItems },
    complete: { total: c, adds: completeAdds },
    full: { total: f, adds: fullAdds },
  };
}

function focusedBundle(
  base: Omit<TieredBundle, "items" | "tiers" | "total_value"> & { tiers: BundleTiersDef }
): TieredBundle {
  const t = base.tiers;
  const flat: BundleItem[] = [
    ...(t.essential.items ?? []).map(toBI),
    ...(t.complete.adds ?? []).map(toBI),
    ...(t.full.adds ?? []).map(toBI),
  ];
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

/** Master, laundry, smart-home focused tiered sets (client-facing). */
export const FOCUSED_TIERED_BUNDLES: TieredBundle[] = [
  focusedBundle({
    room: "Bathroom Master",
    bundle_code: "MSTR-BED-1",
    name: "Master Bedroom Furniture",
    description: "Complete king bedroom furniture suite",
    tier: "focused",
    sweet_spot: true,
    plausibility: "easy",
    tiers: tiers(
      [
        L("King platform bed frame", "Restoration Hardware", 3200, 1, "Furniture"),
        L("Nightstands pair", "Restoration Hardware", 1400, 2, "Furniture"),
        L("Dresser 6-drawer", "West Elm", 1500, 1, "Furniture"),
      ],
      [
        L("Armoire/wardrobe double door", "Restoration Hardware", 3800, 1, "Furniture"),
        L("Bedroom bench upholstered", "George Smith", 2800, 1, "Furniture"),
        L("Full length mirror floor standing", "West Elm", 680, 1, "Furniture"),
        L("Bedside lamps pair", "Visual Comfort", 960, 1, "Lighting"),
      ],
      [
        L("Custom millwork built-in wardrobe", "", 8500, 1, "Furniture"),
        L("Chaise lounge bedroom", "Holly Hunt", 4800, 1, "Furniture"),
        L("Chandelier bedroom", "Visual Comfort", 2800, 1, "Lighting"),
      ]
    ),
  }),
  focusedBundle({
    room: "Bathroom Master",
    bundle_code: "MSTR-BED-2",
    name: "King Bedding & Linens",
    description: "Luxury bedding for the master bedroom",
    tier: "focused",
    sweet_spot: true,
    plausibility: "easy",
    tiers: tiers(
      [
        L("Sferra Fiona king sheet set", "Sferra", 480, 2, "Textiles"),
        L("Hungarian goose down duvet king", "Sferra", 680, 1, "Textiles"),
        L("Down pillows king set of 4", "Sferra", 280, 1, "Textiles"),
      ],
      [
        L("Silk duvet cover king", "Slip", 380, 1, "Textiles"),
        L("Euro shams set of 4", "Sferra", 220, 1, "Textiles"),
        L("Cashmere throw blanket", "Loro Piana", 680, 2, "Textiles"),
        L("Decorative throw pillows king", "Aerin", 180, 6, "Textiles"),
      ],
      [
        L("Frette hotel collection sheet set", "Frette", 680, 3, "Textiles"),
        L("Silk pillowcases set king", "Slip", 185, 4, "Textiles"),
        L("Mattress topper king goose down", "Sferra", 880, 1, "Textiles"),
      ]
    ),
  }),
  focusedBundle({
    room: "Bathroom Master",
    bundle_code: "MSTR-JAC-1",
    name: "Jacquie's Wardrobe",
    description: "Art curator's professional and everyday wardrobe",
    tier: "focused",
    sweet_spot: false,
    plausibility: "easy",
    tiers: tiers(
      [
        L("Designer blazers", "", 850, 4, "Clothing"),
        L("Silk blouses", "", 380, 8, "Clothing"),
        L("Tailored trousers", "", 420, 6, "Clothing"),
        L("Designer dresses cocktail", "", 680, 4, "Clothing"),
        L("Cashmere sweaters", "", 380, 6, "Clothing"),
      ],
      [
        L("Designer evening gowns", "", 1800, 3, "Clothing"),
        L("Designer coats", "", 1200, 3, "Clothing"),
        L("Leather handbags designer", "", 1800, 3, "Clothing"),
        L("Designer shoes heels", "", 650, 8, "Clothing"),
        L("Designer shoes flats", "", 480, 6, "Clothing"),
      ],
      [
        L("Fur coat or luxury overcoat", "", 4800, 1, "Clothing"),
        L("Designer handbag premium", "", 3800, 2, "Clothing"),
        L("Designer boots knee high", "", 1200, 3, "Clothing"),
      ]
    ),
  }),
  focusedBundle({
    room: "Bathroom Master",
    bundle_code: "MSTR-DAV-1",
    name: "David's Wardrobe",
    description: "Emmy winner's professional wardrobe",
    tier: "focused",
    sweet_spot: false,
    plausibility: "easy",
    tiers: tiers(
      [
        L("Tailored suits", "", 1800, 3, "Clothing"),
        L("Dress shirts professional", "", 280, 8, "Clothing"),
        L("Dress shoes", "", 480, 4, "Clothing"),
        L("Casual blazers", "", 650, 3, "Clothing"),
        L("Dress belts leather", "", 180, 4, "Clothing"),
      ],
      [
        L("Cashmere sweaters men", "", 480, 6, "Clothing"),
        L("Premium jeans", "", 280, 6, "Clothing"),
        L("Tennis outfits complete", "Nike", 180, 8, "Clothing"),
        L("Swim trunks premium", "", 120, 6, "Clothing"),
        L("Dress watches casual", "", 380, 3, "Clothing"),
      ],
      [
        L("Bespoke suit custom tailored", "", 4800, 2, "Clothing"),
        L("Luxury overcoat cashmere", "", 2800, 1, "Clothing"),
        L("Luxury loafers Italian", "", 850, 3, "Clothing"),
      ]
    ),
  }),
  focusedBundle({
    room: "Bathroom Master",
    bundle_code: "MSTR-JEW-1",
    name: "Jacquie's Jewelry Collection",
    description: "Personal and inherited fine jewelry",
    tier: "focused",
    sweet_spot: false,
    plausibility: "medium",
    tiers: tiers(
      [
        L("Gold chain necklace 14k", "", 1800, 2, "Jewelry"),
        L("Diamond stud earrings 1ct total", "", 2800, 1, "Jewelry"),
        L("Pearl necklace strand", "", 1400, 1, "Jewelry"),
        L("Gold bracelet 14k", "", 1200, 2, "Jewelry"),
        L("Inherited estate ring gold", "", 1800, 2, "Jewelry"),
      ],
      [
        L("Inherited estate diamond ring", "", 3800, 1, "Jewelry"),
        L("Sapphire pendant necklace inherited", "", 2400, 1, "Jewelry"),
        L("Gold earrings drop 18k", "", 1200, 3, "Jewelry"),
        L("Vintage brooch collection", "", 850, 4, "Jewelry"),
        L("Costume jewelry collection", "", 280, 8, "Jewelry"),
      ],
      [
        L("Inherited estate necklace with stones", "", 4800, 1, "Jewelry"),
        L("Gold charm bracelet 18k", "", 2200, 1, "Jewelry"),
        L("Pearl drop earrings South Sea", "", 1800, 1, "Jewelry"),
      ]
    ),
  }),
  focusedBundle({
    room: "Bathroom Master",
    bundle_code: "MSTR-WATCH-1",
    name: "Watch Collection",
    description: "David and Jacquie's watch collection",
    tier: "focused",
    sweet_spot: false,
    plausibility: "medium",
    tiers: tiers(
      [
        L("Rolex Datejust 36mm stainless", "Rolex", 8500, 1, "Watches"),
        L("Omega Seamaster men", "Omega", 4800, 1, "Watches"),
        L("Women's dress watch gold", "", 1800, 1, "Watches"),
      ],
      [
        L("TAG Heuer Carrera chronograph", "TAG Heuer", 3200, 1, "Watches"),
        L("Women's diamond bezel watch", "", 2800, 1, "Watches"),
        L("Casual sport watch men", "Garmin", 650, 1, "Watches"),
      ],
      [
        L("IWC Portugieser automatic", "IWC", 8500, 1, "Watches"),
        L("Vintage dress watch inherited", "", 3800, 1, "Watches"),
      ]
    ),
  }),
  focusedBundle({
    room: "Bathroom White",
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
