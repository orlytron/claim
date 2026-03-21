"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { dispatchUpgradeReward } from "../components/UpgradeRewardToast";
import { loadSession, saveSession } from "../lib/session";
import { ClaimItem } from "../lib/types";
import { formatCurrency } from "../lib/utils";
import { useClaimMode } from "../lib/useClaimMode";
import { CLAIM_GOAL_DEFAULT, DEFAULT_ROOM_TARGETS } from "../lib/room-targets";
import { readRoomGoal } from "../lib/room-goals";

const ART_ROOM = "Art Collection";
const ART_RESERVED_PLACEHOLDER = 300_000;

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

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="fixed bottom-24 left-1/2 z-40 max-w-sm -translate-x-1/2 rounded-xl bg-gray-900 px-5 py-3 text-base text-white shadow-xl">
      {message}
      <button type="button" className="ml-3 text-green-400" onClick={onDismiss}>
        ✓
      </button>
    </div>
  );
}

function SimpleRoomCard({
  room,
  slug,
  display,
  original,
  current,
  target,
}: {
  room: string;
  slug: string;
  display?: string;
  original: number;
  current: number;
  target: number;
}) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const label = display ?? room;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-gray-900">{label}</h3>
      <div className="mt-3 grid grid-cols-2 gap-3 text-sm tabular-nums">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Original</p>
          <p className="mt-0.5 font-semibold text-gray-900">{formatCurrency(original)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Current</p>
          <p className="mt-0.5 font-semibold text-[#2563EB]">{formatCurrency(current)}</p>
        </div>
      </div>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs font-medium text-gray-500">
          <span>Room progress</span>
          <span>{pct}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-[#2563EB] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <Link
        href={`/review/${slug}`}
        className="mt-4 flex min-h-[48px] items-center justify-center rounded-xl bg-[#2563EB] text-base font-bold text-white transition hover:bg-blue-700"
      >
        Enter Room →
      </Link>
    </div>
  );
}

