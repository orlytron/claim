"use client";

import { useEffect, useState } from "react";
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

const ENTRY_TITLE_PREFIX = "Entry upgrade —";

type UpgradeProduct = {
  title: string;
  brand: string;
  model: string;
  price: number;
  retailer: string;
  url: string;
};

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
}: {
  item: ClaimItem;
  locked: boolean;
  cacheHas: boolean;
  onApply: (option: UpgradeOption) => Promise<void>;
  onApplied?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ mid: UpgradeProduct; premium: UpgradeProduct | null } | null>(null);
  const [customPrice, setCustomPrice] = useState("");
  const [customDesc, setCustomDesc] = useState("");
  const [applying, setApplying] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);

  const baseUnit =
    item.source === "upgrade" && item.pre_upgrade_item ? item.pre_upgrade_item.unit_cost : item.unit_cost;
  const isUpgradedLine = item.source === "upgrade" && !!item.pre_upgrade_item;
  const origDesc = item.pre_upgrade_item?.description ?? item.description;

  useEffect(() => {
    setCustomDesc(item.description);
  }, [item.description]);

  useEffect(() => {
    if (!cacheHas || locked) return;
    let cancelled = false;
    const descForApi =
      item.source === "upgrade" ? item.description : item.pre_upgrade_item?.description ?? item.description;
    const priceForApi =
      item.source === "upgrade" ? item.unit_cost : item.pre_upgrade_item?.unit_cost ?? item.unit_cost;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/search-upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_description: descForApi,
            brand: item.brand || "",
            current_price: priceForApi,
            category: item.category || "",
          }),
        });
        if (!res.ok) throw new Error("fetch");
        const j = (await res.json()) as {
          mid?: UpgradeProduct;
          premium?: UpgradeProduct | null;
        };
        if (!cancelled && j.mid) {
          const prem = j.premium && typeof j.premium === "object" && j.premium.price > 0 ? j.premium : null;
          setData({ mid: j.mid, premium: prem });
        } else if (!cancelled) setData(null);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    cacheHas,
    locked,
    item.brand,
    item.category,
    item.description,
    item.unit_cost,
    item.source,
    item.pre_upgrade_item?.description,
    item.pre_upgrade_item?.unit_cost,
  ]);

  const customOk = parseFloat(customPrice) > 0;
  const entryUnitPrice = data?.mid ? Math.round(data.mid.price * 0.75) : 0;
  const showEntry = !!data?.mid && entryUnitPrice > baseUnit * 1.15;
  const showPremium = !!data?.mid && !!data.premium && data.premium.price > data.mid.price;

  const entrySelected = isUpgradedLine && item.description.startsWith(ENTRY_TITLE_PREFIX);
  const midSelected =
    isUpgradedLine &&
    !entrySelected &&
    !!data &&
    Math.abs(item.unit_cost - data.mid.price) < 0.01 &&
    item.description === data.mid.title;
  const premSelected =
    isUpgradedLine &&
    !!data?.premium &&
    Math.abs(item.unit_cost - data.premium.price) < 0.01 &&
    item.description === data.premium.title;

  function runApply(p: Promise<void>) {
    if (applying) return;
    setApplying(true);
    void p
      .then(() => onApplied?.())
      .finally(() => setApplying(false));
  }

  const cardBase =
    "flex flex-col rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md";
  const cardOn = "border-2 border-[#2563EB] bg-blue-50/80 shadow-md";

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

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-12 text-[#6B7280]">
        <SmallSpinner /> Loading options…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-[#6B7280]">
        Choose your upgrade for{" "}
        <span className="font-semibold text-gray-900">{origDesc}</span>:
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        {showEntry && data?.mid && (
          <div className={`${cardBase} ${entrySelected ? cardOn : ""}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">Entry</p>
            <p className="mt-2 text-[15px] font-semibold leading-snug text-gray-900 [overflow-wrap:anywhere]">
              {data.mid.title || "Entry upgrade"}
            </p>
            <p className="mt-1 text-xs text-[#6B7280]">{data.mid.brand || item.brand || "—"}</p>
            <p className="mt-4 text-[22px] font-bold text-blue-600 tabular-nums">
              {formatCurrency(entryUnitPrice * item.qty)}
            </p>
            <p className="text-sm font-semibold text-[#16A34A] tabular-nums">
              +{formatCurrency((entryUnitPrice - baseUnit) * item.qty)}
            </p>
            <button
              type="button"
              disabled={applying}
              onClick={() =>
                runApply(
                  onApply({
                    label: "Entry",
                    price: entryUnitPrice,
                    title: `${ENTRY_TITLE_PREFIX} ${origDesc}`.slice(0, 240),
                    brand: data.mid.brand || item.brand,
                    model: "",
                    retailer: "",
                    url: "",
                  })
                )
              }
              className="mt-auto h-10 w-full rounded-lg bg-[#2563EB] text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-40"
            >
              Select
            </button>
          </div>
        )}

        {data?.mid && (
          <div className={`${cardBase} ${midSelected ? cardOn : ""}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">
              Mid <span className="text-amber-500">★</span>
            </p>
            <p className="mt-2 text-[15px] font-semibold leading-snug text-gray-900 [overflow-wrap:anywhere]">
              {data.mid.title}
            </p>
            <p className="mt-1 text-xs text-[#6B7280]">
              {[data.mid.brand, data.mid.retailer].filter(Boolean).join(" · ") || "—"}
            </p>
            <p className="mt-4 text-[22px] font-bold text-blue-600 tabular-nums">
              {formatCurrency(data.mid.price * item.qty)}
            </p>
            <p className="text-sm font-semibold text-[#16A34A] tabular-nums">
              +{formatCurrency((data.mid.price - baseUnit) * item.qty)}
            </p>
            {data.mid.url ? (
              <a
                href={data.mid.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 text-xs font-semibold text-[#2563EB] underline"
              >
                View ↗
              </a>
            ) : null}
            <button
              type="button"
              disabled={applying}
              onClick={() =>
                runApply(
                  onApply({
                    label: "Mid",
                    price: data.mid.price,
                    title: data.mid.title,
                    brand: data.mid.brand,
                    model: data.mid.model,
                    retailer: data.mid.retailer,
                    url: data.mid.url,
                  })
                )
              }
              className="mt-4 h-10 w-full rounded-lg bg-[#2563EB] text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-40"
            >
              Select
            </button>
          </div>
        )}

        {showPremium && data?.premium && (
          <div className={`${cardBase} ${premSelected ? cardOn : ""}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">Premium</p>
            <p className="mt-2 text-[15px] font-semibold leading-snug text-gray-900 [overflow-wrap:anywhere]">
              {data.premium.title}
            </p>
            <p className="mt-1 text-xs text-[#6B7280]">
              {[data.premium.brand, data.premium.retailer].filter(Boolean).join(" · ") || "—"}
            </p>
            <p className="mt-4 text-[22px] font-bold text-blue-600 tabular-nums">
              {formatCurrency(data.premium.price * item.qty)}
            </p>
            <p className="text-sm font-semibold text-[#16A34A] tabular-nums">
              +{formatCurrency((data.premium.price - baseUnit) * item.qty)}
            </p>
            {data.premium.url ? (
              <a
                href={data.premium.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 text-xs font-semibold text-[#2563EB] underline"
              >
                View ↗
              </a>
            ) : null}
            <button
              type="button"
              disabled={applying}
              onClick={() =>
                runApply(
                  onApply({
                    label: "Premium",
                    price: data.premium!.price,
                    title: data.premium!.title,
                    brand: data.premium!.brand,
                    model: data.premium!.model,
                    retailer: data.premium!.retailer,
                    url: data.premium!.url,
                  })
                )
              }
              className="mt-4 h-10 w-full rounded-lg bg-[#2563EB] text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-40"
            >
              Select
            </button>
          </div>
        )}
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
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
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
              disabled={applying || !customOk}
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
