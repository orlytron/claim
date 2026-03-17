"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { loadSession, saveSession } from "../lib/session";
import { ClaimItem } from "../lib/types";
import { formatCurrency } from "../lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const TARGET = 1_600_000;

const ROOMS: { name: string; slug: string; display?: string }[] = [
  { name: "Living Room", slug: "living-room" },
  { name: "Kitchen", slug: "kitchen" },
  { name: "David Office / Guest Room", slug: "david-office-guest-room", display: "David Office" },
  { name: "Bedroom Orly", slug: "bedroom-orly" },
  { name: "Bedroom Rafe", slug: "bedroom-rafe" },
  { name: "Patio", slug: "patio" },
  { name: "Garage", slug: "garage" },
  { name: "Bathroom Master", slug: "bathroom-master" },
  { name: "Bathroom White", slug: "bathroom-white" },
];

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

function compact(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
}

function PlausibilityBadge({ p }: { p: "green" | "yellow" | "red" }) {
  if (p === "green")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700">
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> fully defensible
      </span>
    );
  if (p === "yellow")
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs text-amber-700">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> needs narrative
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs text-red-700">
      <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> strong narrative required
    </span>
  );
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
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
    <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-sm text-white shadow-xl">
      <span className="text-green-400">✓</span>
      {message}
    </div>
  );
}

// ── Art Collection row ────────────────────────────────────────────────────────

