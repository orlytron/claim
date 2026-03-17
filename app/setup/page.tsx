"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { loadSession, saveSession, RoomSummary } from "../lib/session";
import { ClaimItem, LifestyleProfile } from "../lib/types";
import { slugify, formatCurrency } from "../lib/utils";

type SetupStep = "loading" | "profile" | "strategy" | "budgets";

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function SectionHeader({ number, label }: { number: number; label: string }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2563EB] text-xs font-semibold text-white">
        {number}
      </span>
      <h2 className="text-lg font-semibold text-gray-900">{label}</h2>
    </div>
  );
}

export default function SetupPage() {
  const router = useRouter();
  const [step, setStep] = useState<SetupStep>("loading");
  const [claimItems, setClaimItems] = useState<ClaimItem[] | null>(null);
  const [roomSummary, setRoomSummary] = useState<RoomSummary[] | null>(null);
  const [currentTotal, setCurrentTotal] = useState<number>(0);

  // Phase A
  const [profile, setProfile] = useState<LifestyleProfile | null>(null);
  const [profileNotes, setProfileNotes] = useState("");
  const [isGeneratingProfile, setIsGeneratingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Phase B
  const [targetValue, setTargetValue] = useState("");
  const [strategy, setStrategy] = useState<"upgrades_only" | "upgrades_additions">("upgrades_only");

  // Phase C
  const [roomBudgets, setRoomBudgets] = useState<Record<string, number>>({});
  const [isSaving, setIsSaving] = useState(false);

  const rooms = roomSummary?.map((r) => r.room) ?? [];

  useEffect(() => {
    async function bootstrap() {
      const session = await loadSession();
      if (!session?.claim_items?.length) {
        router.push("/");
        return;
      }
      setClaimItems(session.claim_items);
      setRoomSummary(session.room_summary ?? null);
      const total =
        session.current_total ??
        session.claim_items.reduce((s, i) => s + i.qty * i.unit_cost, 0);
      setCurrentTotal(total);

      if (session.target_value) setTargetValue(String(session.target_value));
      if (session.strategy) setStrategy(session.strategy);

      if (session.lifestyle_profile) {
        setProfile(session.lifestyle_profile);
        setStep("profile");
      } else {
        setStep("profile");
        generateProfile(session.claim_items);
      }

      // Init room budgets
      if (session.room_budgets) {
        setRoomBudgets(session.room_budgets);
      } else if (session.room_summary) {
        initRoomBudgets(session.room_summary, session.target_value ?? total);
      }
    }
    bootstrap();
  }, []);

  function initRoomBudgets(summary: RoomSummary[], total: number) {
    const roomTotal = summary.reduce((s, r) => s + r.subtotal, 0);
    const budgets: Record<string, number> = {};
    summary.forEach((r) => {
      budgets[r.room] = roomTotal > 0 ? Math.round((r.subtotal / roomTotal) * total) : 0;
    });
    // Fix rounding
    const budgetTotal = Object.values(budgets).reduce((s, v) => s + v, 0);
    const diff = Math.round(total) - budgetTotal;
    if (diff !== 0 && summary.length > 0) {
      const largest = summary.reduce((max, r) =>
        (budgets[r.room] ?? 0) > (budgets[max.room] ?? 0) ? r : max
      );
      budgets[largest.room] = (budgets[largest.room] ?? 0) + diff;
    }
    setRoomBudgets(budgets);
  }

  async function generateProfile(items: ClaimItem[]) {
    setIsGeneratingProfile(true);
    setProfileError(null);
    try {
      const res = await fetch("/api/generate-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      if (!res.ok) throw new Error("Profile generation failed");
      const p = (await res.json()) as LifestyleProfile;
      setProfile(p);
      await saveSession({ lifestyle_profile: p });
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to generate profile");
    } finally {
      setIsGeneratingProfile(false);
    }
  }

  async function handleUpdateProfile() {
    if (!claimItems || !profile) return;
    setIsGeneratingProfile(true);
    try {
      const res = await fetch("/api/generate-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: claimItems,
          notes: profileNotes,
        }),
      });
      if (!res.ok) throw new Error("Profile update failed");
      const p = (await res.json()) as LifestyleProfile;
      setProfile(p);
      await saveSession({ lifestyle_profile: p });
      setProfileNotes("");
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsGeneratingProfile(false);
    }
  }

  // Linked slider logic: adjusting one room redistributes the remainder proportionally
  function handleBudgetChange(room: string, newValue: number) {
    const total = parseFloat(targetValue) || currentTotal;
    const clamped = Math.max(0, Math.min(total, newValue));
    const delta = clamped - (roomBudgets[room] ?? 0);
    if (delta === 0) return;

    const otherRooms = rooms.filter((r) => r !== room);
    const otherTotal = otherRooms.reduce((s, r) => s + (roomBudgets[r] ?? 0), 0);

    const next: Record<string, number> = { ...roomBudgets, [room]: clamped };

    if (otherTotal > 0) {
      const scale = Math.max(0, otherTotal - delta) / otherTotal;
      otherRooms.forEach((r) => {
        next[r] = Math.max(0, Math.round((roomBudgets[r] ?? 0) * scale));
      });
    } else if (delta < 0) {
      const share = Math.round((-delta) / otherRooms.length);
      otherRooms.forEach((r) => { next[r] = share; });
    }

    // Fix rounding drift
    const newTotal = Object.values(next).reduce((s, v) => s + v, 0);
    const drift = Math.round(total) - newTotal;
    if (drift !== 0 && otherRooms.length > 0) {
      const target = otherRooms.reduce((max, r) =>
        (next[r] ?? 0) >= (next[max] ?? 0) ? r : max, otherRooms[0]);
      next[target] = (next[target] ?? 0) + drift;
    }

    setRoomBudgets(next);
  }

  const targetNum = parseFloat(targetValue) || 0;
  const gap = targetNum - currentTotal;
  const budgetTotal = Object.values(roomBudgets).reduce((s, v) => s + v, 0);

  async function handleStartReview() {
    if (!rooms.length) return;
    setIsSaving(true);
    try {
      await saveSession({
        target_value: targetNum || undefined,
        strategy,
        room_budgets: roomBudgets,
        status: "review",
      });
      router.push(`/review/${slugify(rooms[0])}`);
    } catch {
      setIsSaving(false);
    }
  }

  async function handleTargetBlur() {
    if (targetNum > 0) {
      await saveSession({ target_value: targetNum });
      if (roomSummary) initRoomBudgets(roomSummary, targetNum);
    }
  }

  if (step === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4">
        <span className="text-xl font-semibold tracking-tight text-gray-900">ClaimBuilder</span>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12 space-y-12">

        {/* ── Phase A: Lifestyle Profile ──────────────────────────────────── */}
        <section>
          <SectionHeader number={1} label="Your Lifestyle Profile" />

          {isGeneratingProfile && !profile && (
            <div className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-6">
              <Spinner />
              <p className="text-sm text-gray-600">Analyzing your lifestyle profile from claim items…</p>
            </div>
          )}

          {profileError && (
            <div className="rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700">
              {profileError}
              <button onClick={() => claimItems && generateProfile(claimItems)} className="ml-2 underline">
                Retry
              </button>
            </div>
          )}

          {profile && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Design Tier</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900">{profile.design_tier}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Aesthetic</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900">{profile.aesthetic}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Art Engagement</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900">{profile.art_engagement}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Active Lifestyle</p>
                  <p className="mt-0.5 text-sm font-medium text-gray-900">
                    {profile.active_lifestyle?.join(", ") || "—"}
                  </p>
                </div>
                {profile.prioritize?.length > 0 && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Prioritize</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {profile.prioritize.map((p) => (
                        <span key={p} className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {profile.suggested_brands?.furniture?.length > 0 && (
                  <div className="sm:col-span-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                      Suggested Furniture Brands
                    </p>
                    <p className="mt-0.5 text-sm text-gray-700">
                      {profile.suggested_brands.furniture.join(", ")}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-5 border-t border-gray-200 pt-4">
                <label className="block text-xs font-medium uppercase tracking-wider text-gray-400 mb-1.5">
                  Add your own preferences
                </label>
                <textarea
                  value={profileNotes}
                  onChange={(e) => setProfileNotes(e.target.value)}
                  placeholder="Type brands, styles, specific items, or anything else to refine your profile…"
                  rows={2}
                  className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
                <div className="mt-2 flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    Profile updates will apply to all future tier suggestions.
                  </p>
                  <button
                    onClick={handleUpdateProfile}
                    disabled={isGeneratingProfile}
                    className="flex items-center gap-2 rounded-md bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
                  >
                    {isGeneratingProfile && <Spinner />}
                    Update Profile →
                  </button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Phase B: Target + Strategy ──────────────────────────────────── */}
        {profile && (
          <section>
            <SectionHeader number={2} label="Target Value & Strategy" />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              {/* Target value */}
              <div className="rounded-lg border border-gray-200 p-5">
                <label className="block text-xs font-medium uppercase tracking-wider text-gray-400 mb-3">
                  Target Claim Value
                </label>
                <div className="flex items-center gap-1.5 rounded-md border border-gray-300 px-3 py-2 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500">
                  <span className="text-gray-400 text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    onBlur={handleTargetBlur}
                    placeholder="0"
                    className="w-full bg-transparent text-2xl font-semibold text-gray-900 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
                <div className="mt-3 space-y-1 text-xs text-gray-500">
                  <div className="flex justify-between">
                    <span>Current claim value</span>
                    <span className="font-medium text-gray-900">{formatCurrency(currentTotal)}</span>
                  </div>
                  {targetNum > 0 && (
                    <div className="flex justify-between">
                      <span>{gap >= 0 ? "Gap to fill" : "Over target"}</span>
                      <span className={`font-medium ${gap >= 0 ? "text-blue-600" : "text-red-600"}`}>
                        {gap >= 0 ? "+" : ""}{formatCurrency(Math.abs(gap))}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Strategy */}
              <div className="rounded-lg border border-gray-200 p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-gray-400 mb-3">
                  Claim Strategy
                </p>
                <div className="space-y-3">
                  {(
                    [
                      {
                        value: "upgrades_only" as const,
                        title: "Upgrades only",
                        desc: "Improve existing items to like-kind replacements",
                      },
                      {
                        value: "upgrades_additions" as const,
                        title: "Upgrades + additions",
                        desc: "Improve items and add missing like-kind items",
                      },
                    ] as const
                  ).map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors ${
                        strategy === opt.value
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="strategy"
                        value={opt.value}
                        checked={strategy === opt.value}
                        onChange={() => setStrategy(opt.value)}
                        className="mt-0.5 accent-[#2563EB]"
                      />
                      <div>
                        <p className="text-sm font-medium text-gray-900">{opt.title}</p>
                        <p className="text-xs text-gray-500">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ── Phase C: Room Budget Allocator ──────────────────────────────── */}
        {profile && targetNum > 0 && rooms.length > 0 && (
          <section>
            <SectionHeader number={3} label="Room Budget Allocation" />
            <p className="mb-5 text-sm text-gray-500">
              Allocate your {formatCurrency(targetNum)} target across rooms. Sliders are
              linked — adjusting one redistributes the remainder automatically.
            </p>

            <div className="space-y-4">
              {rooms.map((room) => {
                const budget = roomBudgets[room] ?? 0;
                const pct = targetNum > 0 ? (budget / targetNum) * 100 : 0;
                const summaryRoom = roomSummary?.find((r) => r.room === room);

                return (
                  <div key={room} className="rounded-lg border border-gray-200 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-gray-900">{room}</span>
                        {summaryRoom && (
                          <span className="ml-2 text-xs text-gray-400">
                            {summaryRoom.item_count} items · original {formatCurrency(summaryRoom.subtotal)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums text-gray-900">
                          {formatCurrency(budget)}
                        </span>
                        <span className="w-10 text-right text-xs tabular-nums text-gray-400">
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={targetNum}
                      step={100}
                      value={budget}
                      onChange={(e) => handleBudgetChange(room, parseInt(e.target.value))}
                      className="w-full h-2 rounded-full appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #2563EB ${pct}%, #E5E7EB ${pct}%)`,
                      }}
                    />
                  </div>
                );
              })}
            </div>

            {/* Total check */}
            <div className="mt-4 flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <span className="text-sm text-gray-600">Total allocated</span>
              <span
                className={`text-sm font-semibold tabular-nums ${
                  Math.abs(budgetTotal - targetNum) < 50 ? "text-green-600" : "text-amber-600"
                }`}
              >
                {formatCurrency(budgetTotal)} of {formatCurrency(targetNum)}
              </span>
            </div>

            <div className="mt-8">
              <button
                onClick={handleStartReview}
                disabled={isSaving}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-green-600 px-6 py-3.5 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:opacity-60"
              >
                {isSaving && <Spinner />}
                Start Review →
              </button>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
