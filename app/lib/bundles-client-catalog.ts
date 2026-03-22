import type { Bundle } from "./bundles-data";
import { BUNDLES_DATA } from "./bundles-data";

/** Tiered or “focused” addition cards for the client room page. */
export function getFocusedBundlesForRoom(room: string): Bundle[] {
  return BUNDLES_DATA.filter((b) => b.room === room && (b.tiers != null || b.tier === "focused"));
}

/** Large letter-tier packages — admin only (hidden from default client list). */
export function getAdminOnlyBundlesForRoom(room: string): Bundle[] {
  return BUNDLES_DATA.filter(
    (b) =>
      b.room === room &&
      !b.tiers &&
      b.tier !== "focused" &&
      b.tier !== "consumables" &&
      b.tier !== "affordable" &&
      b.total_value > 30_000
  );
}

export function getConsumableBundlesForRoom(room: string): Bundle[] {
  return BUNDLES_DATA.filter((b) => b.room === room && b.tier === "consumables");
}

/** @deprecated Use getFocusedBundlesForRoom */
export function getClientRoomBundles(): Bundle[] {
  const seen = new Set<string>();
  const out: Bundle[] = [];
  for (const b of BUNDLES_DATA) {
    if (!b.tiers || seen.has(b.bundle_code)) continue;
    seen.add(b.bundle_code);
    out.push(b);
  }
  return out;
}