function ArtRow({
  artAdded,
  onAdd,
}: {
  artAdded: boolean;
  onAdd: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className={`rounded-xl border transition-all ${
        open ? "border-gray-300 shadow-sm" : "border-gray-200 hover:border-gray-300"
      }`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="font-medium text-gray-900">🎨 Art Collection</span>
        <div className="flex items-center gap-3">
          <span className="ml-3 shrink-0 tabular-nums text-sm text-gray-400">
            {artAdded ? formatCurrency(300_000) : "$0 pending"}
          </span>
          <span
            className={`text-xs text-gray-300 transition-transform duration-200 ${
              open ? "rotate-90" : ""
            }`}
          >
            ▶
          </span>
        </div>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-4 py-5">
          <p className="text-sm text-gray-500">Art inventory PDF pending from advisor.</p>
          <p className="mt-1 mb-4 text-sm text-gray-500">$300,000 reserved as placeholder.</p>
          {artAdded ? (
            <p className="text-sm font-medium text-green-600">✓ $300K placeholder added</p>
          ) : (
            <button
              onClick={onAdd}
              className="rounded-md bg-[#16A34A] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
            >
              ✓ Add $300K Placeholder
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Room row ──────────────────────────────────────────────────────────────────

function RoomRow({
  room,
  roomTotal,
  bundles,
  sliderIdx,
  onSliderChange,
  acceptedCodes,
  onAccept,
  saving,
}: {
  room: { name: string; slug: string; display?: string };
  roomTotal: number;
  bundles: Bundle[];
  sliderIdx: number;
  onSliderChange: (idx: number) => void;
  acceptedCodes: Set<string>;
  onAccept: (bundle: Bundle) => void;
  saving: boolean;
}) {
  const [open, setOpen] = useState(false);
  const activeBundle = bundles[sliderIdx] ?? null;
  const isActiveBundleAccepted = activeBundle ? acceptedCodes.has(activeBundle.bundle_code) : false;

  return (
    <div
      className={`rounded-xl border transition-all ${
        open ? "border-gray-300 shadow-sm" : "border-gray-200 hover:border-gray-300"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex min-w-0 flex-1 items-center justify-between text-left"
        >
          <span className="truncate font-medium text-gray-900">
            {room.display ?? room.name}
          </span>
          <span className="ml-3 shrink-0 tabular-nums text-sm text-gray-500">
            {formatCurrency(roomTotal)}
          </span>
        </button>

        <Link
          href={`/review/bundles/${room.slug}`}
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 rounded border border-[#2563EB] px-2 py-1 text-xs text-[#2563EB] transition-colors hover:bg-blue-50"
        >
          + Add
        </Link>

        <button
          onClick={() => setOpen((v) => !v)}
          className={`shrink-0 text-xs text-gray-300 transition-transform duration-200 ${
            open ? "rotate-90" : ""
          }`}
        >
          ▶
        </button>
      </div>

      {/* Expanded section */}
      {open && (
        <div className="border-t border-gray-100 px-4 py-5">
          {bundles.length === 0 ? (
            <div className="py-4 text-center">
              <p className="text-sm text-gray-400">No bundles for this room yet.</p>
              <Link
                href={`/review/${room.slug}`}
                className="mt-2 block text-xs text-[#2563EB] hover:underline"
              >
                View existing items →
              </Link>
            </div>
          ) : (
            <>
              <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-gray-400">
                How much do you want to add?
              </p>

              {/* Slider */}
              <div className="mb-5">
                <input
                  type="range"
                  min={0}
                  max={bundles.length - 1}
                  step={1}
                  value={sliderIdx}
                  onChange={(e) => onSliderChange(Number(e.target.value))}
                  className="w-full cursor-pointer accent-[#2563EB]"
                />

                {/* Tick labels */}
                <div className="mt-1.5 flex justify-between px-0.5">
                  {bundles.map((b, i) => (
                    <button
                      key={i}
                      onClick={() => onSliderChange(i)}
                      className={`tabular-nums text-xs transition-colors ${
                        i === sliderIdx
                          ? "font-semibold text-[#2563EB]"
                          : "text-gray-300 hover:text-gray-400"
                      }`}
                    >
                      {compact(b.total_value)}
                    </button>
                  ))}
                </div>

                <p className="mt-2 text-base font-semibold tabular-nums text-gray-900">
                  Selected:{" "}
                  {activeBundle ? formatCurrency(activeBundle.total_value) : "—"}
                </p>
              </div>

              {/* Active bundle preview card */}
              {activeBundle && (
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    {activeBundle.sweet_spot && (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                        ⭐ Sweet Spot
                      </span>
                    )}
                    <PlausibilityBadge p={activeBundle.plausibility} />
                  </div>

                  <h3 className="font-semibold text-gray-900">{activeBundle.name}</h3>
                  {activeBundle.description && (
                    <p className="mt-1 mb-3 text-xs italic text-gray-500">
                      &ldquo;{activeBundle.description}&rdquo;
                    </p>
                  )}

                  <ul className="mb-4 space-y-1">
                    {activeBundle.items.slice(0, 4).map((item, i) => (
                      <li key={i} className="flex items-center justify-between text-xs">
                        <span className="mr-2 truncate text-gray-600">
                          {item.brand ? `${item.brand} ` : ""}
                          {item.description}
                        </span>
                        <span className="shrink-0 tabular-nums text-gray-400">
                          {formatCurrency(item.total)}
                        </span>
                      </li>
                    ))}
                    {activeBundle.items.length > 4 && (
                      <li className="text-xs text-gray-400">
                        + {activeBundle.items.length - 4} more items
                      </li>
                    )}
                  </ul>

                  <div className="flex items-center gap-3 pt-1">
                    <Link
                      href={`/review/bundles/${room.slug}`}
                      className="text-xs text-[#2563EB] hover:underline"
                    >
                      View Bundle →
                    </Link>
                    {isActiveBundleAccepted ? (
                      <span className="text-xs font-medium text-green-600">✓ Added</span>
                    ) : (
                      <button
                        onClick={() => onAccept(activeBundle)}
                        disabled={saving}
                        className="flex items-center gap-1.5 rounded-md bg-[#16A34A] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
                      >
                        {saving ? <Spinner /> : "✓"}
                        {saving ? "Adding…" : "Add This"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Footer links */}
              <div className="mt-4 flex items-center gap-5 text-xs">
                <Link
                  href={`/review/bundles/${room.slug}`}
                  className="text-[#2563EB] hover:underline"
                >
                  See all {bundles.length} bundles →
                </Link>
                <Link
                  href={`/review/${room.slug}`}
                  className="text-gray-400 hover:text-gray-600"
                >
                  View existing items
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function ReviewDashboard() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [roomTotals, setRoomTotals] = useState<Record<string, number>>({});
  const [allBundles, setAllBundles] = useState<Record<string, Bundle[]>>({});
  const [acceptedCodes, setAcceptedCodes] = useState<Set<string>>(new Set());
  const [sliderIdx, setSliderIdx] = useState<Record<string, number>>({});
  const [savingRoom, setSavingRoom] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [grandTotal, setGrandTotal] = useState(0);
  const [artAdded, setArtAdded] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [sessionResult, bundleResult, decisionResult] = await Promise.all([
      loadSession(),
      supabase.from("bundles").select("*").order("total_value", { ascending: true }),
      supabase.from("bundle_decisions").select("bundle_code, action"),
    ]);

    // Redirect if no claim data
    if (!sessionResult?.claim_items?.length) {
      router.push("/");
      return;
    }

    // Compute room totals from claim_items
    const totals: Record<string, number> = {};
    for (const item of sessionResult.claim_items) {
      totals[item.room] = (totals[item.room] ?? 0) + item.unit_cost * item.qty;
    }
    setRoomTotals(totals);
    setGrandTotal(Object.values(totals).reduce((s, v) => s + v, 0));

    // Group bundles by room
    const grouped: Record<string, Bundle[]> = {};
    for (const b of (bundleResult.data ?? []) as Bundle[]) {
      if (!grouped[b.room]) grouped[b.room] = [];
      grouped[b.room].push(b);
    }
    setAllBundles(grouped);

    // Default slider to the sweet-spot bundle (or first)
    const initial: Record<string, number> = {};
    for (const [room, bundles] of Object.entries(grouped)) {
      const si = bundles.findIndex((b) => b.sweet_spot);
      initial[room] = si >= 0 ? si : 0;
    }
    setSliderIdx(initial);

    // Track accepted bundles
    const accepted = new Set<string>();
    for (const d of (decisionResult.data ?? []) as { bundle_code: string; action: string }[]) {
      if (d.action === "accepted" || d.action === "regenerated") {
        accepted.add(d.bundle_code);
      }
    }
    setAcceptedCodes(accepted);
    setIsLoading(false);
  }

  async function handleAccept(roomName: string, bundle: Bundle) {
    setSavingRoom(roomName);
    try {
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

      const session = await loadSession();
      const existing = session?.claim_items ?? [];
      const existingKeys = new Set(existing.map((i) => `${i.room}::${i.description}`));

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
        await saveSession({ claim_items: [...existing, ...newItems] });
      }

      setAcceptedCodes((prev) => new Set([...prev, bundle.bundle_code]));
      setRoomTotals((prev) => ({
        ...prev,
        [roomName]: (prev[roomName] ?? 0) + bundle.total_value,
      }));
      setGrandTotal((prev) => prev + bundle.total_value);
      setToast(`${bundle.name} added — ${formatCurrency(bundle.total_value)}`);
    } finally {
      setSavingRoom(null);
    }
  }

  const progress = Math.min(100, (grandTotal / TARGET) * 100);

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-2xl px-4 pb-32 pt-8">
        {/* Header */}
        <header className="mb-8">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-gray-400">
            ClaimBuilder
          </p>
          <h1 className="text-xl font-semibold text-gray-900">
            Israel Claim · #7579B726D
          </h1>

          <div className="mt-5">
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="text-2xl font-bold tabular-nums text-gray-900">
                {formatCurrency(grandTotal)}
              </span>
              <span className="text-sm text-gray-400">
                of {formatCurrency(TARGET)}
              </span>
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-[#2563EB] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-1.5 tabular-nums text-xs text-gray-400">
              {formatCurrency(TARGET - grandTotal)} remaining
            </p>
          </div>
        </header>

        {/* Room list */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className="h-14 animate-pulse rounded-xl bg-gray-100"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {ROOMS.map((room) => (
              <RoomRow
                key={room.name}
                room={room}
                roomTotal={roomTotals[room.name] ?? 0}
                bundles={allBundles[room.name] ?? []}
                sliderIdx={sliderIdx[room.name] ?? 0}
                onSliderChange={(idx) =>
                  setSliderIdx((prev) => ({ ...prev, [room.name]: idx }))
                }
                acceptedCodes={acceptedCodes}
                onAccept={(bundle) => handleAccept(room.name, bundle)}
                saving={savingRoom === room.name}
              />
            ))}

            <ArtRow
              artAdded={artAdded}
              onAdd={() => {
                setArtAdded(true);
                setGrandTotal((prev) => prev + 300_000);
                setToast("Art placeholder added — $300,000");
              }}
            />
          </div>
        )}
      </div>

      {/* Fixed bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-gray-200 bg-white">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-4 py-3.5">
          <div className="text-sm">
            <span className="text-gray-500">Total: </span>
            <span className="font-semibold tabular-nums">{formatCurrency(grandTotal)}</span>
            <span className="ml-1.5 text-xs text-gray-400">/ {formatCurrency(TARGET)}</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="/api/export-xact"
              className="text-sm font-medium text-[#2563EB] hover:underline"
            >
              Export .xls
            </a>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
