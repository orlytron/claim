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

function bundleItemLineLabel(it: BundleItem) {
  const p = it.brand ? `${it.brand} ` : "";
  return `${p}${it.description}`.trim();
}

function BundleCard({
  bundle,
  accepted,
  onAccept,
  onUndo,
}: {
  bundle: Bundle;
  accepted: boolean;
  onAccept: (bundle: Bundle, items: BundleItem[]) => Promise<void>;
  onUndo: (bundle: Bundle) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const items = bundle.items;
  const totalValue = items.reduce((s, i) => s + i.total, 0);
  const previewItems = items.slice(0, 3);
  const remaining = Math.max(0, items.length - 3);

  async function handleAccept() {
    setLoading(true);
    try {
      await onAccept(bundle, items);
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

  return (
    <div
      className={`flex max-h-[200px] flex-col overflow-hidden rounded-lg border p-2 shadow-sm ${
        accepted ? "border-green-300 bg-green-50/50 ring-1 ring-green-200" : "border-gray-200 bg-white"
      }`}
    >
      <p className="min-w-0 truncate text-sm font-semibold leading-tight text-gray-900">
        <span>{bundle.name}</span>
        <span className="font-normal text-gray-400"> · </span>
        <span className="font-bold tabular-nums text-gray-900">{formatCurrency(totalValue)}</span>
      </p>
      <ul className="mt-1.5 min-h-0 space-y-0.5 overflow-hidden">
        {previewItems.map((it, i) => (
          <li key={i} className="flex justify-between gap-2 text-xs leading-4 text-gray-800">
            <span className="min-w-0 truncate">{bundleItemLineLabel(it)}</span>
            <span className="shrink-0 tabular-nums font-medium text-gray-700">{formatCurrency(it.total)}</span>
          </li>
        ))}
        {remaining > 0 ? (
          <li className="text-xs leading-4 text-gray-500">+ {remaining} more items</li>
        ) : null}
      </ul>
      <div className="mt-auto shrink-0 pt-2">
        {accepted ? (
          <button
            type="button"
            onClick={handleUndo}
            disabled={loading}
            className="text-xs font-medium text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            {loading ? "…" : "Undo accept"}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleAccept}
            disabled={loading}
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-[#16A34A] py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? <Spinner /> : null}
            {loading ? "Saving…" : "Accept Bundle"}
          </button>
        )}
      </div>
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

    for (const d of (decisions ?? []) as { bundle_code: string; action: string; note: string | null }[]) {
      if (d.note) notes[d.bundle_code] = d.note;
      if (d.action === "accepted" || d.action === "regenerated") accepted.add(d.bundle_code);
    }

    setAcceptedCodes(accepted);
    setDecisionNotes(notes);
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
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="animate-pulse max-h-[200px] rounded-lg border border-gray-200 bg-white p-2.5"
              >
                <div className="h-4 w-3/4 rounded bg-gray-200" />
                <div className="mt-2 space-y-1">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="h-3 w-full rounded bg-gray-100" />
                  ))}
                </div>
                <div className="mt-2 h-7 w-full rounded-md bg-gray-100" />
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
          <div className="flex flex-col gap-2">
            {bundles.map((bundle) => (
              <BundleCard
                key={bundle.bundle_code}
                bundle={bundle}
                accepted={acceptedCodes.has(bundle.bundle_code)}
                onAccept={handleAccept}
                onUndo={handleUndo}
              />
            ))}
          </div>
        )}
      </main>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
