"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Bundle, BundleItem, BundleTiers3, BundleTiers5, BundleTiersDef } from "../lib/bundles-data";
import { isBundleTiers5 } from "../lib/bundles-data";
import type { ClaimItem } from "../lib/types";
import { cleanDescription } from "../lib/clean-description";
import { formatCurrency } from "../lib/utils";
import { supabase } from "../lib/supabase";

const SINGLETONS = [
  "peloton",
  "treadmill",
  "sauna",
  "espresso",
  "washer",
  "dryer",
  "piano",
  "refrigerator",
  "dishwasher",
  "oven",
  "range",
  "wine fridge",
  "ice machine",
] as const;

function lineTotal(i: BundleItem): number {
  return i.total ?? i.unit_cost * i.qty;
}

function ensureTotals(items: BundleItem[]): BundleItem[] {
  return items.map((i) => ({ ...i, total: lineTotal(i) }));
}

function isSingletonDesc(desc: string): boolean {
  const d = desc.toLowerCase();
  return SINGLETONS.some((s) => d.includes(s));
}

function singletonInClaim(desc: string, existingItems: ClaimItem[]): boolean {
  if (!isSingletonDesc(desc)) return false;
  return existingItems.some((c) => isSingletonDesc(c.description));
}

function autoGenerateTiers3(bundle: Bundle): BundleTiers3 {
  const items = ensureTotals([...bundle.items]).sort((a, b) => b.unit_cost - a.unit_cost);
  const n = items.length;
  const third = Math.ceil(n / 3);
  const essentialItems = items.slice(n - third);
  const middleStart = Math.max(0, n - third * 2);
  const middleEnd = n - third;
  const completeItems = items.slice(middleStart, middleEnd);
  const fullItems = items.slice(0, middleStart);
  const sum = (arr: BundleItem[]) => arr.reduce((s, i) => s + lineTotal(i), 0);
  return {
    essential: { total: sum(essentialItems), items: essentialItems },
    complete: { total: sum(completeItems), items: completeItems },
    full: { total: sum(fullItems), items: fullItems },
  };
}

/** Top-priced slices → incremental tier blocks (5 steps). */
function autoGenerateTiers5(bundle: Bundle): BundleTiers5 {
  const items = ensureTotals([...bundle.items]).sort((a, b) => b.unit_cost - a.unit_cost);
  const n = items.length;
  const fifth = Math.max(1, Math.ceil(n / 5));
  const b0 = items.slice(0, Math.min(n, fifth));
  const b1 = items.slice(Math.min(n, fifth), Math.min(n, fifth * 2));
  const b2 = items.slice(Math.min(n, fifth * 2), Math.min(n, fifth * 3));
  const b3 = items.slice(Math.min(n, fifth * 3), Math.min(n, fifth * 4));
  const b4 = items.slice(Math.min(n, fifth * 4), n);
  const sum = (arr: BundleItem[]) => arr.reduce((s, i) => s + lineTotal(i), 0);
  return {
    essential: { total: sum(b0), items: b0 },
    enhanced: { total: sum(b1), items: b1 },
    complete: { total: sum(b2), items: b2 },
    full: { total: sum(b3), items: b3 },
    ultimate: { total: sum(b4), items: b4 },
  };
}

function effectiveTiersDef(bundle: Bundle): BundleTiersDef {
  if (bundle.tiers) return bundle.tiers;
  if (bundle.items.length === 0) {
    return {
      essential: { total: 0, items: [] },
      complete: { total: 0, items: [] },
      full: { total: 0, items: [] },
    };
  }
  return bundle.items.length >= 8 ? autoGenerateTiers5(bundle) : autoGenerateTiers3(bundle);
}

function tierBlocksList(t: BundleTiersDef, isExplicit: boolean): BundleItem[][] {
  if (isBundleTiers5(t)) {
    // 5-tier: always incremental blocks
    return [
      t.essential.items,
      t.enhanced.items,
      t.complete.items,
      t.full.items,
      t.ultimate.items,
    ];
  }
  // 3-tier
  if (isExplicit) {
    // Hand-crafted: each tier IS the full cumulative list for that tier
    return [
      t.essential.items,
      (t as BundleTiers3).complete.items,
      (t as BundleTiers3).full.items,
    ];
  }
  // Auto-generated: incremental blocks (same slice layout; rowsForTier accumulates)
  return [t.essential.items, (t as BundleTiers3).complete.items, (t as BundleTiers3).full.items];
}

function cumulativeTotals(blocks: BundleItem[][]): number[] {
  const out: number[] = [];
  let s = 0;
  for (const b of blocks) {
    s += b.reduce((a, i) => a + lineTotal(i), 0);
    out.push(Math.round(s * 100) / 100);
  }
  return out;
}

