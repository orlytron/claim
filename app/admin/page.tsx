"use client";

import { useEffect, useState, useCallback } from "react";
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
  note: string | null;
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

// Unified feedback item
interface FeedbackItem {
  id: string;
  type: "bundle_note" | "suggestion";
  room: string | null;
  bundle_name?: string;
  bundle_code?: string;
  message: string;
  status: string;
  admin_response: string | null;
  created_at: string;
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
    regenerated: "bg-purple-100 text-purple-700",
    pending: "bg-amber-100 text-amber-700",
    rejected: "bg-gray-100 text-gray-500",
    reviewed: "bg-blue-100 text-blue-700",
    noted: "bg-sky-100 text-sky-700",
  };
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? "bg-gray-100 text-gray-500"}`}
    >
      {status}
    </span>
  );
}

function TypeBadge({ type }: { type: "bundle_note" | "suggestion" }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        type === "bundle_note"
          ? "bg-purple-50 text-purple-600 border border-purple-200"
          : "bg-blue-50 text-blue-600 border border-blue-200"
      }`}
    >
      {type === "bundle_note" ? "📦 bundle note" : "💬 suggestion"}
    </span>
  );
}

// ── Inline editable admin response ───────────────────────────────────────────

function InlineResponse({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (text: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  async function handleBlur() {
    if (text === (value ?? "")) {
      setEditing(false);
      return;
    }
    setSaving(true);
    await onSave(text);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        rows={2}
        autoFocus
        placeholder="Add admin note…"
        className={`w-full rounded border border-blue-300 px-2 py-1.5 text-xs text-gray-700 focus:outline-none resize-none ${
          saving ? "opacity-50" : ""
        }`}
      />
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="block w-full text-left text-xs text-gray-500 border border-dashed border-gray-200 rounded px-2 py-1.5 hover:border-gray-300 hover:bg-gray-50 transition-colors"
    >
      {value ? (
        <span className="italic">{value}</span>
      ) : (
        <span className="text-gray-400">Click to add note…</span>
      )}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [claimTotal, setClaimTotal] = useState(0);
  const [targetValue, setTargetValue] = useState(1_600_000);
  const [roomSummary, setRoomSummary] = useState<RoomSummaryRow[]>([]);

  const [decisions, setDecisions] = useState<BundleDecision[]>([]);
  const [decisionsFilter, setDecisionsFilter] = useState<"all" | "accepted" | "rejected" | "noted" | "regenerated">("all");

  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [feedbackFilter, setFeedbackFilter] = useState<"all" | "bundle_note" | "suggestion">("all");
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

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

    // Bundle notes (decisions with a non-null note)
    const bundleNotes: FeedbackItem[] = ((dec as BundleDecision[]) ?? [])
      .filter((d) => d.note)
      .map((d) => ({
        id: `bn-${d.id}`,
        type: "bundle_note",
        room: d.room,
        bundle_name: d.bundle_name,
        bundle_code: d.bundle_code,
        message: d.note!,
        status: d.action,
        admin_response: null,
        created_at: d.created_at,
      }));

    const suggestions: FeedbackItem[] = ((sug as ClientSuggestion[]) ?? []).map((s) => ({
      id: s.id,
      type: "suggestion",
      room: s.room,
      message: s.message,
      status: s.status,
      admin_response: s.admin_response,
      created_at: s.created_at,
    }));

    const combined = [...bundleNotes, ...suggestions].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    setFeedback(combined);
  }

  const updateSuggestionResponse = useCallback(
    async (id: string, text: string) => {
      await supabase
        .from("client_suggestions")
        .update({ admin_response: text || null, status: "reviewed" })
        .eq("id", id);
      setFeedback((prev) =>
        prev.map((f) =>
          f.id === id ? { ...f, admin_response: text || null, status: "reviewed" } : f
        )
      );
    },
    []
  );

  function buildClaudePrompt(item: FeedbackItem) {
    const roomBudget = 0; // Could look up from session
    if (item.type === "bundle_note") {
      return `Client note on ${item.room} bundle "${item.bundle_name}": '${item.message}'. Generate an adjusted bundle for ${item.room} that addresses this feedback while maintaining the $${roomBudget > 0 ? roomBudget.toLocaleString() : "target"} total for this room.`;
    }
    return `Client suggestion${item.room ? ` for ${item.room}` : ""}: '${item.message}'. Generate an adjusted bundle${item.room ? ` for ${item.room}` : ""} that addresses this feedback.`;
  }

  function handleCopyPrompt(item: FeedbackItem) {
    navigator.clipboard.writeText(buildClaudePrompt(item));
    setCopied(item.id);
    setTimeout(() => setCopied(null), 2000);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const pct = targetValue > 0 ? Math.min(100, (claimTotal / targetValue) * 100) : 0;
  const filteredDecisions =
    decisionsFilter === "all"
      ? decisions
      : decisions.filter((d) => d.action === decisionsFilter);
  const filteredFeedback =
    feedbackFilter === "all"
      ? feedback
      : feedback.filter((f) => f.type === feedbackFilter);

  const pendingCount = feedback.filter(
    (f) => f.type === "suggestion" && f.status === "pending"
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Admin View — Israel Claim</h1>
          <p className="text-xs text-gray-400">Claim #7579B726D · Internal use only</p>
        </div>
        <a
          href="/review"
          className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          ← Back to Review
        </a>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-10">

        {/* ── SECTION 1: Claim Overview ─────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
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
              <div className="text-right">
                <p className="text-xl font-semibold text-[#2563EB]">{pct.toFixed(1)}%</p>
                <p className="text-xs text-gray-400">
                  Gap: {formatCurrency(targetValue - claimTotal)}
                </p>
              </div>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-[#2563EB] transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>

            {roomSummary.length > 0 && (
              <div className="mt-5 border-t border-gray-100 pt-4 grid grid-cols-2 gap-x-6 gap-y-2">
                {roomSummary.map((r) => (
                  <div key={r.room} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700 truncate">{r.room}</span>
                    <span className="tabular-nums font-medium text-gray-900 ml-2 shrink-0">
                      {formatCurrency(r.subtotal)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ── SECTION 2: Bundle Decisions ──────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Bundle Decisions
            </h2>
            <div className="flex gap-1 flex-wrap">
              {(["all", "accepted", "regenerated", "noted", "rejected"] as const).map((f) => (
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
                <thead className="border-b border-gray-100 bg-gray-50">
                  <tr className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">Room</th>
                    <th className="px-4 py-3 text-left">Bundle</th>
                    <th className="px-4 py-3 text-left">Action</th>
                    <th className="px-4 py-3 text-left">Note</th>
                    <th className="px-4 py-3 text-right">Value</th>
                    <th className="px-4 py-3 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredDecisions.map((d) => (
                    <tr key={d.id} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3 text-gray-700 text-sm">{d.room}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-gray-900">{d.bundle_name}</p>
                        <p className="text-xs text-gray-400 font-mono">{d.bundle_code}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge status={d.action} />
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {d.note ? (
                          <p className="text-xs text-gray-500 italic truncate">{d.note}</p>
                        ) : (
                          <span className="text-xs text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium text-gray-900">
                        {formatCurrency(d.total_value)}
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-gray-400 whitespace-nowrap">
                        {formatDate(d.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* ── SECTION 3: Client Feedback ────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
              Client Feedback{pendingCount > 0 && ` (${pendingCount} pending)`}
            </h2>
            <div className="flex gap-1">
              {(["all", "suggestion", "bundle_note"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFeedbackFilter(f)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    feedbackFilter === f
                      ? "bg-[#2563EB] text-white"
                      : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {f === "bundle_note" ? "bundle notes" : f}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredFeedback.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 py-10 text-center text-sm text-gray-400">
                No feedback yet.
              </div>
            ) : (
              filteredFeedback.map((item) => (
                <div
                  key={item.id}
                  className={`bg-white rounded-xl border p-4 ${
                    item.type === "suggestion" && item.status === "pending"
                      ? "border-amber-200"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <TypeBadge type={item.type} />
                      {item.room && (
                        <span className="text-xs font-medium text-[#2563EB]">{item.room}</span>
                      )}
                      {item.bundle_name && (
                        <span className="text-xs text-gray-400">"{item.bundle_name}"</span>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <Badge status={item.status} />
                      <p className="text-xs text-gray-400">{formatDate(item.created_at)}</p>
                    </div>
                  </div>

                  <p className="text-sm text-gray-900 mb-3">{item.message}</p>

                  {/* Admin response — inline editable */}
                  <div className="mb-3">
                    {item.type === "suggestion" ? (
                      <InlineResponse
                        value={item.admin_response}
                        onSave={(text) => updateSuggestionResponse(item.id, text)}
                      />
                    ) : (
                      item.admin_response && (
                        <p className="text-xs text-gray-500 italic border-l-2 border-gray-200 pl-2">
                          {item.admin_response}
                        </p>
                      )
                    )}
                  </div>

                  {/* Copy as Claude prompt */}
                  <button
                    onClick={() => handleCopyPrompt(item)}
                    className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded px-2.5 py-1 transition-colors"
                  >
                    {copied === item.id ? "✓ Copied!" : "Copy as Claude prompt"}
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
