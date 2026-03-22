"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "../../lib/supabase";
import { BUNDLES_DATA } from "../../lib/bundles-data";
import { getClientRoomBundles } from "../../lib/bundles-client-catalog";
import { formatCurrency } from "../../lib/utils";
import { useClaimMode } from "../../lib/useClaimMode";

interface DebugState {
  itemCount: number;
  itemTotal: number;
  bundleDecisionCount: number;
  roomBudgets: Record<string, number>;
  updatedAt: string | null;
  error: string | null;
}

export default function DebugPage() {
  const { mode, setMode, sessionId } = useClaimMode();
  const [state, setState] = useState<DebugState | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, [sessionId]);

  async function load() {
    setLoading(true);
    try {
      const { data: session, error: sessErr } = await supabase
        .from("claim_session")
        .select("claim_items, room_budgets, updated_at")
        .eq("id", sessionId)
        .single();

      const { count: bdCount } = await supabase
        .from("bundle_decisions")
        .select("*", { count: "exact", head: true });

      const items = (session?.claim_items ?? []) as { qty: number; unit_cost: number }[];
      const total = items.reduce((s: number, i: { qty: number; unit_cost: number }) => s + i.qty * i.unit_cost, 0);

      setState({
        itemCount: items.length,
        itemTotal: total,
        bundleDecisionCount: bdCount ?? 0,
        roomBudgets: session?.room_budgets ?? {},
        updatedAt: session?.updated_at ?? null,
        error: sessErr ? sessErr.message : null,
      });
    } catch (e) {
      setState({ itemCount: 0, itemTotal: 0, bundleDecisionCount: 0, roomBudgets: {}, updatedAt: null, error: String(e) });
    } finally {
      setLoading(false);
    }
  }

  const distributed = state ? Object.values(state.roomBudgets).reduce((s, v) => s + v, 0) : 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900">System Debug</h1>
        <div className="flex gap-3">
          <Link href="/admin" className="text-sm text-gray-500 hover:underline">Admin</Link>
          <Link href="/review" className="text-sm text-blue-600 hover:underline">← Review</Link>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-6 py-8 space-y-4">
        {/* Mode toggle */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">Session Mode</p>
          <div className="flex gap-2">
            {(["live", "test"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition-colors capitalize ${mode === m ? (m === "test" ? "bg-orange-500 text-white" : "bg-[#2563EB] text-white") : "bg-gray-100 text-gray-500 hover:bg-gray-200"}`}
              >
                {m}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">Current Session ID: <code className="bg-gray-100 px-1 rounded">{sessionId}</code></p>
        </div>

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-400">Loading…</div>
        ) : state?.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{state.error}</div>
        ) : state ? (
          <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100">
            {[
              ["Current mode", mode.toUpperCase()],
              ["Session ID", sessionId],
              ["claim_items count", String(state.itemCount)],
              ["claim_items total", formatCurrency(state.itemTotal)],
              [
                "BUNDLES_DATA (admin) / client additions",
                `${BUNDLES_DATA.length} / ${getClientRoomBundles().length}`,
              ],
              ["bundle_decisions count", String(state.bundleDecisionCount)],
              ["Room allocations distributed", formatCurrency(distributed)],
              ["Last updated", state.updatedAt ? new Date(state.updatedAt).toLocaleString() : "—"],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between px-5 py-3.5">
                <span className="text-sm text-gray-500">{label}</span>
                <span className={`text-sm font-semibold tabular-nums ${String(value).startsWith("⚠️") ? "text-amber-600" : "text-gray-900"}`}>{value}</span>
              </div>
            ))}

            {Object.keys(state.roomBudgets).length > 0 && (
              <div className="px-5 py-3.5">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Room Allocations</p>
                {Object.entries(state.roomBudgets).map(([room, val]) => (
                  <div key={room} className="flex items-center justify-between py-1">
                    <span className="text-xs text-gray-600">{room}</span>
                    <span className="text-xs font-medium tabular-nums text-gray-900">{formatCurrency(val)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        <button onClick={load} className="w-full rounded-xl border border-gray-200 bg-white py-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
          ↺ Refresh
        </button>
      </main>
    </div>
  );
}
