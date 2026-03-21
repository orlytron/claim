"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AniGuide from "../components/AniGuide";
import SpeechBubble from "../components/SpeechBubble";
import { loadSession } from "../lib/session";
import { CLAIM_GOAL_DEFAULT } from "../lib/room-targets";
import { useClaimMode } from "../lib/useClaimMode";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function AnimatedCounter({ from, to, durationMs = 1500 }: { from: number; to: number; durationMs?: number }) {
  const [v, setV] = useState(from);
  useEffect(() => {
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const ease = 1 - (1 - t) ** 2;
      setV(from + (to - from) * ease);
      if (t < 1) requestAnimationFrame(tick);
    }
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [from, to, durationMs]);
  return <span className="tabular-nums font-bold">{formatCurrency(Math.round(v))}</span>;
}

export default function OnboardingPage() {
  const { sessionId, hydrated } = useClaimMode();
  const [step, setStep] = useState(0);
  const [bubbleVisible, setBubbleVisible] = useState(false);
  const [claim, setClaim] = useState(0);
  const [goal, setGoal] = useState(CLAIM_GOAL_DEFAULT);

  useEffect(() => {
    if (!hydrated) return;
    (async () => {
      const s = await loadSession(sessionId);
      const items = s?.claim_items ?? [];
      const total = items.reduce((sum, i) => sum + i.qty * i.unit_cost, 0);
      setClaim(total || 196_561);
      setGoal(s?.target_value ?? CLAIM_GOAL_DEFAULT);
    })();
  }, [hydrated, sessionId]);

  useEffect(() => {
    setBubbleVisible(false);
    const t = setTimeout(() => setBubbleVisible(true), 400);
    return () => clearTimeout(t);
  }, [step]);

  const gap = Math.max(0, goal - claim);
  const pct = goal > 0 ? Math.min(100, Math.round((claim / goal) * 100)) : 0;

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 to-white text-gray-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 via-white to-white px-4 py-10">
      <div className="mx-auto max-w-lg">
        {step === 0 && (
          <div className="flex flex-col items-center text-center">
            <div className="flex w-full items-start justify-center gap-3 sm:gap-4">
              <AniGuide expression="excited" size={80} className="sm:w-[100px] sm:h-auto sm:scale-110" />
              <SpeechBubble
                direction="left"
                visible={bubbleVisible}
                text={`Hi! I'm here to help you rebuild your claim. It's going to be quick and easy — promise! 🔥`}
              />
            </div>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="mt-10 min-h-[52px] rounded-2xl bg-[#2563EB] px-8 text-base font-bold text-white shadow-md transition hover:bg-blue-700"
            >
              Next →
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col items-center text-center">
            <div className="flex w-full flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center">
              <AniGuide expression="happy" size={80} className="sm:scale-125" />
              <SpeechBubble
                direction="left"
                visible={bubbleVisible}
                text={`Your original claim was ${formatCurrency(claim)}.\nYour goal is ${formatCurrency(goal)}.\nThat's a gap of ${formatCurrency(gap)} we're going to fill together.`}
              />
            </div>
            <div className="mt-8 w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between text-base text-gray-600">
                <AnimatedCounter from={0} to={claim} />
                <span className="text-gray-300">→</span>
                <span className="font-bold tabular-nums text-gray-900">{formatCurrency(goal)}</span>
              </div>
              <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-gray-200">
                <div
                  className="h-full rounded-full bg-[#2563EB] transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="mt-2 text-center text-sm font-semibold text-gray-600">{pct}%</p>
            </div>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="mt-8 min-h-[52px] rounded-2xl bg-[#2563EB] px-8 text-base font-bold text-white shadow-md transition hover:bg-blue-700"
            >
              Next →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col items-center text-center">
            <div className="flex w-full flex-col items-center gap-4 sm:flex-row sm:items-start sm:justify-center">
              <AniGuide expression="thinking" size={80} className="sm:scale-125" />
              <SpeechBubble
                direction="left"
                visible={bubbleVisible}
                text={`Here's how it works:\n1. We go room by room\n2. I suggest upgrades for what you have\n3. You pick what feels right\n4. We add missing items\n5. Export when done!`}
              />
            </div>
            <Link
              href="/review/living-room?guided=true"
              className="mt-10 inline-flex min-h-[52px] items-center rounded-2xl bg-[#16A34A] px-8 text-base font-bold text-white shadow-md transition hover:bg-green-700"
            >
              Got it! Let&apos;s start →
            </Link>
            <Link href="/review" className="mt-4 text-base text-gray-500 underline">
              Skip to dashboard
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
