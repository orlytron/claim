"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cleanDescription } from "../../lib/clean-description";
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

export type UpgradeProduct = {
  title: string;
  brand: string;
  model: string;
  price: number;
  retailer: string;
  url: string;
};

type UpgradeOptionSet = { mid: UpgradeProduct; premium: UpgradeProduct | null };

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

function fallbackShopUrl(title: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(title)}&tbm=shop`;
}

function normalizeSet(s: unknown): UpgradeOptionSet | null {
  if (!s || typeof s !== "object") return null;
  const o = s as UpgradeOptionSet;
  if (!o.mid || typeof o.mid !== "object" || !(o.mid as UpgradeProduct).title) return null;
  const mid = o.mid as UpgradeProduct;
  const prem =
    o.premium && typeof o.premium === "object" && (o.premium as UpgradeProduct).price > 0
      ? (o.premium as UpgradeProduct)
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
  const m = j.mid as UpgradeProduct | undefined;
  if (m?.title && m.price > 0) {
    const p = j.premium as UpgradeProduct | null | undefined;
    const prem = p && p.price > 0 ? p : null;
    return [{ mid: m, premium: prem }];
  }
  return [];
}

/** Flatten option sets into individual products. */
function flattenOptionSets(sets: UpgradeOptionSet[]): UpgradeProduct[] {
  const out: UpgradeProduct[] = [];
  const seen = new Set<string>();
  const push = (p: UpgradeProduct) => {
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

export function isSaneUpgrade(option: UpgradeProduct, originalPrice: number): boolean {
  if (option.price <= originalPrice) return false;
  if (option.price < originalPrice * 1.1) return false;
  if (option.price > originalPrice * 20) return false;
  if (!option.title || option.title.length < 3) return false;
  if (!option.price || option.price <= 0) return false;
  const titleLower = option.title.toLowerCase();
  const badWords = [
    "used",
    "refurbished",
    "pre-owned",
    "open box",
    "open-box",
    "renewed",
    "remanufactured",
    "like new - used",
    "warehouse deal",
  ];
  if (badWords.some((w) => titleLower.includes(w))) return false;
  return true;
}

export function adjustForSets(option: UpgradeProduct, originalItem: ClaimItem): UpgradeProduct {
  const title = option.title.toLowerCase();
  const setMatch = title.match(/set of (\d+)|(\d+)[- ]pack|pair of/i);
  if (setMatch) {
    const count = parseInt(setMatch[1] || setMatch[2] || "2", 10);
    if (originalItem.qty === 1 && count > 1) {
      return {
        ...option,
        price: Math.round((option.price / count) * 100) / 100,
        title: `${option.title} (per item, set of ${count})`,
      };
    }
  }
  return option;
}

export function deduplicateByTitle(options: UpgradeProduct[]): UpgradeProduct[] {
  return options.filter((opt, i, arr) => {
    const words = opt.title
      .toLowerCase()
      .split(/\s+/)
      .slice(0, 4)
      .join(" ");
    return !arr.slice(0, i).some((prev) => {
      const prevWords = prev.title
        .toLowerCase()
        .split(/\s+/)
        .slice(0, 4)
        .join(" ");
      return prevWords === words;
    });
  });
}

export function selectBestThree(options: UpgradeProduct[], originalPrice: number): UpgradeProduct[] {
  const valid = options
    .filter(
      (o) => o.price > originalPrice * 1.1 && o.title?.length > 0 && o.price > 0
    )
    .filter(
      (o, i, arr) =>
        !arr.slice(0, i).some(
          (prev) => Math.abs(prev.price - o.price) / Math.max(o.price, 1e-9) < 0.15
        )
    );

  valid.sort((a, b) => a.price - b.price);

  if (valid.length <= 3) return valid;

  const cheapest = valid[0]!;
  const priciest = valid[valid.length - 1]!;
  const geometricMid = Math.sqrt(cheapest.price * priciest.price);
  const middleCandidates = valid.slice(1, -1);
  const middle =
    middleCandidates.length === 1
      ? middleCandidates[0]!
      : middleCandidates.reduce((best, opt) =>
          Math.abs(opt.price - geometricMid) < Math.abs(best.price - geometricMid) ? opt : best
        );

  return [cheapest, middle, priciest];
}

/** Drop cheapest tier if not meaningfully below mid (entry must be < mid * 0.80). */
function dropEntryIfTooCloseToMid(sortedAsc: UpgradeProduct[]): UpgradeProduct[] {
  if (sortedAsc.length !== 3) return sortedAsc;
  const [entry, mid, premium] = sortedAsc;
  if (entry.price < mid.price * 0.8) return sortedAsc;
  return [mid, premium];
}

function tierLabels(count: number): string[] {
  if (count === 1) return ["UPGRADE"];
  if (count === 2) return ["MID ★", "PREMIUM"];
  return ["ENTRY", "MID ★", "PREMIUM"];
}

function buildDisplayOptions(raw: UpgradeProduct[], item: ClaimItem, originalPrice: number): UpgradeProduct[] {
  const adjusted = raw.map((o) => adjustForSets(o, item));
  const sane = adjusted.filter((o) => isSaneUpgrade(o, originalPrice));
  const deduped = deduplicateByTitle(sane);
  let picked = selectBestThree(deduped, originalPrice);
  picked.sort((a, b) => a.price - b.price);
  picked = dropEntryIfTooCloseToMid(picked);
  picked.sort((a, b) => a.price - b.price);
  return picked;
}

function displayTitleForCard(title: string): string {
  return title.length > 45 ? `${title.slice(0, 42)}...` : title;
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
  isPanelOpen,
  onClose,
}: {
  item: ClaimItem;
  locked: boolean;
  cacheHas: boolean;
  onApply: (option: UpgradeOption) => Promise<void>;
  onApplied?: () => void;
  onRefreshNotice?: (message: string) => void;
  onCatalogEmpty?: () => void;
  /** When true, panel listens for outside clicks to call onClose */
  isPanelOpen?: boolean;
  onClose?: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [rawProducts, setRawProducts] = useState<UpgradeProduct[]>([]);
  const [customPrice, setCustomPrice] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [applying, setApplying] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const baseUnit =
    item.source === "upgrade" && item.pre_upgrade_item ? item.pre_upgrade_item.unit_cost : item.unit_cost;
  const isUpgradedLine = item.source === "upgrade" && !!item.pre_upgrade_item;
  const origDesc = item.pre_upgrade_item?.description ?? item.description;
  const itemBrand = item.brand || "";

  const displayOptions = useMemo(
    () => buildDisplayOptions(rawProducts, item, baseUnit),
    [rawProducts, item, baseUnit]
  );

  const tierLabelList = useMemo(() => tierLabels(displayOptions.length), [displayOptions.length]);

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

  const applyResponseJson = useCallback((j: Record<string, unknown>) => {
    const sets = setsFromResponse(j);
    const flat = flattenOptionSets(sets);
    setRawProducts(flat);
  }, []);

  useEffect(() => {
    setCustomDesc(item.description);
  }, [item.description]);

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
    if (!isPanelOpen || !onClose) return;
    const onCloseFn: () => void = onClose;
    let cancelled = false;
    let removeListener: (() => void) | undefined;
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      function handleMouseDown(e: MouseEvent) {
        const el = panelRef.current;
        if (!el) return;
        if (el.contains(e.target as Node)) return;
        onCloseFn();
      }
      document.addEventListener("mousedown", handleMouseDown);
      removeListener = () => document.removeEventListener("mousedown", handleMouseDown);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      removeListener?.();
    };
  }, [isPanelOpen, onClose]);

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
    "relative flex min-w-0 flex-1 flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md";
  const cardOn = "border-2 border-[#2563EB] bg-blue-50/80 shadow-md";

  function isCardSelected(opt: UpgradeProduct): boolean {
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

  if (!loading && !refreshing && displayOptions.length === 0) {
    return (
      <div ref={panelRef} className="relative space-y-4 pt-2" role="region" aria-label="Upgrade options">
        <button
          type="button"
          onClick={() => onClose?.()}
          className="absolute right-0 top-0 z-10 rounded-lg p-2 text-lg leading-none text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          aria-label="Close upgrade panel"
        >
          ✕
        </button>
        <div className="pr-10">
          <p className="text-center text-sm font-medium text-[#6B7280] md:text-left">
            Finding alternatives…
          </p>
          <p className="mt-1 text-center text-xs text-[#6B7280] md:text-left">
            No retail matches passed quality checks yet. Try refresh or enter a custom replacement below.
          </p>
          <div className="mt-4 flex justify-center md:justify-start">
            <button
              type="button"
              disabled={refreshing || applying}
              onClick={() => void handleRefresh()}
              className="inline-flex min-h-[48px] shrink-0 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-xs font-semibold text-[#6B7280] transition hover:border-[#2563EB] hover:text-[#2563EB] disabled:opacity-50"
            >
              {refreshing ? (
                <>
                  <SmallSpinner />
                  Refreshing…
                </>
              ) : (
                <>↻ Refresh search</>
              )}
            </button>
          </div>
        </div>
        <NoCacheUpgradeForm
          item={item}
          message="Or add your own replacement:"
          startOpen
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
      </div>
    );
  }

  return (
    <div
      ref={panelRef}
      className="upgrade-accordion relative space-y-6 pt-2"
      role="region"
      aria-label="Upgrade options"
    >
      <button
        type="button"
        onClick={() => onClose?.()}
        className="absolute right-0 top-0 z-10 rounded-lg p-2 text-lg leading-none text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
        aria-label="Close upgrade panel"
      >
        ✕
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 pr-10">
        <p className="text-sm text-[#6B7280]">
          Choose your upgrade for{" "}
          <span className="font-semibold text-gray-900">{cleanDescription(origDesc)}</span>:
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
          {displayOptions.length > 0 ? (
            <span className="text-[11px] text-[#6B7280]">{displayOptions.length} options shown</span>
          ) : null}
        </div>
      </div>

      <div className={`grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 ${refreshing ? "opacity-60" : ""}`}>
        {displayOptions.map((opt, idx) => {
          const tierLabel = tierLabelList[idx] ?? "";
          const href = opt.url?.trim() ? opt.url.trim() : fallbackShopUrl(opt.title);
          const displayTitle = displayTitleForCard(opt.title);
          return (
            <div key={normKey(opt.title, opt.price)} className={`${cardBase} ${isCardSelected(opt) ? cardOn : ""}`}>
              <p className="text-xs font-bold uppercase tracking-wide text-[#2563EB]">{tierLabel}</p>
              <div
                className="mt-2 text-[15px] font-semibold leading-snug text-gray-900 [overflow-wrap:anywhere]"
                title={cleanDescription(opt.title)}
              >
                {cleanDescription(displayTitle)}
              </div>
              <p className="mt-2 text-sm font-medium text-gray-800">{(opt.brand || itemBrand).trim() || "—"}</p>
              <p className="mt-1 text-xs font-medium text-[#6B7280]">
                {(opt.retailer || "").trim() || "Search online"}
              </p>
              <p className="mt-4 text-[22px] font-bold text-blue-600 tabular-nums">
                {item.qty > 1 ? (
                  <>
                    {formatCurrency(opt.price)}
                    <span className="text-base font-semibold text-slate-600"> each</span>
                  </>
                ) : (
                  formatCurrency(opt.price)
                )}
              </p>
              {item.qty > 1 ? (
                <p className="mt-1 text-sm font-semibold tabular-nums text-slate-700">
                  ×{item.qty} = {formatCurrency(opt.price * item.qty)}
                </p>
              ) : null}
              <p className="text-sm font-semibold text-[#16A34A] tabular-nums">
                +{formatCurrency((opt.price - baseUnit) * item.qty)}
              </p>
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs font-semibold text-[#2563EB] underline"
              >
                View ↗
              </a>
              <button
                type="button"
                disabled={applying || refreshing}
                onClick={() =>
                  runApply(
                    onApply({
                      label: tierLabel,
                      price: opt.price,
                      title: opt.title,
                      brand: (opt.brand || itemBrand).trim(),
                      model: opt.model || "",
                      retailer: (opt.retailer || "").trim() || "Search online",
                      url: href,
                    })
                  )
                }
                className="mt-4 h-10 w-full rounded-lg bg-[#2563EB] text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-40"
              >
                Select
              </button>
            </div>
          );
        })}
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
                    url: fallbackShopUrl(customDesc.trim() || origDesc),
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
