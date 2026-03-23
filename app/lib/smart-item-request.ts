import type { Bundle, BundleItem, BundleTierBlock, BundleTiers3 } from "./bundles-data";

/** Raw JSON shape from Claude (smart-item-request API). */
export type SmartItemRequestBundleJson = {
  bundle_name: string;
  bundle_description: string;
  primary_item?: {
    description: string;
    brand?: string;
    price?: number;
    category?: string;
  };
  tiers: {
    essential: { total?: number; items?: unknown[] };
    complete: { total?: number; items?: unknown[] };
    full: { total?: number; items?: unknown[] };
  };
};

function normalizeBundleItem(raw: Record<string, unknown>): BundleItem {
  const qty = Math.max(1, Math.round(Number(raw.qty) || 1));
  const unit_cost = Math.round((Number(raw.unit_cost) || 0) * 100) / 100;
  const total = Math.round(unit_cost * qty * 100) / 100;
  return {
    description: String(raw.description ?? "").trim() || "Item",
    brand: String(raw.brand ?? "").trim(),
    qty,
    unit_cost,
    total,
    category: String(raw.category ?? "Other").trim() || "Other",
  };
}

function normalizeTierBlock(block: { total?: number; items?: unknown[] } | undefined): BundleTierBlock {
  const rawItems = Array.isArray(block?.items) ? block!.items! : [];
  const items = rawItems.map((x) => normalizeBundleItem(x && typeof x === "object" ? (x as Record<string, unknown>) : {}));
  const sum = Math.round(items.reduce((s, i) => s + i.total, 0) * 100) / 100;
  return { total: sum, items };
}

/**
 * Turn Claude JSON into a `Bundle` for `FocusedAdditionCard` (explicit 3-tier cumulative).
 */
export function apiResponseToBundle(data: SmartItemRequestBundleJson, room: string): Bundle {
  const essential = normalizeTierBlock(data.tiers?.essential);
  const complete = normalizeTierBlock(data.tiers?.complete);
  const full = normalizeTierBlock(data.tiers?.full);

  const tiers: BundleTiers3 = {
    essential,
    complete,
    full,
  };

  return {
    room,
    bundle_code: `SMART-${Date.now()}`,
    name: String(data.bundle_name ?? "Suggested bundle").trim() || "Suggested bundle",
    description: String(data.bundle_description ?? "").trim(),
    tier: "focused",
    total_value: complete.total,
    sweet_spot: true,
    plausibility: "green",
    items: full.items,
    tiers,
  };
}
