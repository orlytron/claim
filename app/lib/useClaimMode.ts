"use client";

import { useState, useEffect } from "react";

export type ClaimMode = "live" | "test";

export function useClaimMode() {
  const [mode, setModeState] = useState<ClaimMode>("live");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("claimMode") as ClaimMode | null;
    if (stored === "live" || stored === "test") setModeState(stored);
    setHydrated(true);
  }, []);

  function setMode(m: ClaimMode) {
    setModeState(m);
    localStorage.setItem("claimMode", m);
  }

  const sessionId = mode === "test" ? "test" : "trial";
  return { mode, setMode, sessionId, hydrated };
}
