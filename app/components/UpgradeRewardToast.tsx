"use client";

import { useEffect, useState } from "react";

export type UpgradeRewardDetail = {
  delta: number;
  claimTotal: number;
  goalPctBefore: number;
  goalPctAfter: number;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Listens for `claim-upgrade-reward` CustomEvent on window (detail: UpgradeRewardDetail).
 */
export default function UpgradeRewardToast() {
  const [payload, setPayload] = useState<UpgradeRewardDetail | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let hideTimer: ReturnType<typeof setTimeout>;
    let clearTimer: ReturnType<typeof setTimeout>;
    function onReward(e: Event) {
      const ce = e as CustomEvent<UpgradeRewardDetail>;
      if (!ce.detail) return;
      clearTimeout(hideTimer);
      clearTimeout(clearTimer);
      setPayload(ce.detail);
      setVisible(true);
      hideTimer = setTimeout(() => {
        setVisible(false);
        clearTimer = setTimeout(() => setPayload(null), 400);
      }, 3000);
    }
    window.addEventListener("claim-upgrade-reward", onReward as EventListener);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(clearTimer);
      window.removeEventListener("claim-upgrade-reward", onReward as EventListener);
    };
  }, []);

  if (!payload) return null;

  return (
    <div
      className={`fixed right-4 top-4 z-50 max-w-[280px] rounded-xl border border-green-200 bg-white p-4 text-base shadow-lg transition-all duration-500 ease-out ${
        visible ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-4 opacity-0"
      }`}
      role="status"
    >
      <p className="font-bold text-gray-900">✓ Claim updated!</p>
      <p className="mt-1 font-bold text-green-600 tabular-nums">+{formatCurrency(payload.delta)} added</p>
      <p className="mt-2 text-gray-600 tabular-nums">Claim: {formatCurrency(payload.claimTotal)}</p>
      <p className="text-gray-600 tabular-nums">
        Goal:{" "}
        <span className="font-semibold text-[#2563EB]">
          {payload.goalPctBefore}% → {payload.goalPctAfter}%
        </span>
      </p>
    </div>
  );
}

export function dispatchUpgradeReward(detail: UpgradeRewardDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("claim-upgrade-reward", { detail }));
}
