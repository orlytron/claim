"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { formatCurrency } from "../lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BundleDecision {
  id: string;
  bundle_code: string;
  room: string;
  bundle_name: string;
  action: string;
  total_value: number;
  created_at: string;
}

interface ClientSuggestion {
  id: string;
  room: string | null;
  message: string;
  status: string;
  admin_response: string | null;
  created_at: string;
}

interface RoomSummaryRow {
  room: string;
  item_count: number;
  subtotal: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function Badge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    accepted: "bg-green-100 text-green-700",
    pending: "bg-amber-100 text-amber-700",
    rejected: "bg-gray-100 text-gray-500",
    reviewed: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status}
    </span>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [pwError, setPwError] = useState(false);

  const [claimTotal, setClaimTotal] = useState(0);
  const [targetValue, setTargetValue] = useState(1_600_000);
  const [roomSummary, setRoomSummary] = useState<RoomSummaryRow[]>([]);

  const [decisions, setDecisions] = useState<BundleDecision[]>([]);
  const [decisionsFilter, setDecisionsFilter] = useState<"all" | "accepted" | "rejected" | "pending">("all");

  const [suggestions, setSuggestions] = useState<ClientSuggestion[]>([]);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState("");

  // ── Auth ──────────────────────────────────────────────────────────────────

  useEffect(() => {
    const stored = sessionStorage.getItem("admin_auth");
    setAuthed(stored === "1");
  }, []);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const expected = process.env.NEXT_PUBLIC_ADMIN_PASSWORD ?? "admin";
    if (password === expected) {
      sessionStorage.setItem("admin_auth", "1");
      setAuthed(true);
    } else {
      setPwError(true);
    }
  }

  // ── Data fetch ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!authed) return;
    fetchAll();
  }, [authed]);

  async function fetchAll() {
    // Claim session
    const { data: session } = await supabase
      .from("claim_session")
      .select("claim_items, room_summary, target_value")
      .eq("id", "trial")
      .single();

    if (session) {
      setTargetValue(session.target_value ?? 1_600_000);
      const items = (session.claim_items ?? []) as { qty: number; unit_cost: number }[];
      setClaimTotal(items.reduce((s, i) => s + i.qty * i.unit_cost, 0));
      setRoomSummary(session.room_summary ?? []);
    }

    // Bundle decisions
    const { data: dec } = await supabase
      .from("bundle_decisions")
      .select("*")
      .order("created_at", { ascending: false });
    setDecisions((dec as BundleDecision[]) ?? []);

    // Client suggestions
    const { data: sug } = await supabase
      .from("client_suggestions")
      .select("*")
      .order("created_at", { ascending: false });
    setSuggestions((sug as ClientSuggestion[]) ?? []);
  }

  async function markReviewed(id: string) {
    await supabase
      .from("client_suggestions")
      .update({ status: "reviewed" })
      .eq("id", id);
    setSuggestions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status: "reviewed" } : s))
    );
  }

  async function saveResponse(id: string) {
    await supabase
      .from("client_suggestions")
      .update({ admin_response: responseText, status: "reviewed" })
      .eq("id", id);
    setSuggestions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, admin_response: responseText, status: "reviewed" } : s
      )
    );
    setRespondingId(null);
    setResponseText("");
  }

  // ── Loading state ─────────────────────────────────────────────────────────

  if (authed === null) return null;

  // ── Password gate ──────────────────────────────────────────────────────────

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 w-full max-w-sm">
          <h1 className="text-lg font-semibold text-gray-900 mb-1">Admin Access</h1>
          <p className="text-sm text-gray-500 mb-6">Israel Claim · #7579B726D</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setPwError(false); }}
                className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
              {pwError && <p className="text-xs text-red-600 mt-1">Incorrect password.</p>}
            </div>
            <button
              type="submit"
              className="w-full rounded-md bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Enter
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Admin dashboard ────────────────────────────────────────────────────────

  const pct = targetValue > 0 ? Math.min(100, (claimTotal / targetValue) * 100) : 0;
  const filteredDecisions = decisionsFilter === "all"
    ? decisions
    : decisions.filter((d) => d.action === decisionsFilter);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Admin Dashboard</h1>
          <p className="text-xs text-gray-400">Israel Claim · #7579B726D</p>
        </div>
        <div className="flex gap-3">
          <a
            href="/review"
            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            ← Back to Review
          </a>
          <button
            onClick={() => { sessionStorage.removeItem("admin_auth"); setAuthed(false); }}
            className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50"
          >
            Logout
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-10">

        {/* ── SECTION 1: Claim Overview ──────────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
            Claim Overview
          </h2>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-3xl font-bold tabular-nums text-gray-900">
                  {formatCurrency(claimTotal)}
                </p>
                <p className="text-sm text-gray-500 mt-0.5">
                  of {formatCurrency(targetValue)} target
                </p>
              </div>
              <p className="text-xl font-semibold text-[#2563EB]">{pct.toFixed(1)}%</p>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-[#2563EB] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-gray-400">
              Gap: {formatCurrency(targetValue - claimTotal)} remaining
            </p>

            {/* Room breakdown */}
            {roomSummary.length > 0 && (
              <div className="mt-6 border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
                  Room Breakdown
                </p>
                <div className="space-y-2">
                  {roomSummary.map((r) => (
                    <div key={r.room} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{r.room}</span>
                      <div className="flex items-center gap-3 text-gray-500">
                        <span className="text-xs">{r.item_count} items</span>
                        <span className="tabular-nums font-medium text-gray-900">
                          {formatCurrency(r.subtotal)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── SECTION 2: Bundle Decisions ────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
              Bundle Decisions
            </h2>
            <div className="flex gap-1">
              {(["all", "accepted", "pending", "rejected"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setDecisionsFilter(f)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    decisionsFilter === f
                      ? "bg-[#2563EB] text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            {filteredDecisions.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">No bundle decisions yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="border-b border-gray-100">
                  <tr className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Room</th>
                    <th className="px-4 py-3 text-left">Bundle</th>
                    <th className="px-4 py-3 text-left">Action</th>
                    <th className="px-4 py-3 text-right">Value</th>
                    <th className="px-4 py-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredDecisions.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-gray-700">{d.room}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{d.bundle_name}</p>
                        <p className="text-xs text-gray-400 font-mono">{d.bundle_code}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge status={d.action} />
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">
                        {formatCurrency(d.total_value)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-400">
                        {formatDate(d.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ── SECTION 3: Client Suggestions ──────────────────────────────────── */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400 mb-4">
            Client Suggestions ({suggestions.filter((s) => s.status === "pending").length} pending)
          </h2>

          <div className="space-y-3">
            {suggestions.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 py-10 text-center text-sm text-gray-400">
                No suggestions yet.
              </div>
            ) : (
              suggestions.map((s) => (
                <div
                  key={s.id}
                  className={`bg-white rounded-xl border p-4 ${
                    s.status === "pending" ? "border-amber-200" : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {s.room && (
                        <p className="text-xs font-medium text-[#2563EB] mb-1">{s.room}</p>
                      )}
                      <p className="text-sm text-gray-900">{s.message}</p>
                      {s.admin_response && (
                        <p className="mt-2 text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2">
                          Response: {s.admin_response}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-2">
                      <Badge status={s.status} />
                      <p className="text-xs text-gray-400">{formatDate(s.created_at)}</p>
                    </div>
                  </div>

                  {/* Admin actions */}
                  {s.status === "pending" && respondingId !== s.id && (
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => markReviewed(s.id)}
                        className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2.5 py-1"
                      >
                        Mark as reviewed
                      </button>
                      <button
                        onClick={() => { setRespondingId(s.id); setResponseText(""); }}
                        className="text-xs text-[#2563EB] hover:underline border border-blue-200 rounded px-2.5 py-1"
                      >
                        Add note
                      </button>
                    </div>
                  )}

                  {respondingId === s.id && (
                    <div className="mt-3 space-y-2">
                      <textarea
                        value={responseText}
                        onChange={(e) => setResponseText(e.target.value)}
                        rows={2}
                        placeholder="Add an admin note…"
                        className="w-full rounded border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveResponse(s.id)}
                          className="rounded bg-[#2563EB] px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setRespondingId(null)}
                          className="text-xs text-gray-400 hover:text-gray-600"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
