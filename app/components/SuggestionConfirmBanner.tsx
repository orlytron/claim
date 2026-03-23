"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import type { SuggestedUpgrade } from "../lib/suggested-upgrades";
import { applySuggestionIndices, norm } from "../lib/suggestion-apply-engine";
import type { ClaimItem } from "../lib/types";
import { formatCurrency } from "../lib/utils";

export type SuggestionConfirmBannerProps = {
  roomName: string;
  list: SuggestedUpgrade[];
  originalItems: ClaimItem[];
  currentClaimItems: ClaimItem[];
  sessionId: string;
  disabled?: boolean;
  onApplySuggestions: (nextClaim?: ClaimItem[]) => Promise<void>;
  onSkipForNow: () => void;
};

function getDeltaVsOriginals(s: SuggestedUpgrade, originals: ClaimItem[], roomName: string): number {
  const rr = norm(roomName);
  const find = (desc: string) =>
    originals.find((i) => norm(i.room) === rr && norm(i.description) === norm(desc));

  switch (s.type) {
    case "RENAME":
    case "MOVE":
      return 0;
    case "PRICE": {
      const orig = find(s.match_description);
      if (!orig) return 0;
      const newCost = s.new_unit_cost;
      const newQty = s.new_qty ?? orig.qty;
      return newQty * newCost - orig.qty * orig.unit_cost;
    }
    case "QTY": {
      const orig = find(s.match_description);
      if (!orig) return 0;
      const newQty = s.new_qty ?? orig.qty;
      const newCost = s.new_unit_cost ?? orig.unit_cost;
      return newQty * newCost - orig.qty * orig.unit_cost;
    }
    case "ADD": {
      const itemRoom = norm(s.item.room);
      const d = norm(s.item.description);
      const alreadyInOriginals = originals.some(
        (i) => norm(i.room) === itemRoom && norm(i.description) === d
      );
      if (alreadyInOriginals) return 0;
      return (s.item.unit_cost ?? 0) * (s.item.qty ?? 1);
    }
    case "SPLIT": {
      const orig = find(s.match_description);
      if (!orig) return 0;
      const newTotal =
        (s.item_a.unit_cost ?? 0) * (s.item_a.qty ?? 1) + (s.item_b.unit_cost ?? 0) * (s.item_b.qty ?? 1);
      return newTotal - orig.unit_cost * orig.qty;
    }
    case "REMOVE": {
      const orig = find(s.match_description);
      if (!orig) return 0;
      return -(orig.unit_cost * orig.qty);
    }
    default:
      return 0;
  }
}

function formatSuggestionLine(s: SuggestedUpgrade): string {
  switch (s.type) {
    case "PRICE":
      return `${s.match_description}: price updated`;
    case "QTY":
      return `${s.match_description}: quantity updated`;
    case "ADD":
      return `Added: ${s.item.description}`;
    case "SPLIT":
      return `${s.match_description} → ${s.item_a.description} + ${s.item_b.description}`;
    case "RENAME":
      return `Renamed: ${s.match_description} → ${s.new_description}`;
    case "MOVE":
      return `Moved: ${s.match_description} to ${s.new_room}`;
    case "REMOVE":
      return `Removed: ${s.match_description}`;
    default:
      return "";
  }
}

/**
 * First-visit banner: shows $ deltas vs original PDF lines; Apply merges selected suggestions into the live session.
 */
