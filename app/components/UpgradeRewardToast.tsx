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
        clearTimer = setTimeout(() => setPayload(null), 200);
      }, 1000);
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
      className={`fixed right-4 top-4 z-50 flex h-12 max-h-[48px] min-w-[140px] items-center rounded-lg border border-green-200 bg-white px-3 py-2 text-sm font-semibold text-[#16A34A] shadow-md transition-all duration-300 ease-out tabular-nums ${
        visible ? "translate-x-0 opacity-100" : "pointer-events-none translate-x-6 opacity-0"
      }`}
      role="status"
    >
      ✓ +{formatCurrency(payload.delta)} added
    </div>
  );
}

export function dispatchUpgradeReward(detail: UpgradeRewardDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("claim-upgrade-reward", { detail }));
}