export default function ReviewDashboard() {
  const router = useRouter();
  const { mode, setMode, sessionId, hydrated } = useClaimMode();

  const [isLoading, setIsLoading] = useState(true);
  const [modeSwitching, setModeSwitching] = useState(false);
  const [sessionItems, setSessionItems] = useState<ClaimItem[]>([]);
  const [claimGoal, setClaimGoal] = useState(CLAIM_GOAL_DEFAULT);
  const [toast, setToast] = useState<string | null>(null);

  const [artDesc, setArtDesc] = useState("");
  const [artArtist, setArtArtist] = useState("");
  const [artMedium, setArtMedium] = useState("");
  const [artSize, setArtSize] = useState("");
  const [artValue, setArtValue] = useState("");
  const [artSaving, setArtSaving] = useState(false);

  useEffect(() => {
    if (hydrated) loadData(sessionId, mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, sessionId]);

  const handleSetMode = useCallback(
    async (newMode: typeof mode) => {
      if (newMode === mode) return;
      setModeSwitching(true);
      const newSessionId = newMode === "test" ? "test" : "trial";
      setMode(newMode);
      await loadData(newSessionId, newMode, true);
      setModeSwitching(false);
    },
    [mode, setMode]
  );

  async function loadData(sid = sessionId, currentMode = mode, fromSwitch = false) {
    if (!fromSwitch) setIsLoading(true);
    let session = await loadSession(sid);

    if (!session?.claim_items?.length) {
      if (currentMode === "test") {
        const liveSession = await loadSession("trial");
        if (liveSession?.claim_items?.length) {
          try {
            await saveSession(
              {
                claim_items: liveSession.claim_items,
                room_summary: liveSession.room_summary,
                room_budgets: null,
              },
              "test"
            );
            session = { ...liveSession, room_budgets: null };
          } catch (e) {
            console.error("Could not copy live → test:", e);
          }
        }
        if (!session?.claim_items?.length) {
          setSessionItems([]);
          setClaimGoal(CLAIM_GOAL_DEFAULT);
          setIsLoading(false);
          return;
        }
      } else {
        router.replace("/");
        return;
      }
    }

    setSessionItems(session!.claim_items!);
    setClaimGoal(session!.target_value ?? CLAIM_GOAL_DEFAULT);
    setIsLoading(false);
  }

  const roomTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const item of sessionItems) {
      const r = item.room || "Uncategorized";
      t[r] = (t[r] ?? 0) + item.unit_cost * item.qty;
    }
    return t;
  }, [sessionItems]);

  /** Baseline PDF-style value per room (pre-upgrade unit costs where applicable). */
  const roomOriginal = useMemo(() => {
    const t: Record<string, number> = {};
    for (const item of sessionItems) {
      const r = item.room || "Uncategorized";
      if (item.source === "upgrade" && item.pre_upgrade_item) {
        t[r] = (t[r] ?? 0) + item.qty * item.pre_upgrade_item.unit_cost;
      } else if (!item.source || item.source === "original") {
        t[r] = (t[r] ?? 0) + item.qty * item.unit_cost;
      }
    }
    return t;
  }, [sessionItems]);

  const lineItemsTotal = useMemo(
    () => sessionItems.reduce((sum, item) => sum + item.qty * item.unit_cost, 0),
    [sessionItems]
  );

  const artItems = useMemo(() => sessionItems.filter((i) => i.room === ART_ROOM), [sessionItems]);
  const artManualTotal = useMemo(
    () => artItems.reduce((s, i) => s + i.qty * i.unit_cost, 0),
    [artItems]
  );

  const grandTotal = lineItemsTotal;

  const globalPct = claimGoal > 0 ? Math.min(100, Math.round((grandTotal / claimGoal) * 100)) : 0;

  const breakdown = useMemo(() => {
    let original = 0;
    let upgrade = 0;
    let bundle = 0;
    for (const item of sessionItems) {
      const line = item.qty * item.unit_cost;
      const src = item.source ?? "original";
      if (src === "upgrade") upgrade += line;
      else if (src === "bundle") bundle += line;
      else original += line;
    }
    return { original, upgrade, bundle };
  }, [sessionItems]);

  async function handleAddArt(e: React.FormEvent) {
    e.preventDefault();
    const v = parseFloat(artValue.replace(/[^0-9.]/g, ""));
    if (!artDesc.trim() || Number.isNaN(v) || v <= 0) {
      setToast("Enter a description and valid value");
      return;
    }
    setArtSaving(true);
    try {
      const line: ClaimItem = {
        room: ART_ROOM,
        description: artDesc.trim(),
        brand: artArtist.trim(),
        model: artSize.trim(),
        qty: 1,
        age_years: 0,
        age_months: 0,
        condition: "Average",
        unit_cost: v,
        category: artMedium.trim(),
        source: "bundle",
      };
      const before = sessionItems.reduce((s, i) => s + i.qty * i.unit_cost, 0);
      const merged = [...sessionItems, line];
      const after = merged.reduce((s, i) => s + i.qty * i.unit_cost, 0);
      await saveSession({ claim_items: merged }, sessionId);
      setSessionItems(merged);
      dispatchUpgradeReward({
        delta: v,
        claimTotal: after,
        goalPctBefore: claimGoal > 0 ? Math.min(100, Math.round((before / claimGoal) * 100)) : 0,
        goalPctAfter: claimGoal > 0 ? Math.min(100, Math.round((after / claimGoal) * 100)) : 0,
      });
      setArtDesc("");
      setArtArtist("");
      setArtMedium("");
      setArtSize("");
      setArtValue("");
      setToast("Art item added to claim");
    } finally {
      setArtSaving(false);
    }
  }

  if (!hydrated || isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
          <p className="text-base font-medium text-gray-500">
            {modeSwitching ? `Switching to ${mode} mode…` : "Loading…"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      {modeSwitching && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
            <p className="text-base font-semibold text-gray-700">
              Switching to {mode === "test" ? "test" : "live"} mode…
            </p>
          </div>
        </div>
      )}
      <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-[720px] px-4 pb-40 pt-8">
          {mode === "test" && (
            <div className="mb-4 flex items-center justify-between gap-4 rounded-xl border border-orange-300 bg-orange-100 px-4 py-3">
              <p className="text-sm font-bold text-orange-700">🧪 TEST MODE — changes save to test session only.</p>
              <button
                type="button"
                onClick={() => handleSetMode("live")}
                className="shrink-0 rounded border border-orange-400 px-2 py-1 text-xs font-bold text-orange-700 hover:bg-orange-200"
              >
                Live
              </button>
            </div>
          )}

          <header className="mb-8">
            <div className="mb-1 flex items-center justify-between">
              <p className="text-sm font-semibold uppercase tracking-widest text-gray-400">ClaimBuilder</p>
              <div className="flex items-center gap-1 rounded-full bg-gray-100 p-1">
                {(["live", "test"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSetMode(m)}
                    disabled={modeSwitching}
                    className={`rounded-full px-3 py-1 text-xs font-bold capitalize transition-colors disabled:opacity-50 ${
                      mode === m
                        ? m === "test"
                          ? "bg-orange-500 text-white"
                          : "bg-[#2563EB] text-white"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Israel Claim · #7579B726D</h1>

            <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-5">
              <h2 className="mb-3 text-base font-bold uppercase tracking-wider text-gray-400">Claim overview</h2>
              <div className="mb-4 space-y-1.5 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm">
                <div className="flex justify-between tabular-nums">
                  <span className="text-gray-600">Original (PDF)</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(breakdown.original)}</span>
                </div>
                <div className="flex justify-between tabular-nums">
                  <span className="text-gray-600">Upgrades</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(breakdown.upgrade)}</span>
                </div>
                <div className="flex justify-between tabular-nums">
                  <span className="text-gray-600">Additions</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(breakdown.bundle)}</span>
                </div>
                <div className="flex justify-between border-t border-gray-100 pt-2 tabular-nums">
                  <span className="font-bold text-gray-800">Total</span>
                  <span className="font-bold text-gray-900">{formatCurrency(lineItemsTotal)}</span>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Goal</p>
                  <p className="text-2xl font-bold tabular-nums text-gray-900">{formatCurrency(claimGoal)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Progress</p>
                  <p className="text-2xl font-bold tabular-nums text-[#2563EB]">{globalPct}%</p>
                </div>
              </div>
              <div className="mt-4 h-4 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-[#2563EB] transition-all duration-500"
                  style={{ width: `${globalPct}%` }}
                />
              </div>
            </div>
          </header>

          <div className="space-y-4">
            <h2 className="text-base font-bold uppercase tracking-wider text-gray-400">Rooms</h2>
            {ROOMS.map((room) => {
              const target = readRoomGoal(sessionId, room.name) ?? DEFAULT_ROOM_TARGETS[room.name] ?? 0;
              const current = roomTotals[room.name] ?? 0;
              const original = roomOriginal[room.name] ?? 0;
              return (
                <SimpleRoomCard
                  key={room.slug}
                  room={room.name}
                  slug={room.slug}
                  display={room.display}
                  original={original}
                  current={current}
                  target={target}
                />
              );
            })}
          </div>

          <section className="mt-10 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/40 px-5 py-6">
            <h2 className="text-lg font-bold text-gray-900">🎨 Art collection</h2>
            <p className="mt-2 text-base text-gray-600">
              Art items are managed separately. Your advisor will provide the list.
            </p>
            <p className="mt-3 text-base font-semibold text-gray-800">
              Reserved: {formatCurrency(ART_RESERVED_PLACEHOLDER)}{" "}
              <span className="text-sm font-normal text-gray-500">(placeholder)</span>
            </p>
            {artItems.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-amber-200/60 pt-4 text-sm">
                {artItems.map((it, idx) => (
                  <li key={`${it.description}-${idx}`} className="flex justify-between gap-2 tabular-nums">
                    <span className="min-w-0 text-gray-800">{it.description}</span>
                    <span className="shrink-0 font-semibold">{formatCurrency(it.qty * it.unit_cost)}</span>
                  </li>
                ))}
                <li className="flex justify-between border-t border-amber-200/60 pt-2 font-bold text-gray-900">
                  <span>Manual art total</span>
                  <span>{formatCurrency(artManualTotal)}</span>
                </li>
              </ul>
            )}
            <form onSubmit={handleAddArt} className="mt-6 space-y-3 rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-sm font-bold text-gray-700">+ Add art item manually</p>
              <input
                value={artDesc}
                onChange={(e) => setArtDesc(e.target.value)}
                placeholder="Description"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-base"
              />
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  value={artArtist}
                  onChange={(e) => setArtArtist(e.target.value)}
                  placeholder="Artist (optional)"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-base"
                />
                <input
                  value={artMedium}
                  onChange={(e) => setArtMedium(e.target.value)}
                  placeholder="Medium (optional)"
                  className="rounded-lg border border-gray-200 px-3 py-2 text-base"
                />
              </div>
              <input
                value={artSize}
                onChange={(e) => setArtSize(e.target.value)}
                placeholder="Size (optional)"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-base"
              />
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-gray-500">$</span>
                <input
                  value={artValue}
                  onChange={(e) => setArtValue(e.target.value)}
                  placeholder="Value"
                  className="min-w-[120px] flex-1 rounded-lg border border-gray-200 px-3 py-2 text-base tabular-nums"
                />
              </div>
              <button
                type="submit"
                disabled={artSaving}
                className="w-full min-h-[48px] rounded-xl bg-[#2563EB] text-base font-bold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {artSaving ? "Saving…" : "Add to claim"}
              </button>
            </form>
          </section>

          <p className="mt-8 text-center">
            <Link href="/admin" className="text-sm text-gray-400 underline hover:text-gray-600">
              Admin
            </Link>
          </p>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-gray-200 bg-white">
          <div className="mx-auto max-w-[720px] px-4 py-4">
            <div className="flex items-center justify-between gap-4">
              <div className="text-base">
                <span className="text-gray-500">Total: </span>
                <span className="text-xl font-bold tabular-nums text-gray-900">{formatCurrency(grandTotal)}</span>
                <span className="ml-1 text-sm text-gray-400">/ {formatCurrency(claimGoal)}</span>
              </div>
              <a
                href={`/api/export-xact?sessionId=${encodeURIComponent(sessionId)}`}
                className="flex min-h-[48px] items-center rounded-xl bg-[#16A34A] px-5 py-2.5 text-base font-bold text-white transition-colors hover:bg-green-700"
              >
                Download Claim
              </a>
            </div>
          </div>
        </div>

        {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      </div>
    </>
  );
}
