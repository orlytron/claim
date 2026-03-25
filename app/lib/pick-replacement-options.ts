/** Shared logic for /api/find-replacement and rebuild planning UI. */

export type FlatProduct = {
  title: string;
  brand: string;
  price: number;
  url: string;
  retailer?: string;
};

export function parsePrice(raw: string | number | undefined): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  return parseFloat(String(raw).replace(/[^0-9.]/g, "")) || 0;
}

export function pickSimilarAndUpgrade(
  products: FlatProduct[],
  claimed: number
): { similar: FlatProduct | null; upgrade: FlatProduct | null } {
  const c = claimed > 0 ? claimed : 0.01;
  const valid = products
    .filter((p) => p.price > 0 && p.price <= c * 2)
    .sort((a, b) => a.price - b.price);
  if (!valid.length) return { similar: null, upgrade: null };

  const underCap = valid.filter((p) => p.price <= c * 1.3);
  const similar = underCap.length ? underCap[underCap.length - 1]! : valid[0]!;

  const upgrade =
    valid.find((p) => p.price > similar.price + 0.01 && p.price <= c * 2) ?? null;

  return { similar, upgrade };
}

function pushFlat(out: FlatProduct[], o: Record<string, unknown>) {
  const price = typeof o.price === "number" ? o.price : parsePrice(o.price as string);
  const title = String(o.title ?? "").trim();
  if (!title || price <= 0) return;
  out.push({
    title,
    brand: String(o.brand ?? "").trim(),
    price,
    url: String(o.url ?? "").trim() || `https://www.google.com/search?q=${encodeURIComponent(title)}&tbm=shop`,
    retailer: String(o.retailer ?? "").trim(),
  });
}

/** Flatten mid, premium, and options jsonb from upgrades_cache row. */
export function flattenUpgradesCacheRow(row: {
  mid?: unknown;
  premium?: unknown;
  options?: unknown;
}): FlatProduct[] {
  const out: FlatProduct[] = [];
  const seen = new Set<string>();

  const add = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    const rec = o as Record<string, unknown>;
    if ("mid" in rec && rec.mid && typeof rec.mid === "object") {
      pushFlat(out, rec.mid as Record<string, unknown>);
    }
    if ("premium" in rec && rec.premium && typeof rec.premium === "object") {
      pushFlat(out, rec.premium as Record<string, unknown>);
    }
    if ("title" in rec && "price" in rec) {
      pushFlat(out, rec);
    }
  };

  add(row.mid);
  add(row.premium);

  const opts = row.options;
  if (Array.isArray(opts)) {
    for (const el of opts) {
      if (!el || typeof el !== "object") continue;
      const e = el as Record<string, unknown>;
      if ("mid" in e && e.mid && typeof e.mid === "object") {
        pushFlat(out, e.mid as Record<string, unknown>);
      }
      if ("premium" in e && e.premium && typeof e.premium === "object") {
        pushFlat(out, e.premium as Record<string, unknown>);
      }
      if ("title" in e && "price" in e) {
        pushFlat(out, e);
      }
    }
  }

  return out.filter((p) => {
    const k = `${p.title.toLowerCase()}|${p.price}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