export default function SuggestionConfirmBanner({
  roomName,
  list,
  originalItems,
  currentClaimItems,
  sessionId: _sessionId,
  disabled,
  onApplySuggestions,
  onSkipForNow,
}: SuggestionConfirmBannerProps) {
  void _sessionId;
  const [expanded, setExpanded] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(() => new Set(list.map((_, i) => i)));
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    setExpanded(false);
    setChecked(new Set(list.map((_, i) => i)));
  }, [list, roomName]);

  const deltas = useMemo(
    () => list.map((s) => getDeltaVsOriginals(s, originalItems, roomName)),
    [list, originalItems, roomName]
  );

  const totalDelta = useMemo(
    () =>
      [...checked].reduce((sum, i) => {
        if (i < 0 || i >= deltas.length) return sum;
        return sum + (deltas[i] ?? 0);
      }, 0),
    [checked, deltas]
  );

  const nonzeroWithIdx = useMemo(
    () =>
      list
        .map((s, i) => ({ s, i, d: deltas[i] ?? 0 }))
        .filter(({ d }) => d !== 0),
    [list, deltas]
  );

  const visibleInCollapsed = nonzeroWithIdx.slice(0, 4);

  const hiddenCount = useMemo(() => {
    const hiddenNz = Math.max(0, nonzeroWithIdx.length - 4);
    const renameMove = list.filter((s) => s.type === "RENAME" || s.type === "MOVE").length;
    return hiddenNz + renameMove;
  }, [nonzeroWithIdx.length, list]);

  const rowsToRender = expanded
    ? list.map((s, i) => ({ s, i, d: deltas[i] ?? 0 }))
    : visibleInCollapsed;

  async function apply() {
    if (busy || disabled) return;
    const idx = [...checked].filter((i) => i >= 0 && i < list.length).sort((a, b) => a - b);
    if (idx.length === 0) return;
    setBusy(true);
    try {
      const next = applySuggestionIndices(currentClaimItems, roomName, idx, list);
      await onApplySuggestions(next);
    } finally {
      setBusy(false);
    }
  }

  if (list.length === 0) return null;

  return (
    <div className="relative z-20 mx-4 mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 md:mx-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-amber-900">💡 SUGGESTED CHANGES FOR THIS ROOM</p>
          <p className="mt-1 text-xs text-amber-700">
            Based on your lifestyle profile, we recommend these updates
          </p>
        </div>
        <button
          type="button"
          onClick={onSkipForNow}
          className="shrink-0 text-lg leading-none text-amber-600 hover:text-amber-800"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>

      {totalDelta > 0 ? (
        <p className="mt-3 text-lg font-bold text-amber-900 tabular-nums">
          Total to add: +{formatCurrency(totalDelta)}
        </p>
      ) : totalDelta < 0 ? (
        <p className="mt-3 text-lg font-bold text-amber-900 tabular-nums">
          Net change: {formatCurrency(totalDelta)}
        </p>
      ) : null}

      <ul className="mt-3 space-y-1.5">
        {rowsToRender.map(({ s, i, d }) => (
          <li key={i} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-amber-300 accent-amber-800"
              checked={checked.has(i)}
              disabled={busy || disabled}
              onChange={() => {
                setChecked((prev) => {
                  const next = new Set(prev);
                  if (next.has(i)) next.delete(i);
                  else next.add(i);
                  return next;
                });
              }}
            />
            <span className="min-w-0 flex-1 text-amber-900 [overflow-wrap:anywhere]">{formatSuggestionLine(s)}</span>
            {d !== 0 ? (
              <span
                className={`shrink-0 text-sm font-bold tabular-nums ${
                  d > 0 ? "text-green-700" : "text-red-600"
                }`}
              >
                {d > 0 ? "+" : ""}
                {formatCurrency(d)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {hiddenCount > 0 ? (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-2 text-sm font-semibold text-amber-800 underline hover:text-amber-950"
        >
          {expanded ? "▲ Show less" : `▶ +${hiddenCount} more`}
        </button>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || busy || checked.size === 0}
          onClick={() => void apply()}
          className="rounded-lg bg-amber-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-900 disabled:opacity-40"
        >
          Got it →
          {totalDelta > 0 ? <span className="ml-1 tabular-nums">+{formatCurrency(totalDelta)}</span> : null}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onSkipForNow}
          className="rounded-lg border border-amber-300 bg-white px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-100/60"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
