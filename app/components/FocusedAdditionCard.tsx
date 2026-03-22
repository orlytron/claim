"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Bundle, BundleItem, BundleTiersDef, TierLineSource } from "../lib/bundles-data";
import { getSingletonKey } from "../lib/bundle-room-singleton-key";
import type { ClaimItem } from "../lib/types";
import { formatCurrency } from "../lib/utils";
import { supabase } from "../lib/supabase";

function lineKey(l: Pick<BundleItem, "description" | "unit_cost" | "qty">, idx: number) {
  return `${idx}|${l.description}|${l.unit_cost}|${l.qty}`;
}

function toBI(l: TierLineSource): BundleItem {
  return {
    description: l.description,
    brand: l.brand,
    qty: l.qty,
    unit_cost: l.unit_cost,
    total: l.qty * l.unit_cost,
    category: l.category,
  };
}

function tierRows(
  tiers: BundleTiersDef,
  tierIdx: 0 | 1 | 2
): { row: BundleItem; introducedAt: 0 | 1 | 2; idx: number }[] {
  const essential: TierLineSource[] = tiers.essential.items ?? [];
  const completeAdds: TierLineSource[] = tiers.complete.adds ?? [];
  const fullAdds: TierLineSource[] = tiers.full.adds ?? [];
  const out: { row: BundleItem; introducedAt: 0 | 1 | 2; idx: number }[] = [];
  let i = 0;
  for (const l of essential) {
    out.push({ row: toBI(l), introducedAt: 0, idx: i++ });
  }
  if (tierIdx >= 1) {
    for (const l of completeAdds) {
      out.push({ row: toBI(l), introducedAt: 1, idx: i++ });
    }
  }
  if (tierIdx >= 2) {
    for (const l of fullAdds) {
      out.push({ row: toBI(l), introducedAt: 2, idx: i++ });
    }
  }
  return out;
}

function flatBundleToTiers(b: Bundle): BundleTiersDef {
  const items: TierLineSource[] = b.items.map((bi) => ({
    description: bi.description,
    brand: bi.brand,
    unit_cost: bi.unit_cost,
    qty: bi.qty,
    category: bi.category,
  }));
  const total = items.reduce((s, l) => s + l.qty * l.unit_cost, 0);
  return {
    essential: { total, items },
    complete: { total, adds: [] },
    full: { total, adds: [] },
  };
}

export type FocusedAdditionCardProps = {
  bundle: Bundle;
  roomName: string;
  claimItems: ClaimItem[];
  onAdd: (items: ClaimItem[]) => Promise<void> | void;
  disabled?: boolean;
};

