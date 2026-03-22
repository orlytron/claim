"use client";

import { useEffect, useMemo, useState } from "react";
import type { SuggestedUpgrade } from "../lib/suggested-upgrades";
import { formatSuggestedUpgradePreview } from "../lib/suggested-upgrades";
import { applySuggestionIndices, suggestionDeltaForClaim } from "../lib/suggestion-apply-engine";
import type { ClaimItem } from "../lib/types";
import { formatCurrency } from "../lib/utils";

function claimSum(c: ClaimItem[]): number {
  return c.reduce((s, i) => s + i.qty * i.unit_cost, 0);
}

export type SuggestionConfirmBannerProps = {
  roomSlug: string;
  roomName: string;
  claimItems: ClaimItem[];
  list: SuggestedUpgrade[];
  onApply: (nextClaim: ClaimItem[]) => Promise<void>;
  onSkip: () => void;
  disabled?: boolean;
};

/**
 * First-visit banner: client confirms which scripted suggestions to apply (nothing auto-applies).
 */
export default function SuggestionConfirmBanner({
  roomSlug,
  roomName,
  claimItems,
  list,
  onApply,
  onSkip,
  disabled,
}: SuggestionConfirmBannerProps) {
  const [expanded, setExpanded] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setExpanded(false);
    const all = new Set(list.map((_, i) => i));
    setChecked(all);
  }, [roomSlug, list]);

  const previewCount = 4;
  const previewIndices = list.slice(0, previewCount).map((_, i) => i);
  const moreCount = Math.max(0, list.length - previewCount);

  const selectedTotalDelta = useMemo(() => {
    const idx = [...checked].filter((i) => i >= 0 && i < list.length).sort((a, b) => a - b);
    if (idx.length === 0) return 0;
    const next = applySuggestionIndices(claimItems, roomName, idx, list);
    return Math.round((claimSum(next) - claimSum(claimItems)) * 100) / 100;
  }, [claimItems, roomName, list, checked]);

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

  const rows = expanded ? list.map((_, i) => i) : previewIndices;

  return (
    <div className="relative z-20 w-full border-b border-amber-200 bg-gradient-to-b from-amber-50 to-amber-50/40 px-4 py-5 md:px-8">
      <div className="mx-auto max-w-[1100px] rounded-2xl border border-amber-200/80 bg-white/95 p-5 shadow-sm md:p-6">
        <p className="text-sm font-bold uppercase tracking-wide text-amber-900">💡 Suggested changes</p>
        <p className="mt-2 text-sm text-gray-600">
          Select what to apply. Nothing is added until you confirm.
        </p>
        <ul className="mt-4 space-y-2">
          {rows.map((i) => {
            const line = formatSuggestedUpgradePreview(list[i]!);
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
                <span className="shrink-0 text-sm font-semibold tabular-nums text-[#16A34A]">
                  {formatCurrency(suggestionDeltaForClaim(claimItems, roomName, list[i]!))}
                </span>
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
            Skip — I&apos;ll do this manually
          </button>
        </div>
      </div>
    </div>
  );
}
