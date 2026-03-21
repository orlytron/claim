"use client";

/*
  Supabase: add note column if not already present
  ALTER TABLE bundle_decisions ADD COLUMN IF NOT EXISTS note text;
*/

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { mergeClaimIncoming } from "../../../lib/claim-item-merge";
import { loadSession, saveSession } from "../../../lib/session";
import { ClaimItem } from "../../../lib/types";
import { useClaimMode } from "../../../lib/useClaimMode";
import { formatCurrency } from "../../../lib/utils";
import { BUNDLES_DATA } from "../../../lib/bundles-data";

// ── Slug ↔ room name ──────────────────────────────────────────────────────────

const SLUG_TO_ROOM: Record<string, string> = {
  "living-room": "Living Room",
  "kitchen": "Kitchen",
  "bedroom-rafe": "Bedroom Rafe",
  "bedroom-orly": "Bedroom Orly",
  "patio": "Patio",
  "garage": "Garage",
  "bathroom-white": "Bathroom White",
  "bathroom-master": "Bathroom Master",
  "david-office-guest-room": "David Office / Guest Room",
  "art": "Art",
};


// ── Types ─────────────────────────────────────────────────────────────────────

type BundleItem = (typeof BUNDLES_DATA)[number]["items"][number];
type Bundle = (typeof BUNDLES_DATA)[number];