export default function FocusedAdditionCard({
  bundle,
  roomName,
  claimItems,
  onAdd,
  disabled,
}: FocusedAdditionCardProps) {
  const tiersDef = bundle.tiers ?? flatBundleToTiers(bundle);
  const hasComplete = (tiersDef.complete.adds?.length ?? 0) > 0;
  const hasFull = (tiersDef.full.adds?.length ?? 0) > 0;
  const maxTierIdx = !hasComplete && !hasFull ? 0 : !hasFull ? 1 : 2;

  const [tierIdx, setTierIdx] = useState<0 | 1 | 2>(() => {
    if (maxTierIdx === 0) return 0;
    return bundle.sweet_spot && maxTierIdx >= 1 ? 1 : 0;
  });

  useEffect(() => {
    if (tierIdx > maxTierIdx) setTierIdx(maxTierIdx as 0 | 1 | 2);
  }, [maxTierIdx, tierIdx]);

  const effectiveTier = Math.min(tierIdx, maxTierIdx) as 0 | 1 | 2;
  const rows = useMemo(() => tierRows(tiersDef, effectiveTier), [tiersDef, effectiveTier]);

  const [checked, setChecked] = useState<Set<string>>(new Set());
  useEffect(() => {
    const next = new Set<string>();
    for (const r of rows) {
      const k = lineKey(r.row, r.idx);
      const slot = getSingletonKey(r.row.description);
      const conflict =
        slot != null &&
        claimItems.some(
          (c) => c.room === roomName && getSingletonKey(c.description) === slot
        );
      if (!conflict) next.add(k);
    }
    setChecked(next);
  }, [bundle.bundle_code, effectiveTier, rows, claimItems, roomName]);

  const [customOpen, setCustomOpen] = useState(false);
  const [cDesc, setCDesc] = useState("");
  const [cPrice, setCPrice] = useState("");
  const [cQty, setCQty] = useState("1");
  const [addedFlash, setAddedFlash] = useState(false);
  const [busy, setBusy] = useState(false);

  const checkedTotal = useMemo(() => {
    let s = 0;
    for (const r of rows) {
      if (checked.has(lineKey(r.row, r.idx))) s += r.row.total;
    }
    return s;
  }, [rows, checked]);

  const selectedCount = useMemo(() => rows.filter((r) => checked.has(lineKey(r.row, r.idx))).length, [rows, checked]);

  const toggle = useCallback((k: string) => {
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }, []);

  const handleAddToClaim = useCallback(async () => {
    if (disabled || busy) return;
    const toAdd: ClaimItem[] = [];
    for (const r of rows) {
      if (!checked.has(lineKey(r.row, r.idx))) continue;
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
      setAddedFlash(true);
      window.setTimeout(() => setAddedFlash(false), 2200);
    } finally {
      setBusy(false);
    }
  }, [disabled, busy, rows, checked, roomName, onAdd]);

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
      setCustomOpen(false);
      setCDesc("");
      setCPrice("");
      setCQty("1");
      setAddedFlash(true);
      window.setTimeout(() => setAddedFlash(false), 2200);
    } finally {
      setBusy(false);
    }
  }, [disabled, busy, cDesc, cPrice, cQty, roomName, bundle.name, onAdd]);

  const tierTotals = [tiersDef.essential.total, tiersDef.complete.total, tiersDef.full.total];

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold text-gray-900 [overflow-wrap:anywhere]">{bundle.name}</p>
          <p className="mt-1 text-sm text-[#6B7280] [overflow-wrap:anywhere]">{bundle.description}</p>
        </div>
      </div>

      {maxTierIdx > 0 ? (
        <div className="mt-5">
          <div className="flex justify-between text-xs font-medium text-[#6B7280]">
            <span>Essential</span>
            <span>
              Complete{bundle.sweet_spot ? " ★" : ""}
            </span>
            <span>Full</span>
          </div>
          <input
            type="range"
            min={0}
            max={maxTierIdx}
            step={1}
            value={effectiveTier}
            onChange={(e) => setTierIdx(Number(e.target.value) as 0 | 1 | 2)}
            disabled={disabled}
            className="mt-2 h-2 w-full accent-[#2563EB]"
            aria-label="Bundle tier"
          />
          <div className="mt-1 flex justify-between text-xs tabular-nums text-gray-800">
            <span>{formatCurrency(tierTotals[0] ?? 0)}</span>
            {maxTierIdx >= 1 ? <span>{formatCurrency(tierTotals[1] ?? 0)}</span> : <span />}
            {maxTierIdx >= 2 ? <span>{formatCurrency(tierTotals[2] ?? 0)}</span> : <span />}
          </div>
        </div>
      ) : null}

      <ul className="mt-5 space-y-3">
        {rows.map((r) => {
          const k = lineKey(r.row, r.idx);
          const isNew = r.introducedAt === effectiveTier && effectiveTier > 0;
          const slot = getSingletonKey(r.row.description);
          const conflict =
            slot != null &&
            claimItems.some(
              (c) => c.room === roomName && getSingletonKey(c.description) === slot
            );
          return (
            <li key={k} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 accent-[#2563EB]"
                checked={checked.has(k)}
                disabled={disabled || busy}
                onChange={() => toggle(k)}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium text-gray-900 [overflow-wrap:anywhere]">
                    {r.row.description}
                    {r.row.qty > 1 ? (
                      <span className="text-[#6B7280]"> ×{r.row.qty}</span>
                    ) : null}
                    {isNew ? (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                        New at this level
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 tabular-nums font-semibold text-gray-900">
                    {r.row.qty > 1 ? (
                      <>
                        {formatCurrency(r.row.unit_cost * r.row.qty)} total
                      </>
                    ) : (
                      formatCurrency(r.row.unit_cost)
                    )}
                  </span>
                </div>
                {conflict ? (
                  <p className="mt-1 text-xs text-amber-800">⚠️ You may already have this — uncheck to skip.</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => setCustomOpen((o) => !o)}
        className="mt-4 text-sm font-semibold text-[#2563EB] underline-offset-2 hover:underline"
      >
        ✏️ + Add a custom item
      </button>
      {customOpen ? (
        <div className="mt-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4">
          <label className="block text-xs font-medium text-gray-700">Description</label>
          <input
            className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
            value={cDesc}
            onChange={(e) => setCDesc(e.target.value)}
            placeholder="e.g. Vintage lamp"
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
            disabled={busy || disabled || !cDesc.trim()}
            onClick={() => void addCustom()}
            className="mt-3 rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      ) : null}

      <p className="mt-4 text-sm text-gray-700">
        Selected: <span className="font-semibold">{selectedCount}</span> items
      </p>
      <button
        type="button"
        disabled={disabled || busy || selectedCount === 0}
        onClick={() => void handleAddToClaim()}
        className={`mt-3 flex h-12 w-full items-center justify-center rounded-xl text-base font-bold transition ${
          addedFlash ? "bg-[#16A34A] text-white" : "bg-[#2563EB] text-white hover:bg-blue-700"
        } disabled:opacity-40`}
      >
        {addedFlash ? "✓ Added  ·  View in claim" : `+ Add to Claim  +${formatCurrency(checkedTotal)}`}
      </button>
    </div>
  );
}
