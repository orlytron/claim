"use client";

import { useLayoutEffect, useMemo, useState } from "react";
import type { SuggestedUpgrade } from "../lib/suggested-upgrades";
import { formatSuggestedUpgradeLineWithClaim } from "../lib/suggested-upgrades";
import {
  applySuggestionIndices,
  findClaimLineInRoom,
  getSuggestionDelta,
  suggestionCollapsedHiddenCount,
  suggestionCollapsedRowIndices,
  suggestionSelectedDeltaSum,
} from "../lib/suggestion-apply-engine";
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

function lineLabel(claim: ClaimItem[], room: string, s: SuggestedUpgrade): string {
  return formatSuggestedUpgradeLineWithClaim(claim, room, s).replace(/^☑\s*/, "").trim();
}

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
          disabled={busy}
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
            const deltaLabel =
              delta > 0 ? `+${formatCurrency(delta)}` : delta < 0 ? formatCurrency(delta) : formatCurrency(0);
            const deltaClass =
              delta > 0 ? "text-[#16A34A]" : delta < 0 ? "text-red-600" : "text-[#6B7280]";

            if (s.type === "SPLIT") {
              const orig = findClaimLineInRoom(claimItems, roomName, s.match_description);
              const origTotal = orig ? orig.qty * orig.unit_cost : 0;
              const origLineStr = orig
                ? `${orig.qty} × ${orig.description} @ ${formatCurrency(orig.unit_cost)} = ${formatCurrency(origTotal)}`
                : "—";
              const aTot = s.item_a.qty * s.item_a.unit_cost;
              const bTot = s.item_b.qty * s.item_b.unit_cost;
              return (
                <li key={i} className="rounded-lg border border-gray-100 bg-gray-50/90 px-3 py-2 text-sm">
                  <div className="flex gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 accent-[#2563EB]"
                      checked={checked.has(i)}
                      disabled={busy || disabled}
                      onChange={() => toggle(i)}
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="font-medium text-gray-900 [overflow-wrap:anywhere]">
                        {s.match_description}{" "}
                        <span className="text-sm font-normal italic text-gray-500">↕ replaced with:</span>
                      </p>
                      <p className="pl-2 text-sm text-gray-500 line-through">{origLineStr}</p>
                      <p className="pl-4 text-sm text-[#16A34A]">
                        + {s.item_a.description} {s.item_a.qty} × {formatCurrency(s.item_a.unit_cost)}
                        <span className="ml-2 font-semibold tabular-nums">+{formatCurrency(aTot)}</span>
                      </p>
                      <p className="pl-4 text-sm text-[#16A34A]">
                        + {s.item_b.description} {s.item_b.qty} × {formatCurrency(s.item_b.unit_cost)}
                        <span className="ml-2 font-semibold tabular-nums">+{formatCurrency(bTot)}</span>
                      </p>
                    </div>
                    <span className={`shrink-0 self-start text-sm font-bold tabular-nums ${deltaClass}`}>{deltaLabel}</span>
                  </div>
                </li>
              );
            }

            const line = lineLabel(claimItems, roomName, s);
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
