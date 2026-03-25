"use client";

import { Fragment, useState } from "react";
import type { BundleItem } from "../lib/bundles-data";
import type { ClaimItem } from "../lib/types";
import type { SmartItemRequestBundleJson } from "../lib/smart-item-request";
import { formatCurrency } from "../lib/utils";

export type LookupResult = {
  tier: string;
  brand: string;
  description: string;
  model: string;
  unit_cost: number;
  age_years: number;
  condition: string;
  category: string;
};

type SmartLookupProps = {
  roomName: string;
  onAdd: (items: ClaimItem[]) => void;
  disabled?: boolean;
  sessionId?: string;
  existingItems?: ClaimItem[];
};

const RESULT_GRID = "70px 1fr 100px 60px 80px 80px 120px";

function normalizeBundleLineFromApi(raw: unknown): BundleItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const qty = Math.max(1, Math.round(Number(o.qty) || 1));
  const unit_cost = Math.round((Number(o.unit_cost) || 0) * 100) / 100;
  const description = String(o.description ?? "").trim() || "Item";
  const brand = String(o.brand ?? "").trim();
  const category = String(o.category ?? "Other").trim() || "Other";
  return {
    description,
    brand,
    qty,
    unit_cost,
    total: Math.round(unit_cost * qty * 100) / 100,
    category,
  };
}

