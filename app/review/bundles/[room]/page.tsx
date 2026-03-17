"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { loadSession, saveSession } from "../../../lib/session";
import { ClaimItem } from "../../../lib/types";
import { slugify, formatCurrency } from "../../../lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BundleItem {
  description: string;
  brand: string;
  qty: number;
  unit_cost: number;
  total: number;
  category: string;
}

interface Bundle {
  id: string;
  room: string;
  bundle_code: string;
  name: string;
  description: string;
  tier: string;
  total_value: number;
  sweet_spot: boolean;
  plausibility: "green" | "yellow" | "red";
  items: BundleItem[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function plausibilityLabel(p: "green" | "yellow" | "red") {
  if (p === "green") return "fully defensible";
  if (p === "yellow") return "needs narrative";
  return "strong narrative required";
}

function plausibilityColors(p: "green" | "yellow" | "red") {
  if (p === "green") return { badge: "bg-green-50 text-green-700 border-green-200", dot: "bg-[#16A34A]" };
  if (p === "yellow") return { badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-[#D97706]" };
  return { badge: "bg-red-50 text-red-700 border-red-200", dot: "bg-[#DC2626]" };
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
  onAccept,
  onUndo,
}: {
  bundle: Bundle;
  accepted: boolean;
  onAccept: (bundle: Bundle) => Promise<void>;
  onUndo: (bundle: Bundle) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const colors = plausibilityColors(bundle.plausibility);
  const previewItems = bundle.items.slice(0, 4);
  const remaining = bundle.items.length - 4;

  async function handleAccept() {
    setLoading(true);
    try {
      await onAccept(bundle);
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
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${colors.badge}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
              {plausibilityLabel(bundle.plausibility)}
            </span>
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
          {formatCurrency(bundle.total_value)}
        </p>

        {/* Description */}
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
                  {item.brand ? `${item.brand} ` : ""}{item.description}
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

          {/* Expanded item list */}
          {expanded && bundle.items.slice(4).map((item, i) => (
            <div key={i} className="flex items-center justify-between text-sm mt-1.5">
              <span className="text-gray-700 truncate mr-2">
                {item.brand ? `${item.brand} ` : ""}{item.description}
                {item.qty > 1 && <span className="text-gray-400"> ×{item.qty}</span>}
              </span>
              <span className="shrink-0 tabular-nums text-gray-500 font-medium">
                {formatCurrency(item.total)}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="text-sm text-[#2563EB] hover:underline"
          >
            {expanded ? "Collapse" : `View All ${bundle.items.length} Items`}
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
                {loading ? (
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : "✓"}
                {loading ? "Saving…" : "Accept Bundle"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BundleBrowserPage() {
  const params = useParams<{ room: string }>();
  const roomSlug = params.room;

  const [roomName, setRoomName] = useState("");
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [acceptedCodes, setAcceptedCodes] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [currentRoomTotal, setCurrentRoomTotal] = useState(0);
  const [roomBudget, setRoomBudget] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [roomSlug]);

  async function loadData() {
    setIsLoading(true);

    // Load session to get room name, budget, total
    const session = await loadSession();
    const rooms =
      session?.room_summary?.map((r) => r.room) ??
      [...new Set(session?.claim_items?.map((i) => i.room) ?? [])];

    const name = rooms.find((r) => slugify(r) === roomSlug) ?? roomSlug.replace(/-/g, " ");
    setRoomName(name);

    if (session) {
      setRoomBudget(session.room_budgets?.[name] ?? 0);
      const total = (session.claim_items ?? [])
        .filter((i) => i.room === name)
        .reduce((s, i) => {
          const stored = session.item_tiers?.[i.room + i.description + i.unit_cost];
          return s + (stored?.tiers?.find((t) => t.tier === stored.selected_tier)?.unit_cost ?? i.unit_cost) * i.qty;
        }, 0);
      setCurrentRoomTotal(total);
    }

    // Load bundles for this room
    const { data: bundleRows } = await supabase
      .from("bundles")
      .select("*")
      .eq("room", name)
      .order("total_value", { ascending: true });

    setBundles((bundleRows as Bundle[]) ?? []);

    // Load accepted decisions
    const { data: decisions } = await supabase
      .from("bundle_decisions")
      .select("bundle_code")
      .eq("room", name)
      .eq("action", "accepted");

    setAcceptedCodes(new Set((decisions ?? []).map((d: { bundle_code: string }) => d.bundle_code)));
    setIsLoading(false);
  }

  async function handleAccept(bundle: Bundle) {
    // 1. Upsert bundle decision
    await supabase.from("bundle_decisions").upsert(
      {
        bundle_code: bundle.bundle_code,
        room: bundle.room,
        bundle_name: bundle.name,
        action: "accepted",
        items: bundle.items,
        total_value: bundle.total_value,
      },
      { onConflict: "bundle_code" }
    );

    // 2. Add bundle items to claim_items
    const session = await loadSession();
    const existingItems = session?.claim_items ?? [];
    const existingKeys = new Set(existingItems.map((i) => `${i.room}::${i.description}`));

    const newItems: ClaimItem[] = bundle.items
      .filter((bi) => !existingKeys.has(`${bundle.room}::${bi.description}`))
      .map((bi) => ({
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
      }));

    if (newItems.length > 0) {
      await saveSession({ claim_items: [...existingItems, ...newItems] });
    }

    setAcceptedCodes((prev) => new Set([...prev, bundle.bundle_code]));
    setCurrentRoomTotal((prev) => prev + bundle.total_value);
    setToast(`Bundle added — ${formatCurrency(bundle.total_value)} added to ${bundle.room}`);
  }

  async function handleUndo(bundle: Bundle) {
    // Update decision to rejected
    await supabase
      .from("bundle_decisions")
      .update({ action: "rejected" })
      .eq("bundle_code", bundle.bundle_code);

    // Remove bundle items from claim_items
    const session = await loadSession();
    const bundleDescriptions = new Set(bundle.items.map((i) => i.description));
    const filtered = (session?.claim_items ?? []).filter(
      (i) => !(i.room === bundle.room && bundleDescriptions.has(i.description))
    );
    await saveSession({ claim_items: filtered });

    setAcceptedCodes((prev) => {
      const next = new Set(prev);
      next.delete(bundle.bundle_code);
      return next;
    });
    setCurrentRoomTotal((prev) => Math.max(0, prev - bundle.total_value));
    setToast(`Bundle removed — ${bundle.name} undone`);
  }

  const gap = roomBudget > 0 ? roomBudget - currentRoomTotal : 0;

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href={`/review/${roomSlug}`}
              className="text-xs text-gray-400 hover:text-gray-600 mb-1 block"
            >
              ← Back to {roomName}
            </Link>
            <h1 className="text-xl font-semibold text-gray-900">{roomName} Bundles</h1>
            <p className="text-xs text-gray-400 mt-0.5">
              Pre-curated upgrade packages — accept one to add all items at once
            </p>
          </div>
          <div className="shrink-0 text-right text-sm">
            <p className="text-gray-500">
              Current: <span className="font-semibold text-gray-900">{formatCurrency(currentRoomTotal)}</span>
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

      {/* Content */}
      <main className="flex-1 px-6 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            <p className="text-gray-400 text-sm mt-1">Run <code className="bg-gray-100 px-1 py-0.5 rounded">npm run seed-bundles</code> to load bundle data.</p>
            <Link href={`/review/${roomSlug}`} className="mt-4 text-sm text-[#2563EB] hover:underline">
              ← Back to {roomName}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

      {/* Toast */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
