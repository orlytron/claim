"use client";

import { useMemo, useState } from "react";
import { SUGGESTED_UPGRADES } from "../lib/suggested-upgrades";
import { buildRoomSuggestionSummary } from "../lib/suggestion-original-summary";
import { formatCurrency } from "../lib/utils";

export type SuggestionConfirmBannerProps = {
  roomName: string;
  /** Primary dismiss — typically persists “seen” and closes. */
  onApplySuggestions: () => void;
  /** Dismiss without persisting seen state. */
  onSkipForNow: () => void;
};

/**
 * Informational summary vs original claim (suggestions already reflected in data).
 */
export default function SuggestionConfirmBanner({
  roomName,
  onApplySuggestions,
  onSkipForNow,
}: SuggestionConfirmBannerProps) {
  const [expanded, setExpanded] = useState(false);

  const { main, meta, totalDelta, hasSuggestions } = useMemo(() => {
    const list = SUGGESTED_UPGRADES[roomName] ?? [];
    const sum = buildRoomSuggestionSummary(roomName, list);
    return { ...sum, hasSuggestions: list.length > 0 };
  }, [roomName]);

  const visibleMain = expanded ? main : main.slice(0, 4);
  const moreCount = Math.max(0, main.length - 4);
  const showMetaSection = meta.length > 0 && (expanded || main.length === 0);

  if (!hasSuggestions || (main.length === 0 && meta.length === 0)) return null;

  return (
    <div className="relative z-20 w-full border-b border-amber-200 bg-gradient-to-b from-amber-50/90 to-white px-4 py-5 md:px-8">
      <div className="mx-auto max-w-[1100px] rounded-2xl border border-amber-200/80 bg-white p-5 shadow-sm md:p-6">
        <p className="text-sm font-bold uppercase tracking-wide text-amber-950">Suggested changes for this room</p>
        <p className="mt-3 text-base text-gray-700">
          Based on your lifestyle profile, we recommend these updates
        </p>

        <ul className="mt-4 space-y-3 text-sm text-gray-900">
          {visibleMain.map((row, idx) => {
            if (row.kind === "simple") {
              return (
                <li key={`m-${idx}`} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 tabular-nums">
                  <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{row.text}</span>
                </li>
              );
            }
            if (row.kind === "split") {
              const d = row.detail;
              const net = row.delta;
              const netClass = net >= 0 ? "text-[#16A34A]" : "text-red-600";
              return (
                <li key={`m-${idx}`} className="rounded-lg border border-gray-100 bg-gray-50/80 px-3 py-2">
                  <p className="font-medium text-gray-900 [overflow-wrap:anywhere]">
                    {d.matchLabel}{" "}
                    <span className="text-sm font-normal italic text-gray-500">↕ replaced with:</span>
                  </p>
                  <p className="mt-2 pl-2 text-sm text-gray-500 line-through">{d.originalLine}</p>
                  {d.partLines.map((p, j) => (
                    <p key={j} className="mt-1 pl-4 text-sm text-[#16A34A]">
                      + {p.label}
                      <span className="ml-2 font-semibold tabular-nums">+{formatCurrency(p.lineTotal)}</span>
                    </p>
                  ))}
                  <p className={`mt-2 border-t border-gray-200 pt-2 pl-2 text-sm font-bold tabular-nums ${netClass}`}>
                    Net change: {net >= 0 ? "+" : ""}
                    {formatCurrency(net)}
                  </p>
                </li>
              );
            }
            return null;
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

        {showMetaSection ? (
          <div className={`${main.length > 0 ? "mt-5 border-t border-gray-200 pt-4" : "mt-4"}`}>
            <p className="text-xs font-bold uppercase tracking-wide text-gray-500">
              {main.length === 0 ? "Suggested changes based on your profile" : "Also updated (no value change)"}
            </p>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              {meta.map((row, i) => (
                <li key={`meta-${i}`} className="[overflow-wrap:anywhere]">
                  {row.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {main.length > 0 ? (
          <p className="mt-5 text-base font-bold text-gray-900">
            {totalDelta >= 0 ? "Total to add:" : "Net change:"}{" "}
            <span className={`tabular-nums ${totalDelta >= 0 ? "text-[#16A34A]" : "text-red-600"}`}>
              {totalDelta >= 0 ? "+" : ""}
              {formatCurrency(totalDelta)}
            </span>
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={onApplySuggestions}
            className="min-h-[48px] rounded-xl bg-[#2563EB] px-6 text-base font-bold text-white shadow-sm transition hover:bg-blue-700"
          >
            Apply Suggestions
            {main.length > 0 && totalDelta > 0 ? (
              <span className="tabular-nums"> +{formatCurrency(totalDelta)}</span>
            ) : null}
          </button>
          <button
            type="button"
            onClick={onSkipForNow}
            className="min-h-[48px] rounded-xl border border-gray-300 bg-white px-6 text-base font-semibold text-gray-800 hover:bg-gray-50"
          >
            Skip for now
          </button>
        </div>
      </div>
    </div>
  );
}