interface RevisedBundle {
  name: string;
  description: string;
  total_value: number;
  plausibility: "green" | "yellow" | "red";
  items: BundleItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Spinner({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <svg
      className={`animate-spin text-[#2563EB] ${size === "md" ? "h-5 w-5" : "h-3.5 w-3.5"}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl bg-gray-900 px-5 py-3 text-white shadow-xl text-sm">
      <span className="text-green-400">✓</span>
      {message}
    </div>
  );
}

// ── Bundle Card ────────────────────────────────────────────────────────────────

function BundleCard({
  bundle,
  accepted,
  initialNote,
  initialAction,
  onAccept,
  onUndo,
  onToast,
}: {
  bundle: Bundle;
  accepted: boolean;
  initialNote: string;
  initialAction: string;
  onAccept: (bundle: Bundle, items: BundleItem[]) => Promise<void>;
  onUndo: (bundle: Bundle) => Promise<void>;
  onToast: (msg: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  // Notes
  const [note, setNote] = useState(initialNote);
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);

  // Regenerate
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [revision, setRevision] = useState<RevisedBundle | null>(null);

  // Per-item swap: displayed items (may differ from bundle.items after swaps)
  const [displayItems, setDisplayItems] = useState<BundleItem[]>(bundle.items);
  const [swappingIdx, setSwappingIdx] = useState<number | null>(null);
  const [swapOptions, setSwapOptions] = useState<Record<number, BundleItem[]>>({});

  // ── Accept / Undo ──────────────────────────────────────────────────────────

  async function handleAccept() {
    setLoading(true);
    try {
      await onAccept(bundle, displayItems);
    } finally {
      setLoading(false);
    }
  }

  async function handleUndo() {
    setLoading(true);
    try {
      await onUndo(bundle);
    } finally {
      setLoading(false);
    }
  }

  // ── Save note ─────────────────────────────────────────────────────────────

  async function handleSaveNote() {
    if (!note.trim()) return;
    setNoteSaving(true);
    const { error: noteErr } = await supabase.from("bundle_decisions").upsert(
      {
        bundle_code: bundle.bundle_code,
        room: bundle.room,
        bundle_name: bundle.name,
        action: initialAction || "noted",
        items: displayItems,
        total_value: bundle.total_value,
        note: note.trim(),
      },
      { onConflict: "bundle_code" }
    );
    if (noteErr) console.warn("bundle_decisions note save blocked:", noteErr.message);
    setNoteSaving(false);
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 3000);
  }

  // ── Regenerate ────────────────────────────────────────────────────────────

  async function handleRegenerate() {
    if (!note.trim()) return;
    setIsRegenerating(true);
    setRevision(null);
    try {
      const res = await fetch("/api/regenerate-bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bundle: { ...bundle, items: displayItems }, note }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const revised = (await res.json()) as RevisedBundle;
      setRevision(revised);
    } catch {
      onToast("Regeneration failed. Please try again.");
    } finally {
      setIsRegenerating(false);
    }
  }

  async function handleUseRevision() {
    if (!revision) return;
    const { error: revErr } = await supabase.from("bundle_decisions").upsert(
      {
        bundle_code: bundle.bundle_code,
        room: bundle.room,
        bundle_name: revision.name,
        action: "regenerated",
        items: revision.items,
        total_value: revision.total_value,
        note: note.trim(),
      },
      { onConflict: "bundle_code" }
    );
    if (revErr) console.warn("bundle_decisions revision save blocked:", revErr.message);
    setDisplayItems(revision.items);
    setRevision(null);
    onToast(`Revised bundle saved — ${formatCurrency(revision.total_value)}`);
  }

  // ── Per-item swap ─────────────────────────────────────────────────────────

  async function handleSwapClick(idx: number) {
    if (swappingIdx === idx) {
      setSwappingIdx(null);
      return;
    }
    setSwappingIdx(idx);
    if (swapOptions[idx]) return; // Already loaded

    try {
      const res = await fetch("/api/swap-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item: displayItems[idx],
          room: bundle.room,
          bundle_total: bundle.total_value,
        }),
      });
      if (!res.ok) throw new Error();
      const alts = (await res.json()) as BundleItem[];
      setSwapOptions((prev) => ({ ...prev, [idx]: alts }));
    } catch {
      setSwappingIdx(null);
      onToast("Could not load alternatives. Try again.");
    }
  }

  function handleUseSwap(idx: number, alt: BundleItem) {
    setDisplayItems((prev) => prev.map((item, i) => (i === idx ? alt : item)));
    setSwappingIdx(null);
    // Clear cached options for this index so a re-swap fetches fresh
    setSwapOptions((prev) => {
      const next = { ...prev };
      delete next[idx];
      return next;
    });
    onToast(`Swapped to ${alt.brand ? alt.brand + " " : ""}${alt.description}`);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const totalValue = displayItems.reduce((s, i) => s + i.total, 0);
  const previewItems = displayItems.slice(0, 4);
  const remaining = displayItems.length - 4;
  return (
    <div
      className={`rounded-xl border bg-white shadow-sm transition-all ${
        accepted ? "border-green-300 ring-1 ring-green-200" : "border-gray-200"
      }`}
    >
      <div className="p-5">
        {/* Header badges */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2">
            {bundle.sweet_spot && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                ⭐ SWEET SPOT
              </span>
            )}
            {accepted && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 border border-green-200 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                ✓ Accepted
              </span>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-mono font-medium text-gray-500">
            Tier {bundle.tier}
          </span>
        </div>

        {/* Name + value */}
        <h2 className="text-lg font-semibold text-gray-900">{bundle.name}</h2>
        <p className="text-2xl font-bold tabular-nums text-gray-900 mt-0.5">
          {formatCurrency(totalValue)}
        </p>

        {bundle.description && (
          <p className="mt-2 text-sm text-gray-500 italic">&ldquo;{bundle.description}&rdquo;</p>
        )}

        {/* Preview items */}
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">
            Key Items
          </p>
          <ul className="space-y-1.5">
            {previewItems.map((item, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 truncate mr-2">
                  {item.brand ? `${item.brand} ` : ""}
                  {item.description}
                </span>
                <span className="shrink-0 tabular-nums text-gray-500 font-medium">
                  {formatCurrency(item.total)}
                </span>
              </li>
            ))}
            {remaining > 0 && !expanded && (
              <li className="text-xs text-gray-400">+ {remaining} more items</li>
            )}
          </ul>

          {/* Expanded item list with swap buttons */}
          {expanded && (
            <div className="mt-2 space-y-1">
              {displayItems.map((item, idx) => (
                <div key={idx}>
                  {/* Item row */}
                  <div className="flex items-center gap-2 py-1.5 text-sm rounded hover:bg-gray-50 px-1">
                    <span className="flex-1 text-gray-700 truncate">
                      {item.brand ? `${item.brand} ` : ""}
                      {item.description}
                      {item.qty > 1 && (
                        <span className="text-gray-400 ml-1">×{item.qty}</span>
                      )}
                    </span>
                    <span className="shrink-0 tabular-nums text-gray-500 text-xs">
                      {formatCurrency(item.total)}
                    </span>
                    <button
                      onClick={() => handleSwapClick(idx)}
                      title="Swap this item"
                      className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
                        swappingIdx === idx
                          ? "bg-blue-100 text-blue-700"
                          : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                      }`}
                    >
                      {swappingIdx === idx && !swapOptions[idx] ? (
                        <Spinner />
                      ) : (
                        "↺"
                      )}
                    </button>
                  </div>

                  {/* Swap alternatives dropdown */}
                  {swappingIdx === idx && swapOptions[idx] && (
                    <div className="ml-2 mb-2 rounded-lg bg-gray-50 border border-gray-200 p-3 space-y-2">
                      <p className="text-xs font-medium text-gray-500 mb-2">Alternatives:</p>
                      {swapOptions[idx].map((alt, ai) => (
                        <div
                          key={ai}
                          className="flex items-center justify-between gap-2 rounded-md bg-white border border-gray-200 px-3 py-2"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">
                              {alt.brand ? `${alt.brand} ` : ""}
                              {alt.description}
                            </p>
                            <p className="text-xs text-gray-400">{formatCurrency(alt.unit_cost)}</p>
                          </div>
                          <button
                            onClick={() => handleUseSwap(idx, alt)}
                            className="shrink-0 rounded bg-[#2563EB] px-2.5 py-1 text-xs font-medium text-white hover:bg-blue-700 transition-colors"
                          >
                            Use
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setSwappingIdx(null)}
                        className="text-xs text-gray-400 hover:text-gray-600 pt-1"
                      >
                        Keep Original
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions row */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-sm text-[#2563EB] hover:underline"
          >
            {expanded ? "Collapse" : `View All ${displayItems.length} Items`}
          </button>

          <div className="flex items-center gap-2">
            {accepted ? (
              <button
                onClick={handleUndo}
                disabled={loading}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
              >
                {loading ? "…" : "Undo"}
              </button>
            ) : (
              <button
                onClick={handleAccept}
                disabled={loading}
                className="rounded-md bg-[#16A34A] px-5 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <Spinner /> : "✓"}
                {loading ? "Saving…" : "Accept Bundle"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Notes + Regenerate section ──────────────────────────────────────── */}
      <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 rounded-b-xl">
        <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1.5">
          💬 Notes on this bundle
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder={`"Too expensive" or "swap the piano for something else" or "I like everything except the rug"…`}
          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
        />
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          <button
            onClick={handleSaveNote}
            disabled={noteSaving || !note.trim()}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50 transition-colors"
          >
            {noteSaving ? "Saving…" : noteSaved ? "✓ Note saved" : "Save Note"}
          </button>
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating || !note.trim()}
            className="rounded-md border border-[#2563EB] bg-white px-3 py-1.5 text-xs font-medium text-[#2563EB] hover:bg-blue-50 disabled:opacity-50 transition-colors flex items-center gap-1.5"
          >
            {isRegenerating ? (
              <>
                <Spinner /> Regenerating…
              </>
            ) : (
              "↺ Regenerate with these notes"
            )}
          </button>
        </div>

        {/* Regenerating overlay message */}
        {isRegenerating && (
          <p className="mt-2 text-xs text-gray-400 italic">
            Regenerating bundle based on your feedback…
          </p>
        )}
      </div>

      {/* ── Revised bundle card ─────────────────────────────────────────────── */}
      {revision && (
        <div className="border-t border-purple-100 bg-[#F5F3FF] rounded-b-xl px-5 py-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <p className="text-xs font-semibold text-purple-600 mb-1">✨ REVISED BUNDLE · Based on your feedback</p>
              <h3 className="font-semibold text-gray-900">{revision.name}</h3>
              <p className="text-xl font-bold tabular-nums text-gray-900 mt-0.5">
                {formatCurrency(revision.total_value)}
              </p>
              {revision.description && (
                <p className="text-xs text-gray-500 italic mt-1">&ldquo;{revision.description}&rdquo;</p>
              )}
            </div>
          </div>

          {/* Revised items */}
          <ul className="space-y-1.5 mb-4">
            {revision.items.map((item, i) => (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 truncate mr-2">
                  {item.brand ? `${item.brand} ` : ""}
                  {item.description}
                  {item.qty > 1 && <span className="text-gray-400"> ×{item.qty}</span>}
                </span>
                <span className="shrink-0 tabular-nums text-gray-500 font-medium">
                  {formatCurrency(item.total)}
                </span>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-3">
            <button
              onClick={handleUseRevision}
              className="rounded-md bg-[#16A34A] px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
            >
              ✓ Use This Version
            </button>
            <button
              onClick={() => setRevision(null)}
              className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              Keep Original
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BundleBrowserPage() {
  const params = useParams<{ room: string }>();
  const roomSlug = params.room;
  const { sessionId, hydrated } = useClaimMode();

  const [roomName, setRoomName] = useState("");
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [acceptedCodes, setAcceptedCodes] = useState<Set<string>>(new Set());
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});
  const [decisionActions, setDecisionActions] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [currentRoomTotal, setCurrentRoomTotal] = useState(0);
  const [roomBudget, setRoomBudget] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => setToast(msg), []);

  useEffect(() => {
    if (hydrated) loadData();
  }, [roomSlug, hydrated, sessionId]);

  async function loadData() {
    setIsLoading(true);

    const session = await loadSession(sessionId);
    const name = SLUG_TO_ROOM[roomSlug] || roomSlug;
    setRoomName(name);

    if (session) {
      setRoomBudget(session.room_budgets?.[name] ?? 0);
      const total = (session.claim_items ?? [])
        .filter((i) => i.room === name)
        .reduce((s, i) => s + i.unit_cost * i.qty, 0);
      setCurrentRoomTotal(total);
    }

    // Load bundles locally — no Supabase needed
    const localBundles = BUNDLES_DATA
      .filter((b) => b.room === name)
      .sort((a, b) => a.total_value - b.total_value);
    setBundles(localBundles);

    // FIX 2: check error — RLS blocks are { error } not thrown exceptions
    const { data: decisions, error: bdLoadErr } = await supabase
      .from("bundle_decisions")
      .select("bundle_code, action, note")
      .eq("room", name);
    if (bdLoadErr) console.warn("bundle_decisions read blocked (RLS?):", bdLoadErr.message);

    const accepted = new Set<string>();
    const notes: Record<string, string> = {};
    const actions: Record<string, string> = {};

    for (const d of (decisions ?? []) as { bundle_code: string; action: string; note: string | null }[]) {
      actions[d.bundle_code] = d.action;
      if (d.note) notes[d.bundle_code] = d.note;
      if (d.action === "accepted" || d.action === "regenerated") accepted.add(d.bundle_code);
    }

    setAcceptedCodes(accepted);
    setDecisionNotes(notes);
    setDecisionActions(actions);
    setIsLoading(false);
  }

  async function handleAccept(bundle: Bundle, items: BundleItem[]) {
    const { error: accErr } = await supabase.from("bundle_decisions").upsert(
      {
        bundle_code: bundle.bundle_code,
        room: bundle.room,
        bundle_name: bundle.name,
        action: "accepted",
        items,
        total_value: items.reduce((s, i) => s + i.total, 0),
        note: decisionNotes[bundle.bundle_code] ?? null,
      },
      { onConflict: "bundle_code" }
    );
    if (accErr) console.warn("bundle_decisions accept blocked:", accErr.message);

    const session = await loadSession(sessionId);
    const existingItems = session?.claim_items ?? [];
    const incoming: ClaimItem[] = items.map((bi) => ({
      room: bundle.room,
      description: bi.description,
      brand: bi.brand,
      model: "",
      qty: bi.qty,
      age_years: 0,
      age_months: 0,
      condition: "New",
      unit_cost: bi.unit_cost,
      category: bi.category,
      source: "bundle",
    }));
    const merged = mergeClaimIncoming(existingItems, incoming, "bundle");
    await saveSession({ claim_items: merged }, sessionId);

    const added = items.reduce((s, i) => s + i.total, 0);
    setAcceptedCodes((prev) => new Set([...prev, bundle.bundle_code]));
    const newRoomTotal = merged
      .filter((i) => i.room === bundle.room)
      .reduce((s, i) => s + i.unit_cost * i.qty, 0);
    setCurrentRoomTotal(newRoomTotal);
    showToast(`Bundle merged — ${formatCurrency(added)} package value · ${bundle.room}`);
  }

  async function handleUndo(bundle: Bundle) {
    const { error: undoErr } = await supabase
      .from("bundle_decisions")
      .update({ action: "rejected" })
      .eq("bundle_code", bundle.bundle_code);
    if (undoErr) console.warn("bundle_decisions undo blocked:", undoErr.message);

    const session = await loadSession(sessionId);
    const bundleDescriptions = new Set(bundle.items.map((i) => i.description));
    const filtered = (session?.claim_items ?? []).filter(
      (i) => !(i.room === bundle.room && bundleDescriptions.has(i.description))
    );
    await saveSession({ claim_items: filtered }, sessionId);

    setAcceptedCodes((prev) => {
      const next = new Set(prev);
      next.delete(bundle.bundle_code);
      return next;
    });
    const newRoomTotal = filtered
      .filter((i) => i.room === bundle.room)
      .reduce((s, i) => s + i.unit_cost * i.qty, 0);
    setCurrentRoomTotal(newRoomTotal);
    showToast(`Bundle removed — ${bundle.name} undone`);
  }

  const gap = roomBudget > 0 ? roomBudget - currentRoomTotal : 0;

  if (!hydrated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center text-gray-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href="/review"
              className="text-xs text-gray-400 hover:text-gray-600 mb-1 block"
            >
              ← All Rooms
            </Link>
            <h1 className="text-xl font-semibold text-gray-900">{roomName} Bundles</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Pre-curated upgrade packages — accept one to add all items at once
            </p>
          </div>
          <div className="shrink-0 text-right text-sm">
            <p className="text-gray-500">
              Current:{" "}
              <span className="font-semibold text-gray-900">{formatCurrency(currentRoomTotal)}</span>
            </p>
            {roomBudget > 0 && (
              <>
                <p className="text-gray-500">
                  Target: <span className="tabular-nums">{formatCurrency(roomBudget)}</span>
                </p>
                <p className={gap > 0 ? "text-[#2563EB] font-medium" : "text-green-600 font-medium"}>
                  Gap: {formatCurrency(Math.abs(gap))} {gap < 0 ? "over" : "remaining"}
                </p>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 px-6 py-6">
        {isLoading ? (
          <div className="flex flex-col gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-5">
                <div className="h-4 w-24 rounded-full bg-gray-100 mb-3" />
                <div className="h-6 w-40 rounded bg-gray-200 mb-2" />
                <div className="h-8 w-28 rounded bg-gray-100 mb-4" />
                <div className="space-y-2">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-4 w-full rounded bg-gray-100" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : bundles.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="text-gray-500 text-lg">No bundles found for {roomName}.</p>
            <p className="text-gray-400 text-sm mt-1">
              Run{" "}
              <code className="bg-gray-100 px-1 py-0.5 rounded">npm run seed-bundles</code> to load
              bundle data.
            </p>
            <Link
              href="/review"
              className="mt-4 text-sm text-[#2563EB] hover:underline"
            >
              ← All Rooms
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {bundles.map((bundle) => (
              <BundleCard
                key={bundle.bundle_code}
                bundle={bundle}
                accepted={acceptedCodes.has(bundle.bundle_code)}
                initialNote={decisionNotes[bundle.bundle_code] ?? ""}
                initialAction={decisionActions[bundle.bundle_code] ?? ""}
                onAccept={handleAccept}
                onUndo={handleUndo}
                onToast={showToast}
              />
            ))}
          </div>
        )}
      </main>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
