/**
 * Minimum multipliers for meaningful upgrade tiers vs original replacement value.
 * Used by /api/search-upgrade and the upgrade options UI (Entry / Entry+ floors).
 */
export function getMinUpgradeMultiplier(
  originalPrice: number,
  tier: "entry" | "mid" | "premium"
): number {
  if (originalPrice < 100) {
    if (tier === "entry") return 1.5;
    if (tier === "mid") return 2.0;
    return 3.0;
  }
  if (originalPrice < 1000) {
    if (tier === "entry") return 1.5;
    if (tier === "mid") return 2.0;
    return 2.5;
  }
  if (originalPrice < 3000) {
    if (tier === "entry") return 1.4;
    if (tier === "mid") return 1.75;
    return 2.5;
  }
  if (originalPrice < 9000) {
    if (tier === "entry") return 1.3;
    if (tier === "mid") return 1.6;
    return 2.2;
  }
  if (tier === "entry") return 1.25;
  if (tier === "mid") return 1.5;
  return 2.0;
}

export function minMidFloorUsd(currentPrice: number): number {
  return Math.max(
    currentPrice * 1.15,
    currentPrice * getMinUpgradeMultiplier(currentPrice, "mid")
  );
}

export function minPremiumFloorUsd(currentPrice: number): number {
  return Math.max(
    currentPrice * 1.5,
    currentPrice * getMinUpgradeMultiplier(currentPrice, "premium")
  );
}

/** Entry / Entry+ derived from catalog mid, never below meaningful uplift vs original. */
export function entryDerivedUnitPrices(midPrice: number, originalUnit: number): {
  entry: number;
  entryPlus: number;
} {
  return {
    entry: Math.max(Math.round(midPrice * 0.75), Math.round(originalUnit * 1.25)),
    entryPlus: Math.max(Math.round(midPrice * 0.85), Math.round(originalUnit * 1.4)),
  };
}
