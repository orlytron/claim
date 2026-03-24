"use client";

import { useState } from "react";
import type { ClaimItem } from "../lib/types";
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
};

export default function SmartLookup({ roomName, onAdd, disabled }: SmartLookupProps) {
  const [query, setQuery] = useState("");
  const [qty, setQty] = useState("1");
  const [status, setStatus] = useState<"idle" | "loading" | "results">("idle");
  const [results, setResults] = useState<LookupResult[]>([]);
  const [customDesc, setCustomDesc] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [customPrice, setCustomPrice] = useState("");

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
            }}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Clear ×
          </button>
        </div>

        <div
          className="grid border-b border-gray-100 bg-gray-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-400"
          style={{ gridTemplateColumns: "70px 1fr 100px 60px 80px 80px 60px" }}
        >
          <span>Tier</span>
          <span>Item</span>
          <span>Brand</span>
          <span>Age</span>
          <span>Condition</span>
          <span className="text-right">Price ea</span>
          <span />
        </div>

        {results.map((r, i) => (
          <div
            key={i}
            className="grid items-center border-b border-gray-100 px-4 py-3 text-sm transition-colors hover:bg-blue-50/30"
            style={{ gridTemplateColumns: "70px 1fr 100px 60px 80px 80px 60px" }}
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
            <button
              type="button"
              disabled={disabled}
              onClick={() => addResult(r)}
              className="rounded-lg bg-[#2563EB] px-2 py-1.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40"
            >
              + Add
            </button>
          </div>
        ))}

        <div
          className="grid items-center gap-2 bg-gray-50/50 px-4 py-3"
          style={{ gridTemplateColumns: "70px 1fr 100px 60px 80px 80px 60px" }}
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
            className="rounded border border-gray-200 bg-white px-2 py-1.5 text-right text-xs tabular-nums"
          />
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
            + Add
          </button>
        </div>

        <div className="border-t border-gray-100 px-4 py-3">
          <button
            type="button"
            onClick={() => {
              setStatus("idle");
              setResults([]);
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
