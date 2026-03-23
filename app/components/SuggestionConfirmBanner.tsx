"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { SuggestedUpgrade } from "../lib/suggested-upgrades";
import { formatSuggestedUpgradeLineWithClaim } from "../lib/suggested-upgrades";
import {
  applySuggestionIndices,
  getSuggestionDelta,
  suggestionCollapsedHiddenCount,
  suggestionCollapsedRowIndices,
  suggestionSelectedDeltaSum,
} from "../lib/suggestion-apply-engine";
import type { ClaimItem } from "../lib/types";
import { formatCurrency } from "../lib/utils";

export type SuggestionConfirmBannerProps = {
  roomSlug: string;
  roomName: string;
  claimItems: ClaimItem[];
  /** Full claim lines (same as claimItems) — used for delta matching across all rooms. */
  sessionItems: ClaimItem[];
  list: SuggestedUpgrade[];
  onApply: (nextClaim: ClaimItem[]) => Promise<void>;
  onSkip: () => void;
  /** Persist dismiss so the banner does not reappear for this room. */
  onSkipPermanent: () => void;
  disabled?: boolean;
};

/**
 * First-visit banner: client confirms which scripted suggestions to apply (nothing auto-applies).
 */
export default function SuggestionConfirmBanner({
  roomSlug,
  roomName,
  claimItems,
  sessionItems,
  list,
  onApply,
  onSkip,
  onSkipPermanent,
  disabled,
}: SuggestionConfirmBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(() => new Set(list.map((_, i) => i)));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    console.log("Banner items count:", sessionItems.length);
    const first = list[0];
    if (first) {
      console.log("First suggestion delta:", getSuggestionDelta(first, sessionItems));
    }
  }, [list, sessionItems]);

  useLayoutEffect(() => {
    setExpanded(false);
    setChecked(new Set(list.map((_, i) => i)));
  }, [roomSlug, list]);

  const collapsedIdx = useMemo(
    () => suggestionCollapsedRowIndices(claimItems, roomName, list, sessionItems),
    [claimItems, roomName, list, sessionItems]
  );
  const moreCount = useMemo(
    () => suggestionCollapsedHiddenCount(claimItems, roomName, list, sessionItems),
    [claimItems, roomName, list, sessionItems]
  );

  const rowIndices = expanded ? list.map((_, i) => i) : collapsedIdx;

  const selectedTotalDelta = useMemo(
    () => suggestionSelectedDeltaSum(claimItems, roomName, list, checked, sessionItems),
    [claimItems, roomName, list, checked, sessionItems]
  );

  function toggle(i: number) {
    setChecked((prev) => {
      const n = new Set(prev);
      if (n.has(i)) n.delete(i);
      else n.add(i);
      return n;
    });
  }

  async function apply() {
    if (busy || disabled) return;
    const idx = [...checked].filter((i) => i >= 0 && i < list.length).sort((a, b) => a - b);
    if (idx.length === 0) return;
    setBusy(true);
    try {
      const next = applySuggestionIndices(claimItems, roomName, idx, list);
      await onApply(next);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative z-20 w-full border-b border-amber-200 bg-gradient-to-b from-amber-50 to-amber-50/40 px-4 py-5 md:px-8">
      <div className="mx-auto max-w-[1100px] rounded-2xl border border-amber-200/80 bg-white/95 p-5 shadow-sm md:p-6">
        <p className="text-sm font-bold uppercase tracking-wide text-amber-900">💡 Suggested changes</p>
        <p className="mt-3 text-base font-semibold text-gray-900">
          Adding these will increase your claim by{" "}
          <span className="tabular-nums text-[#16A34A]">
            {selectedTotalDelta >= 0 ? `+${formatCurrency(selectedTotalDelta)}` : formatCurrency(selectedTotalDelta)}
          </span>
        </p>
        <p className="mt-2 text-sm text-gray-600">Uncheck any row to exclude it. Nothing is added until you confirm.</p>
        <ul className="mt-4 space-y-2">
          {rowIndices.map((i) => {
            const line = formatSuggestedUpgradeLineWithClaim(claimItems, roomName, list[i]!);
            const delta = getSuggestionDelta(list[i]!, sessionItems);
            const deltaLabel =
              delta > 0 ? `+${formatCurrency(delta)}` : delta < 0 ? formatCurrency(delta) : formatCurrency(0);
            const deltaClass =
              delta > 0 ? "text-[#16A34A]" : delta < 0 ? "text-red-600" : "text-[#6B7280]";
            return (
              <li
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 rounded border-gray-300 accent-[#2563EB]"
                  checked={checked.has(i)}
                  disabled={busy || disabled}
                  onChange={() => toggle(i)}
                />
                <span className="min-w-0 flex-1 text-gray-900 [overflow-wrap:anywhere]">{line}</span>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${deltaClass}`}>{deltaLabel}</span>
              </li>
            );
          })}
        </ul>
        {!expanded && moreCount > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-3 text-sm font-semibold text-[#2563EB] hover:underline"
          >
            ▶ +{moreCount} more (click to expand)
          </button>
        ) : null}
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={busy || disabled || checked.size === 0}
            onClick={() => void apply()}
            className="rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-40"
          >
            ✓ Apply selected{" "}
            {selectedTotalDelta >= 0 ? `+${formatCurrency(selectedTotalDelta)}` : formatCurrency(selectedTotalDelta)}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onSkip}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Skip for now
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onSkipPermanent}
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-950 hover:bg-amber-100"
          >
            Skip and don&apos;t show again
          </button>
        </div>
      </div>
    </div>
  );
}
