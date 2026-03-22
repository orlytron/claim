"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import ClientSuggestionForm from "../components/ClientSuggestionForm";
import { mergeClaimIncoming } from "../lib/claim-item-merge";
import { supabase } from "../lib/supabase";
import type { ClaimItem } from "../lib/types";
import { ORIGINAL_CLAIM_ITEMS, ORIGINAL_TOTAL } from "../lib/original-claim-data";
import { formatCurrency } from "../lib/utils";

export type ParsedArtItem = {
  description: string;
  artist: string;
  medium: string;
  size: string;
  unit_cost: number;
};

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
    partial_accept: "bg-emerald-100 text-emerald-800",
    regenerated: "bg-purple-100 text-purple-700",
    pending: "bg-amber-100 text-amber-700",
    rejected: "bg-gray-100 text-gray-500",
    reviewed: "bg-blue-100 text-blue-700",
    resolved: "bg-slate-200 text-slate-700",
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
  const [decisionsFilter, setDecisionsFilter] = useState<
    "all" | "accepted" | "partial_accept" | "rejected" | "noted" | "regenerated"
  >("all");

  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [feedbackFilter, setFeedbackFilter] = useState<"all" | "bundle_note" | "suggestion">("all");
  const [copied, setCopied] = useState<string | null>(null);

  // FIX 6: Reset state
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  const [artParsed, setArtParsed] = useState<ParsedArtItem[]>([]);
  const [artChecked, setArtChecked] = useState<boolean[]>([]);
  const [artLoading, setArtLoading] = useState(false);
  const [artError, setArtError] = useState<string | null>(null);
  const [artAdding, setArtAdding] = useState(false);

  const [claimItems, setClaimItems] = useState<ClaimItem[]>([]);
  const [rawSuggestions, setRawSuggestions] = useState<ClientSuggestion[]>([]);
  const [cacheStats, setCacheStats] = useState<{
    total_cached: number;
    verified_serpapi: number;
    items_three_plus_options: number;
  } | null>(null);

  const adminStats = useMemo(() => {
    const byRoom: Record<string, { count: number; value: number }> = {};
    let upgraded = 0;
    let bundleLines = 0;
    let suggestionLines = 0;
    for (const i of claimItems) {
      const r = i.room || "Uncategorized";
      if (!byRoom[r]) byRoom[r] = { count: 0, value: 0 };
      byRoom[r]!.count += 1;
      byRoom[r]!.value += i.qty * i.unit_cost;
      if (i.source === "upgrade") upgraded += 1;
      if (i.source === "bundle") bundleLines += 1;
      if (i.source === "suggestion") suggestionLines += 1;
    }
    return { byRoom, upgraded, bundleLines, suggestionLines, totalLines: claimItems.length };
  }, [claimItems]);

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    void fetch("/api/admin/cache-stats")
      .then((r) => r.json())
      .then((j) => {
        if (j && typeof j.total_cached === "number") setCacheStats(j);
        else setCacheStats(null);
      })
      .catch(() => setCacheStats(null));
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
      const items = (session.claim_items ?? []) as ClaimItem[];
      setClaimItems(items);
      setClaimTotal(items.reduce((s, i) => s + i.qty * i.unit_cost, 0));
      setRoomSummary(session.room_summary ?? []);
    } else {
      setClaimItems([]);
      setClaimTotal(0);
      setRoomSummary([]);
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

  async function markSuggestionResolved(id: string) {
    await supabase.from("client_suggestions").update({ status: "resolved" }).eq("id", id);
    await fetchAll();
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

  // FIX 6: Reset handler
  async function handleReset() {
    setResetLoading(true);
    setResetMsg(null);
    try {
      const res = await fetch("/api/admin/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: "trial" }) });
      const data = await res.json();
      if (data.success) {
        setResetMsg(`✓ ${data.message}`);
        setResetConfirm(false);
        fetchAll();
      } else {
        setResetMsg(`Error: ${data.error}`);
      }
    } catch (e) {
      setResetMsg("Network error — reset failed");
    } finally {
      setResetLoading(false);
    }
  }

  // FIX 7: Copy live to test
  async function handleArtPdfUpload(file: File) {
    if (file.type !== "application/pdf") {
      setArtError("Please choose a PDF file.");
      return;
    }
    setArtError(null);
    setArtLoading(true);
    setArtParsed([]);
    setArtChecked([]);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("read failed"));
        r.readAsDataURL(file);
      });
      const base64Data = dataUrl.includes(",") ? dataUrl.split(",")[1]! : dataUrl;
      const res = await fetch("/api/parse-art-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Data }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || res.statusText);
      const rows = body as ParsedArtItem[];
      if (!Array.isArray(rows)) throw new Error("Invalid response");
      setArtParsed(rows);
      setArtChecked(rows.map(() => true));
    } catch (e) {
      setArtError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setArtLoading(false);
    }
  }

  async function handleAddArtToClaim() {
    const rows = artParsed.filter((_, i) => artChecked[i]);
    if (rows.length === 0) return;
    setArtAdding(true);
    setArtError(null);
    try {
      const { data: session, error: loadErr } = await supabase
        .from("claim_session")
        .select("claim_items")
        .eq("id", "trial")
        .single();
      if (loadErr) throw new Error(loadErr.message);
      const current = (session?.claim_items ?? []) as ClaimItem[];
      const incoming: ClaimItem[] = rows.map((row) => ({
        room: "Art Collection",
        description: row.description,
        brand: row.artist,
        model: [row.medium, row.size].filter(Boolean).join(" · "),
        qty: 1,
        age_years: 0,
        age_months: 0,
        condition: "Listed",
        unit_cost: row.unit_cost,
        category: "Art",
        source: "art",
      }));
      const merged = mergeClaimIncoming(current, incoming, "art");
      const { error: upErr } = await supabase
        .from("claim_session")
        .update({
          claim_items: merged,
          updated_at: new Date().toISOString(),
        })
        .eq("id", "trial");
      if (upErr) throw new Error(upErr.message);
      await fetchAll();
    } catch (e) {
      setArtError(e instanceof Error ? e.message : "Failed to add items");
    } finally {
      setArtAdding(false);
    }
  }

  async function handleCopyToTest() {
    const { data: live } = await supabase.from("claim_session").select("*").eq("id", "trial").single();
    if (!live) { alert("Could not load live session"); return; }
    const { error } = await supabase.from("claim_session").upsert({ ...live, id: "test", updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) { alert("Failed: " + error.message); return; }
    alert("Live session copied to test session successfully.");
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
      <header className="border-b border-gray-200 bg-white px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">Admin View — Israel Claim</h1>
          <p className="text-xs text-gray-400">Claim #7579B726D · Internal use only</p>
          {cacheStats ? (
            <p className="mt-1 text-xs text-gray-500">
              Upgrades cache: <strong>{cacheStats.total_cached}</strong> total ·{" "}
              <strong>{cacheStats.verified_serpapi}</strong> verified (SerpAPI) ·{" "}
              <strong>{cacheStats.items_three_plus_options}</strong> with 3+ options
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* FIX 7: Copy live to test */}
          <button onClick={handleCopyToTest} className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm font-medium text-blue-700 hover:bg-blue-100">
            Copy Live → Test
          </button>
          {/* FIX 6: Reset button */}
          {!resetConfirm ? (
            <button onClick={() => setResetConfirm(true)} className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100">
              Reset Claim
            </button>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-3 py-2">
              <span className="text-xs text-red-700 font-medium">
                Reset to original {ORIGINAL_CLAIM_ITEMS.length} items {formatCurrency(ORIGINAL_TOTAL)}?
              </span>
              <button onClick={handleReset} disabled={resetLoading} className="rounded bg-red-700 px-3 py-1 text-xs font-bold text-white hover:bg-red-800 disabled:opacity-50">
                {resetLoading ? "Resetting…" : "Yes, Reset"}
              </button>
              <button onClick={() => setResetConfirm(false)} className="text-xs text-red-500 px-1">Cancel</button>
            </div>
          )}
          {resetMsg && <span className={`text-xs font-medium ${resetMsg.startsWith("✓") ? "text-green-700" : "text-red-600"}`}>{resetMsg}</span>}
          <a href="/review/debug" className="rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-500 hover:bg-gray-50">Debug</a>
          <a href="/review" className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">← Back to Review</a>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8 space-y-10">

        {/* ── Art collection PDF ─────────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
            Art collection upload
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white p-6 max-w-3xl">
            <p className="text-sm font-semibold text-gray-900 mb-1">ART COLLECTION UPLOAD</p>
            <p className="text-xs text-gray-500 mb-4">PDF only. Parsed with Claude for review before adding to the claim.</p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#2563EB] bg-blue-50 px-4 py-2 text-sm font-medium text-[#2563EB] hover:bg-blue-100">
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                disabled={artLoading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void handleArtPdfUpload(f);
                }}
              />
              {artLoading ? "Parsing…" : "Upload Art PDF"}
            </label>
            {artError && <p className="mt-3 text-sm text-red-600">{artError}</p>}
            {artParsed.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-semibold text-gray-500 mb-2">Parsed line items</p>
                <div className="overflow-x-auto border border-gray-100 rounded-lg">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                      <tr>
                        <th className="w-10 px-2 py-2 text-left" />
                        <th className="px-2 py-2 text-left">Description</th>
                        <th className="px-2 py-2 text-left">Artist</th>
                        <th className="px-2 py-2 text-left">Medium</th>
                        <th className="px-2 py-2 text-left">Size</th>
                        <th className="px-2 py-2 text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {artParsed.map((row, i) => (
                        <tr key={i}>
                          <td className="px-2 py-2">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300 accent-[#2563EB]"
                              checked={!!artChecked[i]}
                              onChange={() =>
                                setArtChecked((c) => {
                                  const n = [...c];
                                  n[i] = !n[i];
                                  return n;
                                })
                              }
                            />
                          </td>
                          <td className="px-2 py-2 text-gray-900">{row.description}</td>
                          <td className="px-2 py-2 text-gray-700">{row.artist || "—"}</td>
                          <td className="px-2 py-2 text-gray-700">{row.medium || "—"}</td>
                          <td className="px-2 py-2 text-gray-700">{row.size || "—"}</td>
                          <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(row.unit_cost)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  disabled={artAdding || !artChecked.some(Boolean)}
                  onClick={() => void handleAddArtToClaim()}
                  className="mt-4 rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {artAdding ? "Adding…" : "Add to Claim"}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── Client suggestion (admin entry) ─────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-4">
            Submit client suggestion
          </h2>
          <div className="rounded-xl border border-gray-200 bg-white p-6 max-w-lg">
            <p className="text-sm text-gray-500 mb-4">
              Log feedback on behalf of the client (same as the old floating form — now admin-only).
            </p>
            <ClientSuggestionForm />
          </div>
        </section>

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

            <div className="mt-5 space-y-2 border-t border-gray-100 pt-4 text-sm">
              <p className="text-gray-700">
                <span className="font-semibold text-gray-900">{adminStats.totalLines}</span> line items ·{" "}
                <span className="font-semibold text-gray-900">{adminStats.upgraded}</span> upgraded ·{" "}
                <span className="font-semibold text-gray-900">{adminStats.bundleLines}</span> bundle /{" "}
                <span className="font-semibold text-gray-900">{adminStats.suggestionLines}</span> suggestion adds
              </p>
              <p className="text-gray-600">
                Gap to $1.6M goal:{" "}
                <span className="font-bold tabular-nums text-gray-900">
                  {formatCurrency(Math.max(0, 1_600_000 - claimTotal))}
                </span>
              </p>
            </div>

            <div className="mt-4 border-t border-gray-100 pt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                Items & value by room (live session)
              </p>
              <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                {Object.entries(adminStats.byRoom)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([room, { count, value }]) => (
                    <div key={room} className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                      <span className="truncate text-gray-700">
                        {room}{" "}
                        <span className="text-xs text-gray-400">({count})</span>
                      </span>
                      <span className="shrink-0 tabular-nums font-medium text-gray-900">{formatCurrency(value)}</span>
                    </div>
                  ))}
              </div>
            </div>

            {roomSummary.length > 0 && (
              <div className="mt-4 border-t border-gray-100 pt-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Stored room_summary</p>
                <div className="grid grid-cols-2 gap-x-6 gap-y-2">
                  {roomSummary.map((r) => (
                    <div key={r.room} className="flex items-center justify-between text-sm">
                      <span className="truncate text-gray-700">{r.room}</span>
                      <span className="ml-2 shrink-0 tabular-nums font-medium text-gray-900">
                        {formatCurrency(r.subtotal)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* ── Client suggestions (table) ───────────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">All client suggestions</h2>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {rawSuggestions.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-400">No suggestions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50 text-xs font-medium uppercase tracking-wider text-gray-400">
                    <tr>
                      <th className="px-4 py-3 text-left">Room</th>
                      <th className="px-4 py-3 text-left">Message</th>
                      <th className="px-4 py-3 text-right">Date</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {rawSuggestions.map((s) => (
                      <tr key={s.id} className="align-top hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-700">{s.room ?? "—"}</td>
                        <td className="max-w-md px-4 py-3 text-gray-900">{s.message}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-gray-400">
                          {formatDate(s.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex flex-col items-end gap-1">
                            <Badge status={s.status} />
                            {s.status !== "resolved" ? (
                              <button
                                type="button"
                                onClick={() => void markSuggestionResolved(s.id)}
                                className="min-h-[36px] rounded-lg border border-gray-200 px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                              >
                                Mark resolved
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
              {(["all", "accepted", "partial_accept", "regenerated", "noted", "rejected"] as const).map((f) => (
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
