"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ClaimItem } from "../../lib/types";
import { formatCurrency } from "../../lib/utils";

export type UpgradeOption = {
  label: string;
  price: number;
  title: string;
  brand: string;
  model: string;
  retailer: string;
  url: string;
};

/** Legacy prefixes for rows created before flat options UI */
export const ENTRY_TITLE_PREFIX = "Entry upgrade —";
export const ENTRY_PLUS_TITLE_PREFIX = "Entry+ upgrade —";

type CatalogProduct = {
  title: string;
  brand: string;
  model: string;
  price: number;
  retailer: string;
  url: string;
};

type UpgradeOptionSet = { mid: CatalogProduct; premium: CatalogProduct | null };

function SmallSpinner() {
  return (
    <svg className="h-5 w-5 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function normKey(title: string, price: number): string {
  return `${title.trim().toLowerCase()}|${price}`;
}

function normalizeSet(s: unknown): UpgradeOptionSet | null {
  if (!s || typeof s !== "object") return null;
  const o = s as UpgradeOptionSet;
  if (!o.mid || typeof o.mid !== "object" || !(o.mid as CatalogProduct).title) return null;
  const mid = o.mid as CatalogProduct;
  const prem =
    o.premium && typeof o.premium === "object" && (o.premium as CatalogProduct).price > 0
      ? (o.premium as CatalogProduct)
      : null;
  return { mid, premium: prem };
}

/** Priority: optionSets from API → single mid/premium on response. */
function setsFromResponse(j: Record<string, unknown>): UpgradeOptionSet[] {
  const rawSets = j.optionSets;
  if (Array.isArray(rawSets) && rawSets.length > 0) {
    const out = rawSets.map(normalizeSet).filter(Boolean) as UpgradeOptionSet[];
    if (out.length) return out;
  }
  const m = j.mid as CatalogProduct | undefined;
  if (m?.title && m.price > 0) {
    const p = j.premium as CatalogProduct | null | undefined;
    const prem = p && p.price > 0 ? p : null;
    return [{ mid: m, premium: prem }];
  }
  return [];
}

/** Flatten all cached pairs into individual product cards; drop duplicate price+title and same-price premium as mid. */
function flattenOptionSets(sets: UpgradeOptionSet[]): CatalogProduct[] {
  const out: CatalogProduct[] = [];
  const seen = new Set<string>();
  const push = (p: CatalogProduct) => {
    const k = normKey(p.title, p.price);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(p);
  };
  for (const s of sets) {
    if (!s?.mid) continue;
    push(s.mid);
    if (s.premium && Math.abs(s.premium.price - s.mid.price) > 0.01) {
      push(s.premium);
    }
  }
  return out;
}

function validDisplayOptions(products: CatalogProduct[], baseUnit: number, itemBrand: string): CatalogProduct[] {
  return products.filter((opt) => {
    if (!opt.title?.trim() || opt.price <= 0) return false;
    if (opt.price <= baseUnit * 1.15) return false;
    const brand = (opt.brand || itemBrand || "").trim();
    const retailer = (opt.retailer || "").trim();
    if (!brand || !retailer) return false;
    return true;
  });
}

function NoCacheUpgradeForm({
  item,
  onAddCustom,
  message,
  startOpen = false,
}: {
  item: ClaimItem;
  onAddCustom: (price: number, title: string, brand: string) => Promise<void>;
  message?: string;
  startOpen?: boolean;
}) {
  const [open, setOpen] = useState(startOpen);
  const [price, setPrice] = useState("");
  const [title, setTitle] = useState(item.description);
  const [brand, setBrand] = useState(item.brand || "");
  const [saving, setSaving] = useState(false);

  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-white p-5 shadow-sm">
      {message ? <p className="text-sm text-[#6B7280]">{message}</p> : null}
      {!message ? <p className="text-sm text-[#6B7280]">No catalog match yet — add a custom replacement.</p> : null}
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="mt-3 text-sm font-semibold text-[#2563EB] hover:underline"
        >
          + Enter custom price
        </button>
      ) : (
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-[#6B7280]">Description</label>
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Description"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#6B7280]">Brand (optional)</label>
            <input
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[#6B7280]">Price</label>
            <div className="mt-1 flex items-center gap-2">
              <span className="text-gray-500">$</span>
              <input
                type="number"
                className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm tabular-nums"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
              />
            </div>
          </div>
          <button
            type="button"
            disabled={saving || !title.trim() || parseFloat(price) <= 0}
            onClick={() => {
              setSaving(true);
              void onAddCustom(parseFloat(price), title.trim(), brand.trim()).finally(() => setSaving(false));
            }}
            className="h-10 w-full rounded-lg bg-[#16A34A] text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-40"
          >
            {saving ? "…" : "Apply Custom"}
          </button>
        </div>
      )}
    </div>
  );
}

