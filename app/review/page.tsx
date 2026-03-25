"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { loadSession, saveSession } from "../lib/session";
import { ClaimItem } from "../lib/types";
import { formatCurrency } from "../lib/utils";
import { useClaimMode } from "../lib/useClaimMode";
import { CLAIM_GOAL_DEFAULT, DEFAULT_ROOM_TARGETS } from "../lib/room-targets";
import { readRoomGoal } from "../lib/room-goals";

const ART_ROOM = "Art Collection";
const ART_RESERVED_PLACEHOLDER = 300_000;

function formatSignedGap(value: number): string {
  if (value < 0) return `−${formatCurrency(Math.abs(value))}`;
  if (value > 0) return `+${formatCurrency(value)}`;
  return formatCurrency(0);
}

function progressBracket(pct: number): string {
  const filled = Math.min(10, Math.max(0, Math.round((pct / 100) * 10)));
  return `[${"█".repeat(filled)}${"░".repeat(10 - filled)}]`;
}

const ROOMS: { name: string; slug: string; display?: string }[] = [
  { name: "Living Room", slug: "living-room" },
  { name: "Kitchen", slug: "kitchen" },
  { name: "David Office / Guest Room", slug: "david-office-guest-room", display: "David Office" },
  { name: "Bedroom Orly", slug: "bedroom-orly" },
  { name: "Bedroom Rafe", slug: "bedroom-rafe" },
  { name: "Patio", slug: "patio" },
  { name: "Garage", slug: "garage" },
  { name: "Master Bedroom", slug: "master-bedroom" },
  { name: "Master Bathroom", slug: "master-bathroom" },
  { name: "Master Closet", slug: "master-closet" },
  { name: "Bathroom White", slug: "bathroom-white" },
];

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="fixed left-1/2 top-4 z-40 max-w-[min(100vw-2rem,24rem)] -translate-x-1/2 rounded-xl bg-gray-900 px-5 py-3 text-center text-base text-white shadow-xl">
      {message}
      <button type="button" className="ml-3 text-green-400" onClick={onDismiss}>
        ✓
      </button>
    </div>
  );
}