function itemSig(i: BundleItem): string {
  return `${i.description}|${i.unit_cost}|${i.qty}|${i.brand ?? ""}`;
}

function firstTierIndexForItem(blocks: BundleItem[][], row: BundleItem): number {
  const sig = itemSig(row);
  for (let t = 0; t < blocks.length; t++) {
    if ((blocks[t] ?? []).some((i) => itemSig(i) === sig)) return t;
  }
  return 0;
}

type RowMeta = { row: BundleItem; introducedAt: number; idx: number };

function rowsForTier(blocks: BundleItem[][], tierIdx: number, isExplicit: boolean): RowMeta[] {
  if (isExplicit) {
    const list = blocks[tierIdx] ?? [];
    return list.map((row, idx) => ({
      row,
      introducedAt: tierIdx,
      idx,
    }));
  }
  const out: RowMeta[] = [];
  let idx = 0;
  for (let b = 0; b <= tierIdx; b++) {
    for (const row of blocks[b] ?? []) {
      out.push({ row, introducedAt: b, idx: idx++ });
    }
  }
  return out;
}

function rowsForTierCumulative(blocks: BundleItem[][], tierIdx: number): RowMeta[] {
  const list = blocks[tierIdx] ?? [];
  return list.map((row, idx) => ({
    row,
    introducedAt: firstTierIndexForItem(blocks, row),
    idx,
  }));
}

function lineKey(r: RowMeta, tierUiIdx: number, cumulative: boolean) {
  if (cumulative) {
    return `cum-${tierUiIdx}-${r.idx}-${itemSig(r.row)}`;
  }
  return `${r.introducedAt}-${r.idx}-${r.row.description}-${r.row.unit_cost}-${r.row.qty}`;
}

export type FocusedAdditionCardProps = {
  bundle: Bundle;
  roomName: string;
  existingItems: ClaimItem[];
  onAdd: (items: ClaimItem[]) => void | Promise<void>;
  sessionId: string;
  disabled?: boolean;
};

