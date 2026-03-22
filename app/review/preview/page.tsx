"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  EXPORT_ROOM_ORDER,
  displayRoomForExport,
  sortClaimItemsForExport,
} from "../../lib/claim-export-shared";
import { loadSession } from "../../lib/session";
import type { ClaimItem } from "../../lib/types";
import { formatCurrency } from "../../lib/utils";
import { useClaimMode } from "../../lib/useClaimMode";

function roomSortName(room: string) {
  const d = displayRoomForExport(room);
  const i = EXPORT_ROOM_ORDER.indexOf(d);
  return i === -1 ? 999 : i;
}

export default function ClaimPreviewPage() {
  const { sessionId, hydrated } = useClaimMode();
  const [items, setItems] = useState<ClaimItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sess = await loadSession(sessionId);
      setItems((sess?.claim_items ?? []) as ClaimItem[]);
    } catch {
      setError("Could not load claim. Check your connection and try again.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!hydrated) return;
    void refresh();
  }, [hydrated, refresh]);

  const sorted = useMemo(() => sortClaimItemsForExport(items), [items]);

  const byRoom = useMemo(() => {
    const m = new Map<string, ClaimItem[]>();
    for (const it of sorted) {
      const r = displayRoomForExport(it.room);
      m.set(r, [...(m.get(r) ?? []), it]);
    }
    return [...m.entries()].sort((a, b) => roomSortName(a[0]) - roomSortName(b[0]));
  }, [sorted]);

  const grandTotal = useMemo(() => items.reduce((s, i) => s + i.qty * i.unit_cost, 0), [items]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-gray-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      <header className="border-b border-gray-200 bg-white px-4 py-4 md:px-8">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/review" className="text-sm font-medium text-[#2563EB] hover:underline">
              ← Dashboard
            </Link>
            <h1 className="mt-2 text-xl font-bold text-gray-900">Full claim preview</h1>
            <p className="text-sm text-gray-500">Read-only · Session: {sessionId}</p>
          </div>
          <a
            href={`/api/export-xact?sessionId=${encodeURIComponent(sessionId)}`}
            className="inline-flex min-h-[48px] items-center rounded-xl bg-[#16A34A] px-5 text-sm font-bold text-white hover:bg-green-700"
          >
            Download .xls
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 md:px-8">
        {loading ? (
          <div className="animate-pulse space-y-6">
            <div className="h-24 rounded-2xl bg-gray-200" />
            <div className="h-48 rounded-2xl bg-gray-100" />
            <div className="h-48 rounded-2xl bg-gray-100" />
            <p className="text-center text-sm text-gray-500">Loading claim…</p>
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800">
            {error}
            <button
              type="button"
              onClick={() => void refresh()}
              className="mt-4 block w-full rounded-lg bg-red-700 py-3 text-white md:mx-auto md:w-auto md:px-6"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="mb-8 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap gap-6 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase text-gray-400">Items</p>
                  <p className="text-2xl font-bold tabular-nums text-gray-900">{items.length}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase text-gray-400">Grand total</p>
                  <p className="text-2xl font-bold tabular-nums text-[#2563EB]">{formatCurrency(grandTotal)}</p>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              {byRoom.map(([room, lines]) => {
                const sub = lines.reduce((s, i) => s + i.qty * i.unit_cost, 0);
                return (
                  <section key={room} className="rounded-2xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 md:px-6">
                      <h2 className="text-lg font-bold text-gray-900">{room}</h2>
                      <p className="text-sm font-semibold tabular-nums text-gray-700">
                        {lines.length} lines · {formatCurrency(sub)}
                      </p>
                    </div>
                    <ul className="divide-y divide-gray-100">
                      {lines.map((it, idx) => (
                        <li
                          key={`${it.description}-${idx}`}
                          className="flex flex-col gap-1 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between md:px-6"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-gray-900 [overflow-wrap:anywhere]">{it.description}</p>
                            <p className="text-xs text-gray-500">
                              {[it.brand, it.model].filter(Boolean).join(" · ") || "—"} · Qty {it.qty} ·{" "}
                              {it.category || "—"}
                              {it.source ? ` · ${it.source}` : ""}
                            </p>
                          </div>
                          <p className="shrink-0 tabular-nums font-semibold text-gray-900">
                            {formatCurrency(it.qty * it.unit_cost)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
