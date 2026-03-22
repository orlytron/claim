"use client";

import { useEffect, useState } from "react";

export type UpgradeRewardDetail = {
  delta: number;
  claimTotal: number;
  goalPctBefore: number;
  goalPctAfter: number;
  /** e.g. "✓ Added $9,800 to Living Room" */
  label?: string;
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
        clearTimer = setTimeout(() => setPayload(null), 100);
      }, 1500);
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
      className={`fixed left-1/2 top-4 z-50 flex min-h-12 max-w-[min(100vw-2rem,28rem)] -translate-x-1/2 items-center justify-center rounded-lg border border-green-200 bg-white px-4 py-3 text-center text-sm font-semibold text-[#16A34A] shadow-lg transition-opacity duration-200 ease-out tabular-nums ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
      role="status"
    >
      {payload.label ?? `✓ +${formatCurrency(payload.delta)} added`}
    </div>
  );
}

export function dispatchUpgradeReward(detail: UpgradeRewardDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("claim-upgrade-reward", { detail }));
}
