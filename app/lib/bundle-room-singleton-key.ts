/**
 * Slot key for matching bundle catalog lines to existing claim lines in a room.
 * (Distinct from `bundle-singleton.ts` camera/laptop rules.)
 */
export function getSingletonKey(desc: string): string | null {
  const d = desc.toLowerCase();
  if (d.includes("sofa") || d.includes("couch")) return "sofa";
  if (d.includes("rug") || d.includes("carpet")) return "rug";
  if (d.includes("piano")) return "piano";
  if (d.includes("dining table")) return "dining_table";
  if (d.includes("coffee table")) return "coffee_table";
  if (d.includes("refrigerator") || d.includes("fridge")) return "fridge";
  if (d.includes("bed frame") || d.includes("bedframe")) return "bed";
  if (d.includes("desk")) return "desk";
  if (d.includes("chandelier") || d.includes("pendant light")) return "pendant";
  if (d.includes("lamp") && d.includes("floor")) return "floor_lamp";
  if (d.includes("peloton")) return "peloton";
  if (d.includes("macbook") || d.includes("mac book")) return "macbook";
  if (d.includes("espresso") && d.includes("machine")) return "espresso_machine";
  if (/\btv\b|television|oled|qled/.test(d)) return "tv";
  return null;
}