export function UpgradeOptionsPanel({
  item,
  locked,
  cacheHas,
  onApply,
  onApplied,
  onRefreshNotice,
  onCatalogEmpty,
}: {
  item: ClaimItem;
  locked: boolean;
  cacheHas: boolean;
  onApply: (option: UpgradeOption) => Promise<void>;
  onApplied?: () => void;
  onRefreshNotice?: (message: string) => void;
  onCatalogEmpty?: () => void;
}) {
  const emptyNotifiedRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rawProducts, setRawProducts] = useState<CatalogProduct[]>([]);
  const [customPrice, setCustomPrice] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [applying, setApplying] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const baseUnit =
    item.source === "upgrade" && item.pre_upgrade_item ? item.pre_upgrade_item.unit_cost : item.unit_cost;
  const isUpgradedLine = item.source === "upgrade" && !!item.pre_upgrade_item;
  const origDesc = item.pre_upgrade_item?.description ?? item.description;
  const itemBrand = item.brand || "";

  const fetchPayload = useCallback(() => {
    const descForApi =
      item.source === "upgrade" ? item.description : item.pre_upgrade_item?.description ?? item.description;
    const priceForApi =
      item.source === "upgrade" ? item.unit_cost : item.pre_upgrade_item?.unit_cost ?? item.unit_cost;
    return {
      item_description: descForApi,
      brand: item.brand || "",
      current_price: priceForApi,
      category: item.category || "",
    };
  }, [
    item.brand,
    item.category,
    item.description,
    item.unit_cost,
    item.source,
    item.pre_upgrade_item?.description,
    item.pre_upgrade_item?.unit_cost,
  ]);

  const applyResponseJson = useCallback(
    (j: Record<string, unknown>) => {
      const sets = setsFromResponse(j);
      const flat = flattenOptionSets(sets);
      setRawProducts(flat);
    },
    []
  );

  const validOptions = useMemo(
    () => validDisplayOptions(rawProducts, baseUnit, itemBrand),
    [rawProducts, baseUnit, itemBrand]
  );

  useEffect(() => {
    setCustomDesc(item.description);
  }, [item.description]);

  useEffect(() => {
    emptyNotifiedRef.current = false;
  }, [item.description, item.unit_cost, cacheHas]);

  useEffect(() => {
    if (!cacheHas || locked) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/search-upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fetchPayload()),
        });
        if (!res.ok) throw new Error("fetch");
        const j = (await res.json()) as Record<string, unknown>;
        if (!cancelled) applyResponseJson(j);
      } catch {
        if (!cancelled) setRawProducts([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cacheHas, locked, fetchPayload, applyResponseJson]);

  useEffect(() => {
    if (!cacheHas || locked || loading || refreshing) return;
    if (validOptions.length > 0) {
      emptyNotifiedRef.current = false;
      return;
    }
    if (emptyNotifiedRef.current) return;
    emptyNotifiedRef.current = true;
    onCatalogEmpty?.();
  }, [cacheHas, locked, loading, refreshing, validOptions.length, onCatalogEmpty]);

  const handleRefresh = useCallback(async () => {
    if (locked) return;
    setRefreshing(true);
    try {
      const res = await fetch("/api/search-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...fetchPayload(), force_refresh: true }),
      });
      if (!res.ok) throw new Error("fetch");
      const j = (await res.json()) as Record<string, unknown>;
      applyResponseJson(j);
      const sets = setsFromResponse(j);
      const n = flattenOptionSets(sets).length;
      onRefreshNotice?.(`Updated! ${n} options loaded`);
    } catch {
      onRefreshNotice?.("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, [locked, fetchPayload, applyResponseJson, onRefreshNotice]);

  function runApply(p: Promise<void>) {
    if (applying) return;
    setApplying(true);
    void p
      .then(() => onApplied?.())
      .finally(() => setApplying(false));
  }

  const cardBase =
    "flex min-w-[160px] flex-1 flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md md:min-w-0";
  const cardOn = "border-2 border-[#2563EB] bg-blue-50/80 shadow-md";

  function isCardSelected(opt: CatalogProduct): boolean {
    if (!isUpgradedLine) return false;
    return Math.abs(item.unit_cost - opt.price) < 0.01 && item.description === opt.title;
  }

  if (locked) {
    return (
      <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-5 text-sm text-[#6B7280]">
        This row is locked. Unlock to choose upgrades.
      </div>
    );
  }

  if (!cacheHas) {
    return (
      <NoCacheUpgradeForm
        item={item}
        onAddCustom={async (price, title, brand) => {
          await onApply({
            label: "Custom",
            price,
            title,
            brand,
            model: "",
            retailer: "",
            url: "",
          });
          onApplied?.();
        }}
      />
    );
  }

  if (loading && !refreshing && rawProducts.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-[#6B7280]">
        <SmallSpinner /> Loading options…
      </div>
    );
  }

  if (!loading && !refreshing && validOptions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="text-sm text-[#6B7280]">
          Choose your upgrade for{" "}
          <span className="font-semibold text-gray-900">{origDesc}</span>:
        </p>
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            disabled={refreshing || applying}
            onClick={() => void handleRefresh()}
            className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#6B7280] transition hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-50"
          >
            {refreshing ? (
              <>
                <SmallSpinner />
                Refreshing…
              </>
            ) : (
              <>↻ Refresh</>
            )}
          </button>
          {validOptions.length > 0 ? (
            <span className="text-[11px] text-[#6B7280]">{validOptions.length} options loaded</span>
          ) : null}
        </div>
      </div>

      <div
        className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${refreshing ? "opacity-60" : ""}`}
      >
        {validOptions.map((opt) => (
          <div key={normKey(opt.title, opt.price)} className={`${cardBase} ${isCardSelected(opt) ? cardOn : ""}`}>
            <p className="text-[15px] font-semibold leading-snug text-gray-900 [overflow-wrap:anywhere]">{opt.title}</p>
            <p className="mt-2 text-sm font-medium text-gray-800">{(opt.brand || itemBrand).trim()}</p>
            <p className="mt-1 text-xs font-medium text-[#6B7280]">{opt.retailer.trim()}</p>
            <p className="mt-4 text-[22px] font-bold text-blue-600 tabular-nums">{formatCurrency(opt.price * item.qty)}</p>
            <p className="text-sm font-semibold text-[#16A34A] tabular-nums">
              +{formatCurrency((opt.price - baseUnit) * item.qty)}
            </p>
            {opt.url?.trim() ? (
              <a
                href={opt.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 text-xs font-semibold text-[#2563EB] underline"
              >
                View ↗
              </a>
            ) : null}
            <button
              type="button"
              disabled={applying || refreshing}
              onClick={() =>
                runApply(
                  onApply({
                    label: "Upgrade",
                    price: opt.price,
                    title: opt.title,
                    brand: (opt.brand || itemBrand).trim(),
                    model: opt.model || "",
                    retailer: opt.retailer,
                    url: opt.url || "",
                  })
                )
              }
              className="mt-4 h-10 w-full rounded-lg bg-[#2563EB] text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-40"
            >
              Select
            </button>
          </div>
        ))}
      </div>

      <div>
        <button
          type="button"
          onClick={() => setCustomOpen((o) => !o)}
          className="text-sm font-semibold text-[#2563EB] transition hover:underline"
        >
          {customOpen ? "− Hide custom price" : "+ Enter custom price"}
        </button>
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out ${
            customOpen ? "mt-4 max-h-[320px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div>
              <label className="text-xs font-medium text-[#6B7280]">Description</label>
              <input
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                value={customDesc}
                onChange={(e) => setCustomDesc(e.target.value)}
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#6B7280]">Price</label>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-[#6B7280]">$</span>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={customPrice}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm tabular-nums"
                />
              </div>
            </div>
            <button
              type="button"
              disabled={applying || parseFloat(customPrice) <= 0}
              onClick={() =>
                runApply(
                  onApply({
                    label: "Custom",
                    price: parseFloat(customPrice),
                    title: customDesc.trim() || `Custom — ${origDesc.slice(0, 120)}`,
                    brand: item.brand,
                    model: "",
                    retailer: "",
                    url: "",
                  })
                )
              }
              className="h-10 w-full rounded-lg bg-[#16A34A] text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-40"
            >
              Apply Custom
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
