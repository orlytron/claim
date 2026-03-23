"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import type { SuggestedUpgrade } from "../lib/suggested-upgrades";
import {
  applySuggestionIndices,
  getSuggestionDelta,
  suggestionSelectedDeltaSum,
} from "../lib/suggestion-apply-engine";
import { formatSuggestionLine, suggestionDeltaColumn } from "../lib/suggestion-format-line";
import type { ClaimItem } from "../lib/types";
import { formatCurrency } from "../lib/utils";

export type SuggestionConfirmModalProps = {
  open: boolean;
  roomSlug: string;
  roomName: string;
  claimItems: ClaimItem[];
  /** Room lines for $ deltas (e.g. deduped display list). */
  sessionItems: ClaimItem[];
  list: SuggestedUpgrade[];
  onApply: (nextClaim: ClaimItem[]) => Promise<void>;
  onDismiss: () => void;
  disabled?: boolean;
};

/**
 * Centered modal — nothing applies until the user clicks Apply Selected.
 */
export default function SuggestionConfirmModal({
  open,
  roomSlug,
  roomName,
  claimItems,
  sessionItems,
  list,
  onApply,
  onDismiss,
  disabled,
}: SuggestionConfirmModalProps) {
  void roomSlug;
  const [expanded, setExpanded] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(() => new Set(list.map((_, i) => i)));
  const [busy, setBusy] = useState(false);

  useLayoutEffect(() => {
    if (!open) return;
    setExpanded(false);
    setChecked(new Set(list.map((_, i) => i)));
  }, [open, roomSlug, list]);

  const rowIndices = expanded ? list.map((_, i) => i) : list.slice(0, 4).map((_, i) => i);
  const moreCount = expanded ? 0 : Math.max(0, list.length - 4);
  const correctionCount = useMemo(
    () => list.filter((s) => s.type === "RENAME" || s.type === "MOVE").length,
    [list]
  );

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

  if (!open || list.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="suggestion-modal-title"
      onClick={onDismiss}
    >
      <div
        className="relative max-h-[min(90vh,720px)] w-full max-w-lg overflow-y-auto rounded-2xl border border-amber-200 bg-white p-5 shadow-2xl md:max-w-xl md:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-3 top-3 rounded-lg p-2 text-lg leading-none text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          aria-label="Close"
        >
          ✕
        </button>
        <p id="suggestion-modal-title" className="pr-10 text-sm font-bold text-amber-900">
          💡 Suggested changes for this room
        </p>
        <p className="mt-2 text-sm text-amber-800/90">Based on your lifestyle profile</p>
        <p className="mt-2 text-sm text-gray-600">Uncheck any row to exclude it. Nothing changes until you tap Apply Selected.</p>
        <ul className="mt-4 space-y-2">
          {rowIndices.map((i) => {
            const s = list[i]!;
            const delta = getSuggestionDelta(s, claimItems);
            const { text: deltaText, className: deltaClass } = suggestionDeltaColumn(s, delta, "modal");
            const line = formatSuggestionLine(s, delta);
            return (
              <li
                key={i}
                className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-100 bg-gray-50/90 px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 rounded border-gray-300 accent-[#2563EB]"
                  checked={checked.has(i)}
                  disabled={busy || disabled}
                  onChange={() => toggle(i)}
                />
                <span className="min-w-0 flex-1 text-gray-900 [overflow-wrap:anywhere]">{line}</span>
                <span className={`shrink-0 text-sm font-semibold tabular-nums ${deltaClass}`}>{deltaText}</span>
              </li>
            );
          })}
        </ul>
        {correctionCount > 0 ? (
          <p className="mt-3 text-xs text-gray-600">
            Also included: {correctionCount} description correction{correctionCount === 1 ? "" : "s"} (no dollar impact)
          </p>
        ) : null}
        {!expanded && moreCount > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="mt-3 text-sm font-semibold text-[#2563EB] hover:underline"
          >
            ▶ +{moreCount} more
          </button>
        ) : null}
        <p className="mt-4 text-base font-bold text-gray-900 tabular-nums">
          Total to add:{" "}
          <span className={selectedTotalDelta >= 0 ? "text-[#16A34A]" : "text-red-600"}>
            {selectedTotalDelta >= 0 ? "+" : ""}
            {formatCurrency(selectedTotalDelta)}
          </span>
        </p>
        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            disabled={busy || disabled || checked.size === 0}
            onClick={() => void apply()}
            className="min-h-[48px] rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:opacity-40"
          >
            Apply Selected{"  "}
            <span className="tabular-nums">
              {selectedTotalDelta >= 0 ? "+" : ""}
              {formatCurrency(selectedTotalDelta)}
            </span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onDismiss}
            className="min-h-[48px] rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