export default function FocusedAdditionCard({
  bundle,
  roomName,
  existingItems,
  onAdd,
  sessionId: _sessionId,
  disabled,
}: FocusedAdditionCardProps) {
  void _sessionId;

  const tiersDef = useMemo(() => effectiveTiersDef(bundle), [bundle]);
  const five = isBundleTiers5(tiersDef);
  const isExplicit = Boolean(bundle.tiers);
  const blocks = useMemo(() => tierBlocksList(tiersDef, isExplicit), [tiersDef, isExplicit]);
  const cumulativeFive = Boolean(bundle.tiersCumulative && five);
  /** Hand-crafted 3-tier bundles are cumulative per tier; 5-tier stays incremental unless tiersCumulative. */
  const explicitThreeTierCumulative = isExplicit && !five;
  const tierCount = blocks.length;
  const maxTierIndex = Math.max(0, tierCount - 1);

  const [tierIndex, setTierIndex] = useState(0);
  const bundleCodeRef = useRef<string | null>(null);
  useLayoutEffect(() => {
    if (bundleCodeRef.current === bundle.bundle_code) return;
    bundleCodeRef.current = bundle.bundle_code;
    const defaultTier = five ? 2 : 1;
    setTierIndex(Math.min(defaultTier, maxTierIndex));
  }, [bundle.bundle_code, five, maxTierIndex]);

  const effectiveTier = Math.min(tierIndex, maxTierIndex);
  const rows = useMemo(() => {
    if (cumulativeFive) return rowsForTierCumulative(blocks, effectiveTier);
    return rowsForTier(blocks, effectiveTier, explicitThreeTierCumulative);
  }, [cumulativeFive, blocks, effectiveTier, explicitThreeTierCumulative]);
  const tierTotals = useMemo(() => {
    if (isExplicit && !isBundleTiers5(tiersDef)) {
      const t = tiersDef as BundleTiers3;
      return [t.essential.total, t.complete.total, t.full.total];
    }
    if (cumulativeFive && isBundleTiers5(tiersDef)) {
      return [
        tiersDef.essential.total,
        tiersDef.enhanced.total,
        tiersDef.complete.total,
        tiersDef.full.total,
        tiersDef.ultimate.total,
      ];
    }
    return cumulativeTotals(blocks);
  }, [isExplicit, cumulativeFive, tiersDef, blocks]);

  const [checked, setChecked] = useState<Set<string>>(new Set());
  useEffect(() => {
    const next = new Set<string>();
    for (const r of rows) {
      const k = lineKey(r, effectiveTier, cumulativeFive);
      if (!singletonInClaim(r.row.description, existingItems)) next.add(k);
    }
    setChecked(next);
  }, [bundle.bundle_code, effectiveTier, rows, existingItems, cumulativeFive]);

  const [showCustom, setShowCustom] = useState(false);
  const [cDesc, setCDesc] = useState("");
  const [cPrice, setCPrice] = useState("");
  const [cQty, setCQty] = useState("1");
  const [added, setAdded] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setAdded(false);
    setShowCustom(false);
  }, [bundle.bundle_code]);

  const checkedTotal = useMemo(() => {
    let s = 0;
    for (const r of rows) {
      if (checked.has(lineKey(r, effectiveTier, cumulativeFive))) s += lineTotal(r.row);
    }
    return Math.round(s * 100) / 100;
  }, [rows, checked, effectiveTier, cumulativeFive]);

  const selectedCount = useMemo(
    () => rows.filter((r) => checked.has(lineKey(r, effectiveTier, cumulativeFive))).length,
    [rows, checked, effectiveTier, cumulativeFive]
  );

  /** Items in the current tier only (not a delta subset) — for accurate counts in the header. */
  const currentTierItems = useMemo(() => {
    if (cumulativeFive) {
      return blocks[effectiveTier] ?? [];
    }
    if (explicitThreeTierCumulative) {
      return blocks[effectiveTier] ?? [];
    }
    const out: BundleItem[] = [];
    for (let b = 0; b <= effectiveTier; b++) {
      out.push(...(blocks[b] ?? []));
    }
    return out;
  }, [cumulativeFive, explicitThreeTierCumulative, blocks, effectiveTier]);

  const tierItemCount = currentTierItems.length;
  const tierItemsTotal = useMemo(
    () => Math.round(currentTierItems.reduce((s, i) => s + lineTotal(i), 0) * 100) / 100,
    [currentTierItems]
  );

  const toggle = useCallback((k: string) => {
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }, []);

  const handleAddToClaim = useCallback(async () => {
    if (disabled || busy || added) return;
    const toAdd: ClaimItem[] = [];
    for (const r of rows) {
      if (!checked.has(lineKey(r, effectiveTier, cumulativeFive))) continue;
      const bi = r.row;
      toAdd.push({
        room: roomName,
        description: bi.description,
        brand: bi.brand || "",
        model: "",
        qty: bi.qty,
        age_years: 0,
        age_months: 0,
        condition: "New",
        unit_cost: bi.unit_cost,
        category: bi.category,
        source: "bundle",
      });
    }
    if (toAdd.length === 0) return;
    setBusy(true);
    try {
      await onAdd(toAdd);
      setAdded(true);
    } finally {
      setBusy(false);
    }
  }, [disabled, busy, added, rows, checked, roomName, onAdd, effectiveTier, cumulativeFive]);

  const addCustom = useCallback(async () => {
    if (disabled || busy) return;
    const price = parseFloat(cPrice.replace(/[^0-9.]/g, ""));
    const qty = Math.max(1, parseInt(cQty, 10) || 1);
    if (!cDesc.trim() || Number.isNaN(price) || price <= 0) return;
    setBusy(true);
    try {
      const line: ClaimItem = {
        room: roomName,
        description: cDesc.trim(),
        brand: "",
        model: "",
        qty,
        age_years: 0,
        age_months: 0,
        condition: "New",
        unit_cost: Math.round(price * 100) / 100,
        category: "Other",
        source: "bundle",
      };
      await supabase.from("client_suggestions").insert({
        room: roomName,
        message: `[Custom from ${bundle.name}] ${cDesc.trim()} @ ${price} ×${qty}`,
        status: "pending",
      });
      await onAdd([line]);
      setShowCustom(false);
      setCDesc("");
      setCPrice("");
      setCQty("1");
    } finally {
      setBusy(false);
    }
  }, [disabled, busy, cDesc, cPrice, cQty, roomName, bundle.name, onAdd]);

  const labelRow = five
    ? (["Essential", "Enhanced", "Complete ★", "Full", "Ultimate"] as const)
    : (["Essential", "Complete ★", "Full"] as const);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="min-w-0">
        <p className="text-lg font-semibold text-gray-900 [overflow-wrap:anywhere]">{bundle.name}</p>
        <p className="mt-1 text-sm text-[#6B7280] [overflow-wrap:anywhere]">{bundle.description}</p>
        <p className="mt-2 text-sm font-medium tabular-nums text-gray-600">
          {tierItemCount} items · {formatCurrency(tierItemsTotal)}
        </p>
      </div>

      {tierCount > 1 ? (
        <div className="mt-5 overflow-x-auto pb-1 [-webkit-overflow-scrolling:touch]">
          <div
            className={`grid gap-2 ${five ? "min-w-[420px] grid-cols-5 sm:min-w-0" : "grid-cols-3"}`}
            role="tablist"
            aria-label="Bundle tier"
          >
          {labelRow.slice(0, maxTierIndex + 1).map((lab, i) => {
            const active = effectiveTier === i;
            const total = tierTotals[i] ?? 0;
            return (
              <div key={lab} className="flex min-w-0 flex-col items-center gap-1.5">
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  disabled={disabled || added}
                  onClick={() => setTierIndex(i)}
                  className={`w-full min-h-[44px] rounded-lg border-2 px-1.5 py-2 text-center text-[10px] font-bold leading-tight transition sm:text-xs ${
                    active
                      ? "border-[#2563EB] bg-[#2563EB] text-white shadow-sm"
                      : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
                  } disabled:opacity-40`}
                >
                  {lab}
                  {lab.includes("★") ? <span className="sr-only"> recommended tier</span> : null}
                </button>
                <span className="text-[10px] font-semibold tabular-nums text-gray-800 sm:text-xs">{formatCurrency(total)}</span>
              </div>
            );
          })}
          </div>
        </div>
      ) : null}

      <ul className="mt-5 space-y-2">
        {rows.map((r) => {
          const k = lineKey(r, effectiveTier, cumulativeFive);
          const conflict = singletonInClaim(r.row.description, existingItems);
          const row = r.row;
          const ext = lineTotal(row);
          return (
            <li
              key={k}
              className={`flex gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                conflict ? "border-amber-200 bg-amber-50/50" : "border-gray-100 bg-white"
              }`}
            >
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 accent-[#2563EB]"
                checked={checked.has(k)}
                disabled={disabled || busy || added}
                onChange={() => toggle(k)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex w-full flex-wrap items-baseline justify-between gap-x-2 gap-y-1 text-sm">
                  {row.qty > 1 ? (
                    <>
                      <span className="min-w-0 font-medium text-gray-900 [overflow-wrap:anywhere]">
                        {cleanDescription(row.description)}
                        <span className="text-gray-400"> ×{row.qty}</span>
                        <span className="ml-1 text-xs font-normal text-gray-400 tabular-nums">
                          {formatCurrency(row.unit_cost)} each
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-gray-900">
                        = {formatCurrency(ext)}
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="min-w-0 font-medium text-gray-900 [overflow-wrap:anywhere]">
                        {cleanDescription(row.description)}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-gray-900">
                        {formatCurrency(row.unit_cost)}
                      </span>
                    </>
                  )}
                </div>
                {conflict ? (
                  <p className="mt-1 text-xs font-medium text-amber-900">⚠ May have this</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => setShowCustom((o) => !o)}
        disabled={disabled || added}
        className="mt-4 text-sm font-semibold text-[#2563EB] underline-offset-2 hover:underline disabled:opacity-40"
      >
        + Add custom item to this set
      </button>
      {showCustom && !added ? (
        <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <label className="block text-xs font-medium text-gray-700">Description</label>
          <input
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            value={cDesc}
            onChange={(e) => setCDesc(e.target.value)}
            placeholder="Item description"
          />
          <div className="mt-3 flex flex-wrap gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700">Price</label>
              <input
                className="mt-1 w-28 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm tabular-nums"
                value={cPrice}
                onChange={(e) => setCPrice(e.target.value)}
                placeholder="0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700">Qty</label>
              <input
                type="number"
                min={1}
                className="mt-1 w-20 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                value={cQty}
                onChange={(e) => setCQty(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            disabled={busy || !cDesc.trim()}
            onClick={() => void addCustom()}
            className="mt-3 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-40"
          >
            Add to Set
          </button>
        </div>
      ) : null}

      <div className="mt-4 border-t border-gray-100 pt-4 text-sm text-gray-800">
        <span className="font-semibold tabular-nums">{selectedCount}</span> items ·{" "}
        <span className="tabular-nums font-bold text-gray-900">{formatCurrency(checkedTotal)}</span>
      </div>

      {added ? (
        <div className="mt-3 flex min-h-[48px] items-center justify-center gap-3 rounded-xl bg-[#16A34A] px-4 py-3 text-base font-bold text-white">
          <span>✓ Added</span>
          <Link
            href="#claim-items-anchor"
            className="rounded-lg bg-white/20 px-3 py-1 text-sm font-semibold hover:bg-white/30"
          >
            View in claim
          </Link>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || busy || selectedCount === 0}
          onClick={() => void handleAddToClaim()}
          className="mt-3 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#2563EB] text-base font-bold text-white transition hover:bg-blue-700 disabled:opacity-40"
        >
          + Add to Claim +{formatCurrency(checkedTotal)}
        </button>
      )}
    </div>
  );
}
