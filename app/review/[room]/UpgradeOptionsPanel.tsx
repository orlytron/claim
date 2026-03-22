"use client";

import { useCallback, useEffect, useState } from "react";
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

export const ENTRY_TITLE_PREFIX = "Entry upgrade —";
export const ENTRY_PLUS_TITLE_PREFIX = "Entry+ upgrade —";

type UpgradeProduct = {
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

function NoCacheUpgradeForm({
  item,
  onAddCustom,
}: {
  item: ClaimItem;
  onAddCustom: (price: number, title: string, brand: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [title, setTitle] = useState(item.description);
  const [brand, setBrand] = useState(item.brand || "");
  const [saving, setSaving] = useState(false);

  return (
    <div className="rounded-xl border border-dashed border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-[#6B7280]">No catalog match yet — add a custom replacement.</p>
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
}: {
  item: ClaimItem;
  locked: boolean;
  cacheHas: boolean;
  onApply: (option: UpgradeOption) => Promise<void>;
  onApplied?: () => void;
  onRefreshNotice?: (message: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [optionSets, setOptionSets] = useState<UpgradeOptionSet[]>([]);
  const [activeSetIndex, setActiveSetIndex] = useState(0);
  const [customPrice, setCustomPrice] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [applying, setApplying] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const baseUnit =
    item.source === "upgrade" && item.pre_upgrade_item ? item.pre_upgrade_item.unit_cost : item.unit_cost;
  const isUpgradedLine = item.source === "upgrade" && !!item.pre_upgrade_item;
  const origDesc = item.pre_upgrade_item?.description ?? item.description;

  const activeSet = optionSets[Math.min(activeSetIndex, Math.max(0, optionSets.length - 1))] ?? null;
  const mid = activeSet?.mid ?? null;
  const premium = activeSet?.premium ?? null;

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
    const sets = j.optionSets as UpgradeOptionSet[] | undefined;
    if (Array.isArray(sets) && sets.length > 0) {
      const normalized = sets
        .map((s) => {
          if (!s?.mid?.price) return null;
          const prem =
            s.premium && typeof s.premium === "object" && (s.premium as UpgradeProduct).price > 0
              ? (s.premium as UpgradeProduct)
              : null;
          return { mid: s.mid as UpgradeProduct, premium: prem };
        })
        .filter(Boolean) as UpgradeOptionSet[];
      if (normalized.length) {
        setOptionSets(normalized);
        setActiveSetIndex((i) => Math.min(i, normalized.length - 1));
        return;
      }
    }
    const m = j.mid as UpgradeProduct | undefined;
    if (m?.price) {
      const p = j.premium as UpgradeProduct | null | undefined;
      const prem = p && p.price > 0 ? p : null;
      setOptionSets([{ mid: m, premium: prem }]);
      setActiveSetIndex(0);
    } else {
      setOptionSets([]);
    }
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
        if (!cancelled) setOptionSets([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cacheHas, locked, fetchPayload, applyResponseJson]);

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
      const count = Array.isArray(j.optionSets) ? (j.optionSets as unknown[]).length * 2 : 2;
      onRefreshNotice?.(`Updated! ${count} options loaded`);
    } catch {
      onRefreshNotice?.("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, [locked, fetchPayload, applyResponseJson, onRefreshNotice]);

  const entryUnitPrice = mid ? Math.round(mid.price * 0.7) : 0;
  const entryPlusUnitPrice = mid ? Math.round(mid.price * 0.85) : 0;
  const showEntry = !!mid && entryUnitPrice > baseUnit * 1.15;
  const showEntryPlus = !!mid && entryPlusUnitPrice > baseUnit * 1.15;
  const showPremium = !!mid && !!premium && premium.price > mid.price;

  const entrySelected = isUpgradedLine && item.description.startsWith(ENTRY_TITLE_PREFIX);
  const entryPlusSelected = isUpgradedLine && item.description.startsWith(ENTRY_PLUS_TITLE_PREFIX);
  const midSelected =
    isUpgradedLine &&
    !entrySelected &&
    !entryPlusSelected &&
    !!mid &&
    Math.abs(item.unit_cost - mid.price) < 0.01 &&
    item.description === mid.title;
  const premSelected =
    isUpgradedLine &&
    !!premium &&
    Math.abs(item.unit_cost - premium.price) < 0.01 &&
    item.description === premium.title;

  function runApply(p: Promise<void>) {
    if (applying) return;
    setApplying(true);
    void p
      .then(() => onApplied?.())
      .finally(() => setApplying(false));
  }

  const cardBase =
    "flex min-w-[140px] flex-1 flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md md:min-w-0";
  const cardOn = "border-2 border-[#2563EB] bg-blue-50/80 shadow-md";

  const totalOptionProducts = optionSets.length * 2;

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

  if (loading && !refreshing && optionSets.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-[#6B7280]">
        <SmallSpinner /> Loading options…
      </div>
    );
  }

  const brandLine = mid?.brand || item.brand || "—";

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
          {totalOptionProducts > 0 ? (
            <span className="text-[11px] text-[#6B7280]">{totalOptionProducts} options loaded</span>
          ) : null}
        </div>
      </div>

      {optionSets.length > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B7280]">
          <span>
            Suggestion set {activeSetIndex + 1} of {optionSets.length}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={activeSetIndex <= 0}
              onClick={() => setActiveSetIndex((i) => Math.max(0, i - 1))}
              className="rounded-md border border-gray-200 px-2 py-1 font-medium hover:bg-gray-50 disabled:opacity-40"
            >
              ← Previous
            </button>
            <button
              type="button"
              disabled={activeSetIndex >= optionSets.length - 1}
              onClick={() => setActiveSetIndex((i) => Math.min(optionSets.length - 1, i + 1))}
              className="rounded-md border border-gray-200 px-2 py-1 font-medium hover:bg-gray-50 disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      ) : null}

      <div className={`grid grid-cols-2 gap-4 md:grid-cols-4 ${refreshing ? "opacity-60" : ""}`}>
          {showEntry && mid ? (
            <div className={`${cardBase} ${entrySelected ? cardOn : ""}`}>
              <p className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">Entry</p>
              <p className="mt-3 text-[15px] font-semibold text-gray-900">{brandLine}</p>
              <p className="mt-1 text-sm text-[#6B7280]">Similar model</p>
              <p className="mt-4 text-[22px] font-bold text-blue-600 tabular-nums">
                {formatCurrency(entryUnitPrice * item.qty)}
              </p>
              <p className="text-sm font-semibold text-[#16A34A] tabular-nums">
                +{formatCurrency((entryUnitPrice - baseUnit) * item.qty)}
              </p>
              <button
                type="button"
                disabled={applying || refreshing}
                onClick={() =>
                  runApply(
                    onApply({
                      label: "Entry",
                      price: entryUnitPrice,
                      title: `${ENTRY_TITLE_PREFIX} ${origDesc}`.slice(0, 240),
                      brand: mid.brand || item.brand,
                      model: "",
                      retailer: mid.retailer || "",
                      url: "",
                    })
                  )
                }
                className="mt-auto h-10 w-full rounded-lg bg-[#2563EB] text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-40"
              >
                Select
              </button>
            </div>
          ) : null}

          {showEntryPlus && mid ? (
            <div className={`${cardBase} ${entryPlusSelected ? cardOn : ""}`}>
              <p className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">Entry+</p>
              <p className="mt-3 text-[15px] font-semibold text-gray-900">{brandLine}</p>
              <p className="mt-1 text-sm text-[#6B7280]">Similar model</p>
              <p className="mt-4 text-[22px] font-bold text-blue-600 tabular-nums">
                {formatCurrency(entryPlusUnitPrice * item.qty)}
              </p>
              <p className="text-sm font-semibold text-[#16A34A] tabular-nums">
                +{formatCurrency((entryPlusUnitPrice - baseUnit) * item.qty)}
              </p>
              <button
                type="button"
                disabled={applying || refreshing}
                onClick={() =>
                  runApply(
                    onApply({
                      label: "Entry+",
                      price: entryPlusUnitPrice,
                      title: `${ENTRY_PLUS_TITLE_PREFIX} ${origDesc}`.slice(0, 240),
                      brand: mid.brand || item.brand,
                      model: "",
                      retailer: mid.retailer || "",
                      url: "",
                    })
                  )
                }
                className="mt-auto h-10 w-full rounded-lg bg-[#2563EB] text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-40"
              >
                Select
              </button>
            </div>
          ) : null}

          {mid ? (
            <div className={`${cardBase} ${midSelected ? cardOn : ""}`}>
              <p className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">
                Mid <span className="text-amber-500">★</span>
              </p>
              <p className="mt-2 text-[15px] font-semibold leading-snug text-gray-900 [overflow-wrap:anywhere]">
                {mid.title}
              </p>
              <p className="mt-1 text-xs text-[#6B7280]">
                {[mid.brand, mid.retailer].filter(Boolean).join(" · ") || "—"}
              </p>
              <p className="mt-4 text-[22px] font-bold text-blue-600 tabular-nums">
                {formatCurrency(mid.price * item.qty)}
              </p>
              <p className="text-sm font-semibold text-[#16A34A] tabular-nums">
                +{formatCurrency((mid.price - baseUnit) * item.qty)}
              </p>
              {mid.url ? (
                <a
                  href={mid.url}
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
                      label: "Mid",
                      price: mid.price,
                      title: mid.title,
                      brand: mid.brand,
                      model: mid.model,
                      retailer: mid.retailer,
                      url: mid.url,
                    })
                  )
                }
                className="mt-4 h-10 w-full rounded-lg bg-[#2563EB] text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-40"
              >
                Select
              </button>
            </div>
          ) : null}

          {showPremium && premium ? (
            <div className={`${cardBase} ${premSelected ? cardOn : ""}`}>
              <p className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">Premium</p>
              <p className="mt-2 text-[15px] font-semibold leading-snug text-gray-900 [overflow-wrap:anywhere]">
                {premium.title}
              </p>
              <p className="mt-1 text-xs text-[#6B7280]">
                {[premium.brand, premium.retailer].filter(Boolean).join(" · ") || "—"}
              </p>
              <p className="mt-4 text-[22px] font-bold text-blue-600 tabular-nums">
                {formatCurrency(premium.price * item.qty)}
              </p>
              <p className="text-sm font-semibold text-[#16A34A] tabular-nums">
                +{formatCurrency((premium.price - baseUnit) * item.qty)}
              </p>
              {premium.url ? (
                <a
                  href={premium.url}
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
                      label: "Premium",
                      price: premium.price,
                      title: premium.title,
                      brand: premium.brand,
                      model: premium.model,
                      retailer: premium.retailer,
                      url: premium.url,
                    })
                  )
                }
                className="mt-4 h-10 w-full rounded-lg bg-[#2563EB] text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-40"
              >
                Select
              </button>
            </div>
          ) : null}
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
