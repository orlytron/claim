"use client";

import { useEffect, useState } from "react";
import { formatSuggestedUpgradePreview, type SuggestedUpgrade } from "../../lib/suggested-upgrades";
import type { ClaimItem } from "../../lib/types";

export type SuggestionRevertSpec =
  | { key: string; label: string; kind: "item"; item: ClaimItem }
  | { key: string; label: string; kind: "remove"; match_description: string };

type Props = {
  roomSlug: string;
  roomSuggestionList: SuggestedUpgrade[];
  suggestionPreviewLines: string[];
  suggestionMoreCount: number;
  suggestionRevertSpecs: SuggestionRevertSpec[];
  isSaving: boolean;
  onDismiss: () => void;
  onRevert: (spec: SuggestionRevertSpec) => void;
};

export function SuggestionsBanner({
  roomSlug,
  roomSuggestionList,
  suggestionPreviewLines,
  suggestionMoreCount,
  suggestionRevertSpecs,
  isSaving,
  onDismiss,
  onRevert,
}: Props) {
  const [reviewOpen, setReviewOpen] = useState(false);

  useEffect(() => {
    setReviewOpen(false);
  }, [roomSlug]);

  return (
    <div className="relative z-20 w-full border-b border-amber-200 bg-gradient-to-b from-amber-50 to-amber-50/40 px-4 py-5 md:px-8">
      <div className="mx-auto max-w-[1100px] rounded-2xl border border-amber-200/80 bg-white/90 p-5 shadow-sm md:p-6">
        <p className="text-sm font-bold uppercase tracking-wide text-amber-900">
          💡 Suggested upgrades for this room
        </p>
        <p className="mt-2 text-sm leading-relaxed text-gray-700">
          Based on this household&apos;s profile, we&apos;ve pre-loaded{" "}
          <span className="font-semibold text-gray-900">{roomSuggestionList.length}</span> suggested updates:
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-gray-800">
          {suggestionPreviewLines.map((line, i) => (
            <li key={i} className="[overflow-wrap:anywhere]">
              {line}
            </li>
          ))}
        </ul>
        {suggestionMoreCount > 0 ? (
          <p className="mt-2 text-sm text-gray-600">… and {suggestionMoreCount} more</p>
        ) : null}
        <p className="mt-4 text-sm font-medium text-gray-800">
          These have already been applied. You can adjust anything below.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onDismiss}
            className="rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700"
          >
            Got it, let&apos;s go →
          </button>
          <button
            type="button"
            onClick={() => setReviewOpen((o) => !o)}
            className="text-sm font-semibold text-[#2563EB] underline-offset-2 hover:underline"
          >
            {reviewOpen ? "Hide changes" : "Review changes"}
          </button>
        </div>
        {reviewOpen ? (
          <div className="mt-6 border-t border-amber-100 pt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-gray-600">Undo individual updates</p>
            {suggestionRevertSpecs.length === 0 ? (
              <p className="mt-2 text-sm text-gray-500">
                No revert targets found on this claim (already reverted or session not updated yet).
              </p>
            ) : (
              <ul className="mt-3 space-y-3">
                {suggestionRevertSpecs.map((spec) => (
                  <li
                    key={spec.key}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 flex-1 text-gray-800 [overflow-wrap:anywhere]">{spec.label}</span>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => void onRevert(spec)}
                      className="shrink-0 rounded-md border border-gray-300 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:border-red-300 hover:text-red-700 disabled:opacity-40"
                    >
                      Revert this change
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gray-500">Full list (reference)</p>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {roomSuggestionList.map((s, i) => (
                <li key={i} className="[overflow-wrap:anywhere]">
                  {formatSuggestedUpgradePreview(s)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  );
}