export default function SmartLookup({
  roomName,
  onAdd,
  disabled,
  sessionId = "trial",
  existingItems = [],
}: SmartLookupProps) {
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState("1");
  const [status, setStatus] = useState<"idle" | "loading" | "results">("idle");
  const [results, setResults] = useState<LookupResult[]>([]);
  const [customDesc, setCustomDesc] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [bundleRowLoading, setBundleRowLoading] = useState<number | null>(null);
  const [bundleRowItems, setBundleRowItems] = useState<Record<number, BundleItem[]>>({});

  async function handleSearch() {
    if (!query.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch("/api/smart-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: query.trim(),
          qty: parseInt(qty, 10) || 1,
          room: roomName,
        }),
      });
      const data = (await res.json()) as { results?: LookupResult[]; error?: string };
      if (!res.ok) {
        setStatus("idle");
        return;
      }
      const list = data.results ?? [];
      setResults(list);
      setStatus("results");
      setBundleRowItems({});
      setBundleRowLoading(null);
      if (list[1]) {
        setCustomDesc(list[1].description);
        setCustomBrand(list[1].brand);
        setCustomPrice(String(list[1].unit_cost));
      } else if (list[0]) {
        setCustomDesc(list[0].description);
        setCustomBrand(list[0].brand);
        setCustomPrice(String(list[0].unit_cost));
      }
    } catch {
      setStatus("idle");
    }
  }

  function addResult(r: LookupResult) {
    const q = parseInt(qty, 10) || 1;
    onAdd([
      {
        room: roomName,
        description: r.description,
        brand: r.brand,
        model: r.model,
        qty: q,
        unit_cost: r.unit_cost,
        age_years: r.age_years,
        age_months: 0,
        condition: r.condition,
        category: r.category,
        source: "bundle",
      },
    ]);
  }

  async function fetchBundleForRow(r: LookupResult, rowIndex: number) {
    setBundleRowLoading(rowIndex);
    try {
      const searchTerm = `${r.brand || ""} ${r.description}`.trim();
      const res = await fetch("/api/smart-item-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: `Generate items that go with: ${searchTerm}. Focus on related accessories, supplies and complementary items. Room: ${roomName}`,
          room: roomName,
          existingItems: existingItems.slice(0, 10),
          sessionId,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { success?: boolean; bundle?: SmartItemRequestBundleJson };
      if (!data.success || !data.bundle) return;
      const rawItems = data.bundle.tiers?.complete?.items;
      const related = (Array.isArray(rawItems) ? rawItems : [])
        .map(normalizeBundleLineFromApi)
        .filter((x): x is BundleItem => x != null)
        .slice(0, 8);
      setBundleRowItems((prev) => ({ ...prev, [rowIndex]: related }));
    } catch {
      // fail silently
    } finally {
      setBundleRowLoading(null);
    }
  }

  if (status === "loading") {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-900 border-t-transparent" />
          <p className="text-sm text-gray-600">Finding {query} options...</p>
        </div>
      </div>
    );
  }

  if (status === "results") {
    return (
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
          <p className="text-sm font-semibold text-gray-900">
            Results for &quot;{query}&quot; ×{qty}
          </p>
          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setQuery("");
              setResults([]);
              setCustomDesc("");
              setCustomBrand("");
              setCustomPrice("");
              setBundleRowItems({});
              setBundleRowLoading(null);
            }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Clear ×
          </button>
        </div>

        <div
          className="grid border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-400"
          style={{ gridTemplateColumns: RESULT_GRID }}
        >
          <span>Tier</span>
          <span>Item</span>
          <span>Brand</span>
          <span>Age</span>
          <span>Condition</span>
          <span className="text-right">Price ea</span>
          <span className="text-right">Actions</span>
        </div>

        {results.map((r, i) => (
          <Fragment key={i}>
            <div
              className="grid items-center border-b border-gray-100 px-4 py-3 text-sm transition-colors hover:bg-blue-50/30"
              style={{ gridTemplateColumns: RESULT_GRID }}
            >
              <span
                className={`w-fit rounded-full px-2 py-0.5 text-xs font-bold ${
                  /^basic$/i.test(r.tier)
                    ? "bg-gray-100 text-gray-600"
                    : /^mid$/i.test(r.tier)
                      ? "bg-blue-100 text-blue-700"
                      : "bg-amber-100 text-amber-700"
                }`}
              >
                {r.tier}
              </span>
              <span className="truncate pr-2 font-medium text-gray-900">{r.description}</span>
              <span className="truncate text-xs text-gray-500">{r.brand}</span>
              <span className="text-xs tabular-nums text-gray-400">
                {r.age_years > 0 ? `${r.age_years}yr` : "New"}
              </span>
              <span className="text-xs text-gray-500">{r.condition}</span>
              <span className="text-right text-sm font-semibold tabular-nums text-gray-900">
                {formatCurrency(r.unit_cost)}
              </span>
              <div className="flex flex-wrap items-center justify-end gap-1">
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => addResult(r)}
                  className="rounded-md border border-gray-200 bg-white px-2 py-1 text-xs font-bold text-gray-800 hover:bg-gray-50 disabled:opacity-40"
                >
                  [Add]
                </button>
                <button
                  type="button"
                  disabled={disabled || bundleRowLoading === i}
                  onClick={() => void fetchBundleForRow(r, i)}
                  className="rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-40"
                >
                  {bundleRowLoading === i ? "…" : "[Bundle]"}
                </button>
              </div>
            </div>

            {bundleRowLoading === i ? (
              <div className="flex items-center gap-2 border-b border-blue-100 bg-blue-50/40 px-4 py-2.5 text-xs text-gray-600">
                <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-400 border-t-transparent" />
                Finding related items for this line…
              </div>
            ) : null}

            {bundleRowItems[i] && bundleRowItems[i].length > 0 ? (
              <div className="space-y-1 border-b border-gray-100 bg-gray-50/90 px-4 py-3">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Bundle — related items</p>
                {bundleRowItems[i].map((bi, j) => (
                  <div
                    key={j}
                    className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    <span className="flex-1 truncate font-medium text-gray-800">{bi.description}</span>
                    <span className="shrink-0 text-xs text-gray-400">{bi.brand || "Unbranded"}</span>
                    <span className="w-20 shrink-0 text-right text-xs font-semibold tabular-nums text-gray-700">
                      {formatCurrency(bi.unit_cost)}
                    </span>
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() =>
                        onAdd([
                          {
                            room: roomName,
                            description: bi.description,
                            brand: bi.brand || "",
                            model: "",
                            qty: bi.qty || 1,
                            unit_cost: bi.unit_cost,
                            age_years: 0,
                            age_months: 0,
                            condition: "New",
                            category: bi.category || "Other",
                            source: "bundle",
                          },
                        ])
                      }
                      className="shrink-0 rounded-lg bg-[#2563EB] px-2.5 py-1 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40"
                    >
                      + Add
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setBundleRowItems((prev) => {
                      const next = { ...prev };
                      delete next[i];
                      return next;
                    })
                  }
                  className="mt-1 text-xs text-gray-400 hover:text-gray-600"
                >
                  Dismiss bundle
                </button>
              </div>
            ) : null}
          </Fragment>
        ))}

        <div
          className="grid items-center gap-2 bg-gray-50/50 px-4 py-3"
          style={{ gridTemplateColumns: RESULT_GRID }}
        >
          <span className="text-xs font-bold uppercase text-gray-400">Custom</span>
          <input
            placeholder="Description"
            value={customDesc}
            onChange={(e) => setCustomDesc(e.target.value)}
            className="rounded border border-gray-200 bg-white px-2 py-1.5 text-xs"
          />
          <input
            placeholder="Brand"
            value={customBrand}
            onChange={(e) => setCustomBrand(e.target.value)}
            className="rounded border border-gray-200 bg-white px-2 py-1.5 text-xs"
          />
          <span />
          <span />
          <input
            placeholder="$Price"
            value={customPrice}
            onChange={(e) => setCustomPrice(e.target.value)}
            className="rounded border border-gray-200 bg-white py-1.5 text-right text-xs tabular-nums"
          />
          <div className="flex justify-end">
            <button
              type="button"
              disabled={!customDesc.trim() || disabled}
              onClick={() => {
                const price = parseFloat(customPrice.replace(/[^0-9.]/g, "")) || 0;
                onAdd([
                  {
                    room: roomName,
                    description: customDesc.trim(),
                    brand: customBrand.trim(),
                    model: "",
                    qty: parseInt(qty, 10) || 1,
                    unit_cost: price,
                    age_years: 0,
                    age_months: 0,
                    condition: "New",
                    category: "Other",
                    source: "bundle",
                  },
                ]);
                setCustomDesc("");
                setCustomBrand("");
                setCustomPrice("");
              }}
              className="rounded-lg bg-gray-800 px-2 py-1.5 text-xs font-bold text-white disabled:opacity-40"
            >
              [Add]
            </button>
          </div>
        </div>

        <div className="border-t border-gray-100 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setResults([]);
              setBundleRowItems({});
              setBundleRowLoading(null);
            }}
            className="text-sm font-medium text-[#2563EB] hover:underline"
          >
            ← Search for something else
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">🔍 Smart Lookup</p>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="What item? e.g. surfboard"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSearch();
          }}
          className="min-w-[160px] flex-[3] rounded-lg border border-gray-200 px-3 py-2.5 text-sm placeholder-gray-400"
        />
        <input
          type="number"
          min={1}
          placeholder="How many?"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          className="w-28 rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
        />
        <button
          type="button"
          disabled={!query.trim() || disabled}
          onClick={() => void handleSearch()}
          className="rounded-lg bg-gray-900 px-4 py-2.5 text-sm font-bold text-white hover:bg-gray-700 disabled:opacity-40"
        >
          Search →
        </button>
      </div>
    </div>
  );
}
