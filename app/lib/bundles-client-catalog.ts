import type { Bundle } from "./bundles-data";
import { BUNDLES_DATA } from "./bundles-data";
import { FOCUSED_TIERED_BUNDLES } from "./bundles-focused-tiered";

/**
 * Bundles shown on the client room review page (focused tier cards + affordable).
 * Letter-tier mega packages stay in BUNDLES_DATA for admin / bundle browser only.
 */
export function getClientRoomBundles(): Bundle[] {
  const seen = new Set<string>();
  const out: Bundle[] = [];
  for (const b of FOCUSED_TIERED_BUNDLES as Bundle[]) {
    seen.add(b.bundle_code);
    out.push(b);
  }
  for (const b of BUNDLES_DATA) {
    if (seen.has(b.bundle_code)) continue;
    if (b.tier === "affordable" || b.tier === "focused") out.push(b);
  }
  return out;
}
