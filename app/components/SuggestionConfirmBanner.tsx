"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import type { SuggestedUpgrade } from "../lib/suggested-upgrades";
import { formatSuggestedUpgradeLineWithClaim } from "../lib/suggested-upgrades";
import {
  applySuggestionIndices,
  getSuggestionDelta,
  suggestionSelectedDeltaSum,
} from "../lib/suggestion-apply-engine";
import type { ClaimItem } from "../lib/types";
import { formatCurrency } from "../lib/utils";

export type SuggestionConfirmBannerProps = {
  roomName: string;
  list: SuggestedUpgrade[];
  currentClaimItems: ClaimItem[];
  sessionId: string;
  disabled?: boolean;
  onApplySuggestions: (nextClaim?: ClaimItem[]) => Promise<void>;
  onSkipForNow: () => void;
};

function lineLabel(claim: ClaimItem[], room: string, s: SuggestedUpgrade): string {
  return formatSuggestedUpgradeLineWithClaim(claim, room, s).replace(/^☑\s*/, "").trim();
}

/**
 * First-visit banner: checkboxes + live totals vs current claim; Apply runs only on button click.
 */
export default function SuggestionConfirmBanner({
  roomName,
  list,
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

  const selectedTotalDelta = useMemo(
    () => suggestionSelectedDeltaSum(currentClaimItems, roomName, list, checked),
    [currentClaimItems, roomName, list, checked]
  );

  const hiddenCount = Math.max(0, list.length - 4);

  const rowsToRender = useMemo(() => {
    const slice = expanded ? list : list.slice(0, 4);
    return slice.map((s, i) => ({
      s,
      i,
      d: getSuggestionDelta(s, currentClaimItems),
      label: lineLabel(currentClaimItems, roomName, s),
    }));
  }, [expanded, list, currentClaimItems, roomName]);

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
          <p className="text-sm font-bold text-amber-900">💡 Suggested changes for this room</p>
          <p className="mt-1 text-xs text-amber-800">Based on your lifestyle profile</p>
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

      <ul className="mt-3 space-y-1.5">
        {rowsToRender.map(({ s, i, d, label }) => (
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
            <span className="min-w-0 flex-1 text-amber-950 [overflow-wrap:anywhere]">{label}</span>
            <span
              className={`shrink-0 text-sm font-bold tabular-nums ${
                d > 0 ? "text-green-700" : d < 0 ? "text-red-600" : "text-amber-800/70"
              }`}
            >
              {d > 0 ? "+" : ""}
              {formatCurrency(d)}
            </span>
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

      <p className="mt-3 text-base font-bold text-amber-950 tabular-nums">
        Total to add:{" "}
        <span className={selectedTotalDelta >= 0 ? "text-green-800" : "text-red-700"}>
          {selectedTotalDelta >= 0 ? "+" : ""}
          {formatCurrency(selectedTotalDelta)}
        </span>
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={disabled || busy || checked.size === 0}
          onClick={() => void apply()}
          className="rounded-lg bg-amber-800 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-900 disabled:opacity-40"
        >
          Apply Selected{"  "}
          {checked.size > 0 ? (
            <span className="tabular-nums">
              {selectedTotalDelta >= 0 ? "+" : ""}
              {formatCurrency(selectedTotalDelta)}
            </span>
          ) : null}
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
