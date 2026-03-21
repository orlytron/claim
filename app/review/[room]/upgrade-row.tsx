"use client";

import { useState } from "react";
import type { ClaimItem } from "../../lib/types";
import { generateItemId, formatCurrency } from "../../lib/utils";

interface UpgradeProduct {
  title: string;
  brand: string;
  model: string;
  price: number;
  retailer: string;
  url: string;
  thumbnail?: string;
}

export interface UpgradeOption {
  label: string;
  price: number;
  title: string;
  brand: string;
  model: string;
  retailer: string;
  url: string;
}

function SmallSpinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function ageLabel(item: ClaimItem): string {
  const y = item.age_years ?? 0;
  if (y <= 0) return "New / Less than 1 year";
  return `${y} years old`;
}

export function RoomUpgradeRow({
  item,
  cacheHas,
  onUpgrade,
}: {
  item: ClaimItem;
  cacheHas: boolean;
  onUpgrade: (item: ClaimItem, option: UpgradeOption) => Promise<void>;
}) {
  const [rightOpen, setRightOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [upgradeResult, setUpgradeResult] = useState<{ mid: UpgradeProduct; premium: UpgradeProduct } | null>(null);
  const [choice, setChoice] = useState<"keep" | "mid" | "premium" | "custom">("keep");
  const [customDesc, setCustomDesc] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [applying, setApplying] = useState(false);

  const customValid = customDesc.trim().length > 0 && parseFloat(customPrice) > 0;
  const prev = item.previous_unit_cost;

  async function toggleUpgrades() {
    if (rightOpen) {
      setRightOpen(false);
      return;
    }
    setRightOpen(true);
    setChoice("keep");
    setUpgradeResult(null);
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/search-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_description: item.description,
          brand: item.brand || "",
          current_price: item.unit_cost,
          category: item.category || "",
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { mid: UpgradeProduct; premium: UpgradeProduct };
      setUpgradeResult(data);
    } catch {
      setUpgradeResult(null);
    } finally {
      setLoading(false);
    }
  }

  async function applyChoice() {
    if (choice === "keep") {
      setRightOpen(false);
      return;
    }
    if (choice === "custom") {
      if (!customValid) return;
      const opt: UpgradeOption = {
        label: "Custom",
        price: parseFloat(customPrice),
        title: customDesc.trim(),
        brand: customBrand.trim(),
        model: "",
        retailer: "",
        url: "",
      };
      setApplying(true);
      await onUpgrade(item, opt);
      setApplying(false);
      setRightOpen(false);
      return;
    }
    if (!upgradeResult) return;
    const prod = choice === "mid" ? upgradeResult.mid : upgradeResult.premium;
    const opt: UpgradeOption = {
      label: choice === "mid" ? "Mid" : "Premium",
      price: prod.price,
      title: prod.title,
      brand: prod.brand,
      model: prod.model,
      retailer: prod.retailer,
      url: prod.url,
    };
    setApplying(true);
    await onUpgrade(item, opt);
    setApplying(false);
    setRightOpen(false);
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex flex-col lg:flex-row">
        <div className="flex-1 min-w-0 p-4 border-b lg:border-b-0 lg:border-r border-gray-100">
          <p className="text-lg font-bold text-gray-900 leading-snug">{item.description}</p>
          <p className="text-sm text-gray-500 mt-1">
            {item.brand ? <span>{item.brand} · </span> : null}
            {prev != null ? (
              <>
                <span className="line-through text-gray-400">{formatCurrency(prev)}</span>
                <span className="text-green-600 font-semibold ml-2">{formatCurrency(item.unit_cost)}</span>
              </>
            ) : (
              <span className="tabular-nums">{formatCurrency(item.unit_cost)}</span>
            )}
            <span> · Qty: {item.qty}</span>
          </p>
          <p className="text-sm text-gray-400 mt-1">{ageLabel(item)}</p>
          {cacheHas && (
            <button
              type="button"
              onClick={() => void toggleUpgrades()}
              className="mt-3 min-h-[40px] rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {rightOpen ? "Hide upgrades ▲" : "Show upgrades ▼"}
            </button>
          )}
        </div>

        {rightOpen && (
          <div className="flex-1 min-w-0 p-4 bg-gray-50">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-gray-500 py-6">
                <SmallSpinner /> Loading options…
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400">What it could be</p>

                <label className="flex gap-3 cursor-pointer items-start">
                  <input
                    type="radio"
                    name={`ch-${generateItemId(item)}`}
                    checked={choice === "keep"}
                    onChange={() => setChoice("keep")}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-semibold text-gray-900">Keep original</span>
                    <span className="block text-sm text-gray-600 tabular-nums">{formatCurrency(item.unit_cost)}</span>
                  </span>
                </label>

                {upgradeResult && (
                  <>
                    <label className="flex gap-3 cursor-pointer items-start">
                      <input
                        type="radio"
                        name={`ch-${generateItemId(item)}`}
                        checked={choice === "mid"}
                        onChange={() => setChoice("mid")}
                        className="mt-1"
                      />
                      <span className="min-w-0">
                        <span className="font-semibold text-gray-900">Mid upgrade</span>
                        <p className="text-sm text-gray-800 mt-0.5 leading-snug">{upgradeResult.mid.title}</p>
                        <p className="text-xs text-gray-500">
                          {upgradeResult.mid.brand}
                          {upgradeResult.mid.retailer ? ` · ${upgradeResult.mid.retailer}` : ""}
                        </p>
                        <p className="text-base font-bold tabular-nums mt-1">{formatCurrency(upgradeResult.mid.price)}</p>
                        <a
                          href={upgradeResult.mid.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 underline"
                        >
                          View ↗
                        </a>
                      </span>
                    </label>

                    <label className="flex gap-3 cursor-pointer items-start">
                      <input
                        type="radio"
                        name={`ch-${generateItemId(item)}`}
                        checked={choice === "premium"}
                        onChange={() => setChoice("premium")}
                        className="mt-1"
                      />
                      <span className="min-w-0">
                        <span className="font-semibold text-gray-900">Premium upgrade</span>
                        <p className="text-sm text-gray-800 mt-0.5 leading-snug">{upgradeResult.premium.title}</p>
                        <p className="text-xs text-gray-500">
                          {upgradeResult.premium.brand}
                          {upgradeResult.premium.retailer ? ` · ${upgradeResult.premium.retailer}` : ""}
                        </p>
                        <p className="text-base font-bold tabular-nums mt-1">{formatCurrency(upgradeResult.premium.price)}</p>
                        <a
                          href={upgradeResult.premium.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 underline"
                        >
                          View ↗
                        </a>
                      </span>
                    </label>
                  </>
                )}

                {!upgradeResult && !loading && (
                  <p className="text-sm text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
                    No standard options returned — use custom below or keep original.
                  </p>
                )}

                <label className="flex gap-3 cursor-pointer items-start">
                  <input
                    type="radio"
                    name={`ch-${generateItemId(item)}`}
                    checked={choice === "custom"}
                    onChange={() => setChoice("custom")}
                    className="mt-1"
                  />
                  <span className="flex-1 min-w-0 space-y-2">
                    <span className="font-semibold text-gray-900">Custom item</span>
                    <input
                      type="text"
                      value={customDesc}
                      onChange={(e) => setCustomDesc(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      placeholder="Description"
                    />
                    <div className="flex gap-2 items-center">
                      <span className="text-gray-400">$</span>
                      <input
                        type="number"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                        placeholder="Price"
                        min={0}
                        step="any"
                      />
                    </div>
                    <input
                      type="text"
                      value={customBrand}
                      onChange={(e) => setCustomBrand(e.target.value)}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      placeholder="Brand (optional)"
                    />
                  </span>
                </label>

                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => void applyChoice()}
                    disabled={applying || (choice === "custom" && !customValid)}
                    className="min-h-[44px] rounded-xl bg-[#16A34A] px-5 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    {applying ? "Saving…" : "✓ Apply"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRightOpen(false);
                      setChoice("keep");
                    }}
                    className="min-h-[44px] rounded-xl border border-gray-200 px-5 py-2 text-sm font-medium text-gray-600 hover:bg-white"
                  >
                    ✗ Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
