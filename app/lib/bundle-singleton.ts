import type { ClaimItem } from "./types";
import type { BundleItem } from "./bundles-data";

/**
 * Returns a stable slot key for items that should not duplicate per room
 * (e.g. one primary camera body per brand). Returns null for multi-quantity lines (lamps, lenses, etc.).
 */
export function getSingletonKey(description: string, brand: string, category?: string): string | null {
  const d = description.trim().toLowerCase();
  const b = (brand || "").trim().toLowerCase() || "unknown";
  const cat = (category || "").toLowerCase();

  const multiOk = [
    "lamp",
    "lamps",
    "pillow",
    "pillows",
    "rug",
    "drapes",
    "drape",
    "shade",
    "shades",
    "panel",
    "panels",
    "throw",
    "vase",
    "candle",
    "book",
    "books",
    "towel",
    "shelf",
    "chair",
    "chairs",
    "table",
    "ottoman",
    "mm f/",
    "lens",
    "battery",
    "batteries",
    "card",
    "filter",
    "case",
    "bag",
    "stand",
    "mount",
    "cable",
    "drive",
    "drives",
    "storage",
    "print",
    "pillow",
    "charger",
    "dock",
    "keyboard",
    "mouse",
    "speaker",
    "speakers",
  ];
  if (multiOk.some((k) => d.includes(k))) return null;

  if (/\b(refresh|collection)\b/i.test(d)) return null;
  if (/\bset\b/i.test(d) && !/\d{2,}/.test(d)) return null;

  if (/\bcamera\b/i.test(d) && !/\blens\b/i.test(d) && !/\d+mm\b/i.test(d)) {
    return `singleton:camera:${b}`;
  }
  if (/\b(a\d{4}\b|fx\d|fx\s*\d|eos r|z\s*6|z\s*7|alpha\b)/i.test(d) && !/\blens\b/i.test(d) && !/\d+mm\b/i.test(d)) {
    return `singleton:camera:${b}`;
  }

  if (/\bgimbal\b/i.test(d) || /\brs\s*3\b/i.test(d)) return `singleton:gimbal:${b}`;

  if (/\bmacbook\b/i.test(d) || (/\blaptop\b/i.test(d) && cat.includes("elect"))) return `singleton:laptop:${b}`;
  if (/\bmac studio\b/i.test(d)) return `singleton:desktop:${b}`;

  if (/\bmonitor\b/i.test(d) && !/\bstand\b/i.test(d)) return `singleton:monitor:${b}`;

  if (/\bpiano\b/i.test(d)) return `singleton:piano:${b}`;

  if (/\btelevision\b|\b tv\b|\boled\b|\bqled\b/i.test(d) && cat.includes("elect")) return `singleton:tv:${b}`;

  return null;
}

export function hasSingletonConflict(
  room: string,
  bundleItem: BundleItem,
  claimItems: ClaimItem[]
): ClaimItem | null {
  const bk = getSingletonKey(bundleItem.description, bundleItem.brand, bundleItem.category);
  if (!bk) return null;
  const existing = claimItems.find(
    (c) =>
      c.room === room &&
      getSingletonKey(c.description, c.brand, c.category) === bk
  );
  return existing ?? null;
}

/** All selected bundle lines that collide with an existing claim line in the same room (singleton slots). */
export function findBundleSingletonConflicts(
  room: string,
  selectedBundleItems: BundleItem[],
  claimItems: ClaimItem[]
): { bundleItem: BundleItem; existing: ClaimItem }[] {
  const out: { bundleItem: BundleItem; existing: ClaimItem }[] = [];
  for (const bi of selectedBundleItems) {
    const ex = hasSingletonConflict(room, bi, claimItems);
    if (ex) out.push({ bundleItem: bi, existing: ex });
  }
  return out;
}