function SimpleRoomCard({
  room: _room,
  slug,
  display,
  current,
  target,
}: {
  room: string;
  slug: string;
  display?: string;
  current: number;
  target: number;
}) {
  void _room;
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
  const gap = current - target;
  const label = display ?? _room;
  const href = `/review/${slug}`;
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-[#2563EB]/35 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-lg font-bold text-gray-900">{label}</h3>
      </div>
      <p className="mt-2 text-base font-semibold tabular-nums text-gray-900">
        {formatCurrency(current)}{" "}
        <span className="text-sm font-normal text-[#6B7280]">of {formatCurrency(target)} target</span>
      </p>
      <div className="mt-4">
        <div className="mb-1 flex justify-between text-xs font-medium text-gray-500">
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-gray-200">
          <div
            className="h-full rounded-full bg-[#2563EB] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <p className="mt-3 text-sm tabular-nums text-gray-800">
        Gap: <span className="font-semibold">{formatSignedGap(gap)}</span>
      </p>
      <div className="mt-4 flex min-h-[48px] items-center justify-center rounded-xl bg-[#2563EB] text-base font-bold text-white">
        Enter Room →
      </div>
    </Link>
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
  const [exporting, setExporting] = useState(false);
  const exportBusyRef = useRef(false);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(t);
  }, [toast]);

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

  const dashboardSums = useMemo(() => {
    let sumTargets = 0;
    let sumCurrent = 0;
    for (const r of ROOMS) {
      const tgt = readRoomGoal(sessionId, r.name) ?? DEFAULT_ROOM_TARGETS[r.name] ?? 0;
      sumTargets += tgt;
      sumCurrent += roomTotals[r.name] ?? 0;
    }
    return { sumTargets, sumCurrent, overallGap: sumCurrent - sumTargets };
  }, [sessionId, roomTotals]);

  const lineItemsTotal = useMemo(
    () => sessionItems.reduce((sum, item) => sum + item.qty * item.unit_cost, 0),
    [sessionItems]
  );

  const zeroPriceItems = useMemo(
    () => sessionItems.filter((i) => !i.unit_cost || i.unit_cost === 0),
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
    let additions = 0;
    for (const item of sessionItems) {
      const line = item.qty * item.unit_cost;
      const src = item.source ?? "original";
      if (src === "upgrade") upgrade += line;
      else if (src === "bundle" || src === "suggestion" || src === "art") additions += line;
      else original += line;
    }
    return { original, upgrade, additions };
  }, [sessionItems]);

  const additionCounts = useMemo(() => {
    let bundle = 0;
    let suggestion = 0;
    let art = 0;
    for (const item of sessionItems) {
      const src = item.source ?? "original";
      if (src === "bundle") bundle += 1;
      if (src === "suggestion") suggestion += 1;
      if (src === "art") art += 1;
    }
    return { bundle, suggestion, art };
  }, [sessionItems]);

  async function handleExportDownload() {
    if (exportBusyRef.current) return;
    exportBusyRef.current = true;
    setExporting(true);
    try {
      const res = await fetch(`/api/export-xact?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) throw new Error("export failed");
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition");
      const m = cd?.match(/filename="?([^";]+)"?/i);
      const name = m?.[1]?.trim() || "claim.xls";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setToast("Export failed — try again");
    } finally {
      exportBusyRef.current = false;
      setExporting(false);
    }
  }

  if (!hydrated || isLoading) {
    return (
      <div className="min-h-screen bg-white px-4 py-8">
        <div className="mx-auto max-w-[720px] animate-pulse space-y-4">
          <div className="h-8 w-48 rounded bg-gray-200" />
          <div className="h-40 rounded-2xl bg-gray-100" />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="h-36 rounded-2xl bg-gray-100" />
            <div className="h-36 rounded-2xl bg-gray-100" />
          </div>
          <div className="h-36 rounded-2xl bg-gray-100" />
          <p className="text-center text-sm text-gray-500">
            {modeSwitching ? `Switching to ${mode} mode…` : "Loading claim…"}
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
                  <span className="font-semibold text-gray-900">{formatCurrency(breakdown.additions)}</span>
                </div>
                <p className="text-xs text-gray-400">
                  Lines: {additionCounts.bundle} bundle · {additionCounts.suggestion} suggestion · {additionCounts.art}{" "}
                  art
                </p>
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
                  className="h-full rounded-full bg-[#2563EB] transition-[width] duration-700 ease-out"
                  style={{ width: `${globalPct}%` }}
                />
              </div>
              <div className="mt-4">
                <Link
                  href="/review/preview"
                  className="inline-flex min-h-[48px] w-full items-center justify-center rounded-xl border-2 border-[#2563EB] bg-white px-4 text-sm font-bold text-[#2563EB] hover:bg-blue-50 sm:w-auto"
                >
                  Preview full claim
                </Link>
              </div>
            </div>
          </header>

          <div className="space-y-4">
            <h2 className="text-base font-bold uppercase tracking-wider text-gray-400">Rooms</h2>
            {ROOMS.map((room) => {
              const target = readRoomGoal(sessionId, room.name) ?? DEFAULT_ROOM_TARGETS[room.name] ?? 0;
              const current = roomTotals[room.name] ?? 0;
              return (
                <SimpleRoomCard
                  key={room.slug}
                  room={room.name}
                  slug={room.slug}
                  display={room.display}
                  current={current}
                  target={target}
                />
              );
            })}

            <div className="relative my-8">
              <div className="absolute inset-x-0 top-1/2 border-t border-gray-300" aria-hidden />
              <p className="relative mx-auto w-max bg-white px-3 text-center text-xs font-medium uppercase tracking-wider text-gray-400">
                All rooms combined
              </p>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="space-y-2 text-sm tabular-nums">
                <div className="flex justify-between gap-2">
                  <span className="text-[#6B7280]">Current total:</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(dashboardSums.sumCurrent)}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#6B7280]">Sum of targets:</span>
                  <span className="font-semibold text-gray-900">{formatCurrency(dashboardSums.sumTargets)}</span>
                </div>
                <div className="flex justify-between gap-2 border-t border-gray-100 pt-2 font-semibold text-gray-900">
                  <span>Gap remaining:</span>
                  <span>{formatSignedGap(dashboardSums.overallGap)}</span>
                </div>
                <div className="flex justify-between gap-2 pt-1 text-[#6B7280]">
                  <span>Art collection:</span>
                  <span className="font-medium text-gray-800">
                    {formatCurrency(ART_RESERVED_PLACEHOLDER)} (placeholder)
                  </span>
                </div>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Planning guide only — adjust targets per room (✏️ on each card). Does not need to match your global
                goal exactly.
              </p>
            </div>
          </div>

          <section className="mt-10 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/40 px-5 py-6">
            <h2 className="text-lg font-bold text-gray-900">🎨 Art collection</h2>
            <p className="mt-2 text-base text-gray-600">
              Reserved {formatCurrency(ART_RESERVED_PLACEHOLDER)} — itemized on the art review page. Your advisor will
              finalize the list.
            </p>
            <p className="mt-3 text-lg font-bold tabular-nums text-gray-900">
              On claim: {formatCurrency(artManualTotal)}
              {artItems.length > 0 ? (
                <span className="ml-2 text-sm font-normal text-gray-500">({artItems.length} items)</span>
              ) : null}
            </p>
            <Link
              href="/review/art"
              className="mt-4 inline-flex min-h-[48px] w-full items-center justify-center rounded-xl bg-amber-600 text-base font-bold text-white hover:bg-amber-700 sm:w-auto sm:px-8"
            >
              Open art collection →
            </Link>
          </section>

          <p className="mt-8 text-center">
            <Link href="/admin" className="text-sm text-gray-400 underline hover:text-gray-600">
              Admin
            </Link>
          </p>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-gray-200 bg-white">
          <div className="mx-auto max-w-[720px] px-4 py-4">
            {zeroPriceItems.length > 0 ? (
              <p className="mb-2 text-center text-xs text-amber-600">
                ⚠ {zeroPriceItems.length} item{zeroPriceItems.length !== 1 ? "s have" : " has"} no price — add
                prices for a complete export
              </p>
            ) : null}
            <div className="flex items-center justify-between gap-4">
              <div className="text-base">
                <span className="text-gray-500">Total: </span>
                <span className="text-xl font-bold tabular-nums text-gray-900">{formatCurrency(grandTotal)}</span>
                <span className="ml-1 text-sm text-gray-400">/ {formatCurrency(claimGoal)}</span>
              </div>
              <button
                type="button"
                onClick={() => void handleExportDownload()}
                className="flex min-h-[48px] items-center rounded-xl bg-[#16A34A] px-5 py-2.5 text-base font-bold text-white transition-colors hover:bg-green-700"
              >
                {exporting ? "Preparing…" : "Download Claim"}
              </button>
            </div>
          </div>
        </div>

        {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      </div>
    </>
  );
}
