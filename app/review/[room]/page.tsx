"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import AniGuide from "../../components/AniGuide";
import FocusedAdditionCard from "../../components/FocusedAdditionCard";
import SuggestionConfirmModal from "../../components/SuggestionConfirmModal";
import SpeechBubble from "../../components/SpeechBubble";
import { dispatchUpgradeReward } from "../../components/UpgradeRewardToast";
import type { Bundle } from "../../lib/bundles-data";
import {
  getAdminOnlyBundlesForRoom,
  getConsumableBundlesForRoom,
  getFocusedBundlesForRoom,
} from "../../lib/bundles-client-catalog";
import { mergeClaimIncoming } from "../../lib/claim-item-merge";
import { CLAIM_GOAL_DEFAULT, DEFAULT_ROOM_TARGETS } from "../../lib/room-targets";
import { readRoomGoal, writeRoomGoal } from "../../lib/room-goals";
import { loadSession, saveSession, SessionData } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { computeMiscSegments, miscLineTotal, type MiscLine } from "../../lib/misc-items-slider";
import { displayAgeYears, ORIGINAL_CLAIM_ITEMS } from "../../lib/original-claim-data";
import { ClaimItem } from "../../lib/types";
import { useClaimMode } from "../../lib/useClaimMode";
import { generateItemId, slugify, formatCurrency } from "../../lib/utils";
import { UpgradeOptionsPanel, type UpgradeOption } from "./UpgradeOptionsPanel";

export type { UpgradeOption };
import { SUGGESTED_UPGRADES } from "../../lib/suggested-upgrades";
import { ROOM_ORDER } from "../../lib/room-order";

// ── Constants ─────────────────────────────────────────────────────────────────

const SLUG_TO_ROOM: Record<string, string> = {
  "living-room": "Living Room",
  kitchen: "Kitchen",
  "bedroom-rafe": "Bedroom Rafe",
  "bedroom-orly": "Bedroom Orly",
  patio: "Patio",
  garage: "Garage",
  "bathroom-white": "Bathroom White",
  "bathroom-master": "Bathroom Master",
  "david-office-guest-room": "David Office / Guest Room",
  art: "Art",
};

function displayRoomTitle(room: string) {
  return room === "Bathroom Master" ? "Master Bedroom" : room;
}

/** Persisted array of stable row keys — see lockKeyForItem */
const LS_LOCKED = "lockedItems";

const ROOM_GOAL_SLIDER_MAX = 600_000;
const ROOM_GOAL_SLIDER_STEP = 5000;

function sameClaimLine(a: ClaimItem, b: ClaimItem) {
  return (
    a.room === b.room &&
    a.description === b.description &&
    Math.abs(a.unit_cost - b.unit_cost) < 0.01
  );
}

function roundRoomGoalSlider(v: number) {
  return Math.min(
    ROOM_GOAL_SLIDER_MAX,
    Math.max(0, Math.round(v / ROOM_GOAL_SLIDER_STEP) * ROOM_GOAL_SLIDER_STEP)
  );
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function readLocked(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_LOCKED);
    const p = raw ? JSON.parse(raw) : [];
    return Array.isArray(p) ? p.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function writeLocked(keys: string[]) {
  localStorage.setItem(LS_LOCKED, JSON.stringify(keys));
}

/** Lines shown in the upgrade table + guided walkthrough (excludes art / low-value decor). */
function isUpgradeCandidate(item: ClaimItem): boolean {
  const desc = item.description.toLowerCase();
  const brand = (item.brand || "").toLowerCase();

  if (item.unit_cost < 100 && !(item.brand || "").trim()) return false;

  if (/\bxbox\b/i.test(desc)) return false;

  const artKeywords = [
    "artwork",
    "print",
    "painting",
    "sculpture",
    "photograph",
    "photo",
    "poster",
    "jersey",
    "memorabilia",
    "signed",
    "autographed",
    "emmy",
    "golden globe",
    "award",
    "pokemon",
    "simpsons",
    "banksy",
    "cameupinthedrought",
    "album",
    "plexiglas",
    "elephant",
    "zebra",
    "heart artwork",
    "collectible",
    "vintage t-shirt",
  ];
  if (artKeywords.some((k) => desc.includes(k))) return false;

  const genericKeywords = [
    "dental",
    "toothpaste",
    "soap",
    "floss",
    "candle",
    "vase",
    "bowl",
    "basket",
    "textile",
    "fabric",
    "curtain",
    "mat",
    "tack",
    "sharpie",
    "marker",
    "cord",
    "decorative",
    "diffuser",
    "crystal",
    "plant",
    "wax",
    "brush",
    "paint",
    "thumbtack",
    "bulletin",
    "milk crate",
    "craft supply",
    "coaster",
  ];
  if (genericKeywords.some((k) => desc.includes(k)) && !brand) return false;

  const goodBrands = [
    "sony",
    "apple",
    "dji",
    "epson",
    "sennheiser",
    "rh",
    "restoration hardware",
    "george smith",
    "glas italia",
    "knoll",
    "west elm",
    "wilson",
    "titleist",
    "specialized",
    "yamaha",
    "kawai",
    "seagull",
    "martin",
    "sub-zero",
    "casper",
    "saatva",
    "nectar",
    "chilewich",
    "east fork",
    "vitamix",
    "manfrotto",
    "rode",
    "beyerdynamic",
    "audio-technica",
    "razer",
    "benq",
    "dell",
    "quince",
    "rimowa",
    "away",
    "patagonia",
    "rei",
    "o'neill",
    "litelok",
    "hoto",
    "philips",
    "heath ceramics",
  ];
  if (goodBrands.some((b) => brand.includes(b) || desc.includes(b))) return true;

  if (item.unit_cost >= 500) return true;

  const upgradeCategories = ["furniture", "appliances", "electronics", "sports", "lighting", "kitchen"];
  if (upgradeCategories.includes(item.category?.toLowerCase() || "")) return true;

  return false;
}

// ── Page ──────────────────────────────────────────────────────────────────────

function SmallSpinner() {
  return (
    <svg className="h-5 w-5 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function LockButton({ locked, onToggle }: { locked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`shrink-0 rounded-lg p-2 text-sm leading-none transition-all duration-200 ${
        locked
          ? "bg-blue-50 text-[#2563EB] ring-1 ring-blue-200 hover:bg-blue-100"
          : "text-[#9CA3AF] hover:bg-gray-100"
      }`}
      title={locked ? "Unlock row (allow bundle replacements)" : "Lock row (keep this line as-is for bundles)"}
      aria-pressed={locked}
    >
      🔒
    </button>
  );
}

function QtyAdjuster({
  qty,
  disabled,
  onChange,
}: {
  qty: number;
  disabled?: boolean;
  onChange: (q: number) => void;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className="text-sm text-[#6B7280]">Qty:</span>
      <button
        type="button"
        disabled={disabled || qty <= 1}
        onClick={() => onChange(Math.max(1, qty - 1))}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-300 text-lg font-medium leading-none transition-colors hover:bg-gray-50 disabled:opacity-40"
      >
        −
      </button>
      <span className="min-w-[1.25rem] text-center text-base font-bold tabular-nums text-gray-900">{qty}</span>
      <button
        type="button"
        disabled={disabled || qty >= 20}
        onClick={() => onChange(Math.min(20, qty + 1))}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-gray-300 text-lg font-medium leading-none transition-colors hover:bg-gray-50 disabled:opacity-40"
      >
        +
      </button>
    </span>
  );
}

function SourceTag({ source }: { source?: ClaimItem["source"] }) {
  if (!source || source === "original")
    return (
      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[12px] font-medium text-gray-700">
        original
      </span>
    );
  if (source === "upgrade")
    return (
      <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[12px] font-medium text-[#2563EB]">
        ↑ upgraded
      </span>
    );
  if (source === "bundle")
    return (
      <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[12px] font-medium text-[#16A34A]">
        added
      </span>
    );
  if (source === "art")
    return (
      <span className="shrink-0 rounded-full bg-violet-50 px-2 py-0.5 text-[12px] font-medium text-violet-700">
        🎨 art
      </span>
    );
  if (source === "suggestion")
    return (
      <span className="shrink-0 rounded-full bg-amber-50 px-2 py-0.5 text-[12px] font-medium text-amber-800">
        suggested
      </span>
    );
  return null;
}

function CountUpMoney({ value, className = "" }: { value: number; className?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const start = performance.now();
    const dur = 900;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / dur);
      const ease = 1 - (1 - t) ** 2;
      setV(Math.round(value * ease));
      if (t < 1) requestAnimationFrame(tick);
    }
    const id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, [value]);
  return <span className={className}>{formatCurrency(v)}</span>;
}

export default function RoomReviewPage() {
  const params = useParams<{ room: string }>();
  const roomSlug = params.room;
  const router = useRouter();
  const searchParams = useSearchParams();
  const guided = searchParams.get("guided") === "true";
  const { sessionId, hydrated } = useClaimMode();

  const [session, setSession] = useState<SessionData | null>(null);
  const [roomName, setRoomName] = useState("");
  const [items, setItems] = useState<ClaimItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(t);
  }, [toast]);
  const [cachedDescs, setCachedDescs] = useState<Set<string>>(new Set());
  const [lockedKeys, setLockedKeys] = useState<string[]>([]);
  const [roomTarget, setRoomTarget] = useState(0);
  const [claimGoal, setClaimGoal] = useState(CLAIM_GOAL_DEFAULT);
  const [editTarget, setEditTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [openUpgradeKey, setOpenUpgradeKey] = useState<string | null>(null);
  const [householdSectionOpen, setHouseholdSectionOpen] = useState(false);
  const [householdPendingMult, setHouseholdPendingMult] = useState<number | null>(null);
  const [householdCustomOpen, setHouseholdCustomOpen] = useState(false);
  const [householdCustomMult, setHouseholdCustomMult] = useState(6);
  const [requestText, setRequestText] = useState("");
  const [requestStatus, setRequestStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [qtyFlashKey, setQtyFlashKey] = useState<string | null>(null);
  const [editingAgeKey, setEditingAgeKey] = useState<string | null>(null);
  const [ageDraft, setAgeDraft] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [suggestionsModalOpen, setSuggestionsModalOpen] = useState(false);
  /** User clicked “View initial suggestions” — reopen modal even if localStorage says dismissed. */
  const [reopenSuggestions, setReopenSuggestions] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const undoHistoryRef = useRef<ClaimItem[][]>([]);
  const undoFutureRef = useRef<ClaimItem[][]>([]);
  const [undoAvail, setUndoAvail] = useState(false);
  const [redoAvail, setRedoAvail] = useState(false);

  const [guidedEnter, setGuidedEnter] = useState(false);
  const [guidedLoadBubble, setGuidedLoadBubble] = useState(false);
  const [guidedLoadVisible, setGuidedLoadVisible] = useState(false);
  const [guidedLoadDismissed, setGuidedLoadDismissed] = useState(false);
  const [guidedUpgradeDelta, setGuidedUpgradeDelta] = useState<number | null>(null);
  const [guidedUpgradeFromTo, setGuidedUpgradeFromTo] = useState<{ from: number; to: number } | null>(null);
  const [showGuidedComplete, setShowGuidedComplete] = useState(false);
  const firstUpgradeGuidedRef = useRef(false);
  const baselineOriginalRoomRef = useRef<number | null>(null);
  const guidedCompleteLatchRef = useRef(false);

  useEffect(() => {
    if (!guided) return;
    requestAnimationFrame(() => setGuidedEnter(true));
  }, [guided]);

  useEffect(() => {
    if (!guided || guidedLoadBubble || guidedLoadDismissed) return;
    const t = setTimeout(() => {
      setGuidedLoadBubble(true);
      setGuidedLoadVisible(true);
    }, 500);
    return () => clearTimeout(t);
  }, [guided, guidedLoadBubble, guidedLoadDismissed]);

  useEffect(() => {
    if (!guided || baselineOriginalRoomRef.current !== null || items.length === 0) return;
    const candidates = items.filter(isUpgradeCandidate);
    const o =
      candidates.length === 0
        ? 0
        : candidates.reduce((s, i) => {
            const unit = i.pre_upgrade_item ? i.pre_upgrade_item.unit_cost : i.unit_cost;
            return s + i.qty * unit;
          }, 0);
    baselineOriginalRoomRef.current = o;
  }, [guided, items]);

  useEffect(() => {
    firstUpgradeGuidedRef.current = false;
    baselineOriginalRoomRef.current = null;
    guidedCompleteLatchRef.current = false;
    setShowGuidedComplete(false);
    setGuidedLoadBubble(false);
    setGuidedLoadVisible(false);
    setGuidedLoadDismissed(false);
    setGuidedUpgradeDelta(null);
    setGuidedUpgradeFromTo(null);
  }, [roomSlug]);

  useEffect(() => {
    undoHistoryRef.current = [];
    undoFutureRef.current = [];
    setUndoAvail(false);
    setRedoAvail(false);
  }, [roomSlug]);

  const focusedBundles = useMemo(
    () => (roomName ? getFocusedBundlesForRoom(roomName) : []),
    [roomName]
  );
  const adminOnlyBundles = useMemo(
    () => (roomName ? getAdminOnlyBundlesForRoom(roomName) : []),
    [roomName]
  );
  const consumableBundles = useMemo(
    () => (roomName ? getConsumableBundlesForRoom(roomName) : []),
    [roomName]
  );

  useEffect(() => {
    setHouseholdPendingMult(null);
    setHouseholdCustomOpen(false);
    setHouseholdSectionOpen(false);
    setHouseholdCustomMult(6);
  }, [roomName]);

  useEffect(() => {
    setLockedKeys(readLocked());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsAdminUser(window.localStorage.getItem("isAdmin") === "true");
  }, []);

  useEffect(() => {
    if (!roomSlug) return;
    const key = `suggestions_shown_${roomSlug}`;
    const shown = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (guided) {
      setSuggestionsModalOpen(false);
      return;
    }
    if (!roomName) {
      setSuggestionsModalOpen(false);
      return;
    }
    const hasList = (SUGGESTED_UPGRADES[roomName] ?? []).length > 0;
    if (!hasList) {
      setSuggestionsModalOpen(false);
      return;
    }
    setSuggestionsModalOpen(shown == null || reopenSuggestions);
  }, [roomSlug, roomName, guided, reopenSuggestions]);

  useEffect(() => {
    if (!hydrated) return;
    void bootstrap();
  }, [roomSlug, hydrated, sessionId]);

  async function bootstrap() {
    setIsLoading(true);
    setLoadError(null);
    setItems([]);
    let sess: SessionData | null = null;
    try {
      sess = await loadSession(sessionId);
    } catch {
      setLoadError("We couldn’t load your claim. Check your connection and try again.");
      setIsLoading(false);
      return;
    }
    setSession(sess);
    const claimItems = sess?.claim_items ?? [];
    if (!sess) {
      const fallbackName = SLUG_TO_ROOM[roomSlug] ?? "";
      setRoomName(fallbackName);
      setItems([]);
      setClaimGoal(CLAIM_GOAL_DEFAULT);
      if (fallbackName) {
        const def = DEFAULT_ROOM_TARGETS[fallbackName] ?? 0;
        setRoomTarget(roundRoomGoalSlider(readRoomGoal(sessionId, fallbackName) ?? def));
      }
      setIsLoading(false);
      return;
    }
    setClaimGoal(sess.target_value ?? CLAIM_GOAL_DEFAULT);
    const rooms = sess.room_summary?.map((r) => r.room) ?? [...new Set(claimItems.map((i) => i.room))];
    const name = SLUG_TO_ROOM[roomSlug] ?? rooms.find((r) => slugify(r) === roomSlug) ?? "";
    setRoomName(name);
    if (!name) {
      setIsLoading(false);
      return;
    }
    const roomItems = claimItems.filter((i) => i.room === name);
    setItems(roomItems);

    const storedGoal = readRoomGoal(sessionId, name);
    const def = DEFAULT_ROOM_TARGETS[name] ?? 0;
    setRoomTarget(roundRoomGoalSlider(storedGoal ?? def));

    const descriptions = roomItems
      .filter((i) => i.unit_cost >= 500 && isUpgradeCandidate(i))
      .map((i) => i.pre_upgrade_item?.description ?? i.description);
    const params = new URLSearchParams();
    params.set("room", name);
    descriptions.forEach((d) => params.append("desc", d));
    try {
      const r = await fetch(`/api/upgrade-cache-status?${params.toString()}`);
      const j = (await r.json()) as { cached?: string[] };
      setCachedDescs(new Set((j.cached ?? []).map(norm)));
    } catch {
      setCachedDescs(new Set());
    }
    setIsLoading(false);
  }

  /** Tier 1: major items ($500+) — full row. Tier 2: misc — grouped section. */
  const tier1Sorted = useMemo(
    () => [...items].filter((i) => i.unit_cost >= 500).sort((a, b) => b.unit_cost - a.unit_cost),
    [items]
  );
  const tier2Sorted = useMemo(
    () => [...items].filter((i) => i.unit_cost < 500).sort((a, b) => b.unit_cost - a.unit_cost),
    [items]
  );
  const miscOriginalTotal = useMemo(
    () => tier2Sorted.reduce((s, i) => s + i.qty * i.unit_cost, 0),
    [tier2Sorted]
  );

  const householdMultDelta = useCallback(
    (m: number) =>
      tier2Sorted.reduce((s, item) => {
        const line: MiscLine = {
          description: item.description,
          qty: item.qty,
          unit_cost: item.unit_cost,
        };
        return s + (miscLineTotal(computeMiscSegments(line, m)) - item.qty * item.unit_cost);
      }, 0),
    [tier2Sorted]
  );

  const householdButtonDeltas = useMemo(
    () => ({
      same: householdMultDelta(1),
      x2: householdMultDelta(2),
      x3: householdMultDelta(3),
      custom: householdMultDelta(householdCustomMult),
    }),
    [householdMultDelta, householdCustomMult]
  );

  const householdPreviewLines = useMemo(() => {
    if (householdPendingMult == null) return [];
    const m = householdPendingMult;
    return tier2Sorted.map((item) => {
      const line: MiscLine = {
        description: item.description,
        qty: item.qty,
        unit_cost: item.unit_cost,
      };
      const segs = computeMiscSegments(line, m);
      const afterTotal = miscLineTotal(segs);
      const before = item.qty * item.unit_cost;
      return { item, segs, before, after: afterTotal, delta: afterTotal - before };
    });
  }, [tier2Sorted, householdPendingMult]);

  const householdPreviewTotalDelta =
    householdPendingMult == null ? 0 : householdMultDelta(householdPendingMult);

  const upgradeCandidates = useMemo(() => items.filter(isUpgradeCandidate), [items]);

  const upgradeSubtotal = useMemo(
    () => upgradeCandidates.reduce((s, i) => s + i.qty * i.unit_cost, 0),
    [upgradeCandidates]
  );

  const roomTotal = useMemo(() => items.reduce((s, i) => s + i.qty * i.unit_cost, 0), [items]);
  /** Original claim lines only (excludes bundle/art adds); uses pre-upgrade unit when upgraded */
  const originalRoomValue = useMemo(
    () =>
      items.reduce((s, i) => {
        if (i.source === "bundle" || i.source === "art" || i.source === "suggestion") return s;
        const u = i.pre_upgrade_item?.unit_cost ?? i.unit_cost;
        return s + i.qty * u;
      }, 0),
    [items]
  );
  const upgradeDeltaSub = useMemo(
    () =>
      items
        .filter((i) => i.source === "upgrade" && i.pre_upgrade_item)
        .reduce((s, i) => s + (i.unit_cost - i.pre_upgrade_item!.unit_cost) * i.qty, 0),
    [items]
  );
  const addedSub = useMemo(
    () =>
      items
        .filter((i) => i.source === "bundle" || i.source === "art" || i.source === "suggestion")
        .reduce((s, i) => s + i.qty * i.unit_cost, 0),
    [items]
  );

  const roomSuggestionList = useMemo(() => SUGGESTED_UPGRADES[roomName] ?? [], [roomName]);

  const progressPct = roomTarget > 0 ? Math.min(100, Math.round((roomTotal / roomTarget) * 100)) : 0;
  const gapRemaining = Math.max(0, roomTarget - roomTotal);

  useEffect(() => {
    if (!guided || guidedCompleteLatchRef.current || progressPct < 100) return;
    guidedCompleteLatchRef.current = true;
    setShowGuidedComplete(true);
  }, [guided, progressPct]);

  const roomNavIndex = useMemo(() => ROOM_ORDER.findIndex((r) => r.slug === roomSlug), [roomSlug]);
  const navPrev = roomNavIndex > 0 ? ROOM_ORDER[roomNavIndex - 1]! : null;
  const navNext =
    roomNavIndex >= 0 && roomNavIndex < ROOM_ORDER.length - 1 ? ROOM_ORDER[roomNavIndex + 1]! : null;

  const lockKeyForItem = useCallback(
    (item: ClaimItem) =>
      item.pre_upgrade_item
        ? `${roomName}|${item.pre_upgrade_item.description}|${item.pre_upgrade_item.unit_cost}`
        : `${roomName}|${item.description}|${item.unit_cost}`,
    [roomName]
  );

  function toggleLock(key: string) {
    const next = lockedKeys.includes(key) ? lockedKeys.filter((k) => k !== key) : [...lockedKeys, key];
    setLockedKeys(next);
    writeLocked(next);
  }

  function isItemLocked(item: ClaimItem) {
    return lockedKeys.includes(lockKeyForItem(item));
  }

  function flashQtySaved(key: string) {
    setQtyFlashKey(key);
    window.setTimeout(() => setQtyFlashKey(null), 1000);
  }

  async function persistRoomItemsSnapshot(newRoomItems: ClaimItem[]) {
    if (!session?.claim_items) return;
    const rest = session.claim_items.filter((i) => i.room !== roomName);
    const nextClaim = [...rest, ...newRoomItems];
    await saveSession({ claim_items: nextClaim }, sessionId);
    setSession((prev) => (prev ? { ...prev, claim_items: nextClaim } : prev));
    setItems(newRoomItems);
  }

  function pushUndoSnapshot() {
    const snap = items.map((i) => ({ ...i }));
    undoHistoryRef.current.push(snap);
    if (undoHistoryRef.current.length > 3) undoHistoryRef.current.shift();
    undoFutureRef.current = [];
    setUndoAvail(undoHistoryRef.current.length > 0);
    setRedoAvail(false);
  }

  /** Replace room items in session — full room list */
  async function saveRoomItems(newRoomItems: ClaimItem[], opts?: { skipHistory?: boolean }) {
    if (!session?.claim_items) return;
    if (!opts?.skipHistory) pushUndoSnapshot();
    await persistRoomItemsSnapshot(newRoomItems);
  }

  async function saveFullClaim(nextClaim: ClaimItem[]) {
    if (!session?.claim_items) return;
    pushUndoSnapshot();
    await saveSession({ claim_items: nextClaim }, sessionId);
    setSession((prev) => (prev ? { ...prev, claim_items: nextClaim } : prev));
    setItems(nextClaim.filter((i) => i.room === roomName));
  }

  async function undoRoom() {
    if (!undoHistoryRef.current.length || !session?.claim_items) return;
    const prevRoom = undoHistoryRef.current.pop()!;
    const curSnap = items.map((i) => ({ ...i }));
    undoFutureRef.current.push(curSnap);
    await persistRoomItemsSnapshot(prevRoom);
    setUndoAvail(undoHistoryRef.current.length > 0);
    setRedoAvail(undoFutureRef.current.length > 0);
  }

  async function redoRoom() {
    if (!undoFutureRef.current.length || !session?.claim_items) return;
    const nextRoom = undoFutureRef.current.pop()!;
    const curSnap = items.map((i) => ({ ...i }));
    undoHistoryRef.current.push(curSnap);
    if (undoHistoryRef.current.length > 3) undoHistoryRef.current.shift();
    await persistRoomItemsSnapshot(nextRoom);
    setUndoAvail(undoHistoryRef.current.length > 0);
    setRedoAvail(undoFutureRef.current.length > 0);
  }

  async function handleRemoveItemRow(item: ClaimItem) {
    if (!session?.claim_items) return;
    const next = items.filter((ci) => !sameClaimLine(ci, item));
    await saveRoomItems(next);
    setToast("Removed");
  }

  async function confirmResetRoom() {
    if (!session?.claim_items || !roomName) return;
    setIsSaving(true);
    try {
      const originals: ClaimItem[] = ORIGINAL_CLAIM_ITEMS.filter((i) => i.room === roomName).map((o) => ({
        room: o.room,
        description: o.description,
        brand: o.brand,
        model: o.model,
        qty: o.qty,
        age_years: o.age_years,
        age_months: o.age_months,
        condition: o.condition,
        unit_cost: o.unit_cost,
        category: o.category,
        source: "original" as const,
      }));
      const rest = session.claim_items.filter((i) => i.room !== roomName);
      const nextClaim = [...rest, ...originals];
      await saveFullClaim(nextClaim);
      const { error } = await supabase.from("bundle_decisions").delete().eq("room", roomName);
      if (error) console.warn("bundle_decisions delete:", error.message);
      setShowResetConfirm(false);
      setToast("Room reset to original");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateItemQty(item: ClaimItem, qty: number) {
    if (!session?.claim_items || qty < 1 || qty > 20) return;
    const next = items.map((ci) => (sameClaimLine(ci, item) ? { ...ci, qty } : ci));
    const key = lockKeyForItem(item);
    await saveRoomItems(next);
    flashQtySaved(key);
  }

  async function updateItemAge(item: ClaimItem, ageYears: number) {
    if (!session?.claim_items || ageYears < 0 || ageYears > 120) return;
    const next = items.map((ci) => (sameClaimLine(ci, item) ? { ...ci, age_years: ageYears } : ci));
    await saveRoomItems(next);
    setEditingAgeKey(null);
  }

  function claimTotals(claim: ClaimItem[]) {
    const t = claim.reduce((s, i) => s + i.qty * i.unit_cost, 0);
    const g = claimGoal > 0 ? Math.min(100, Math.round((t / claimGoal) * 100)) : 0;
    return { total: t, pct: g };
  }

  function fireUpgradeReward(beforeItems: ClaimItem[], afterItems: ClaimItem[], lineDelta: number, label?: string) {
    const before = claimTotals(beforeItems);
    const after = claimTotals(afterItems);
    dispatchUpgradeReward({
      delta: lineDelta,
      claimTotal: after.total,
      goalPctBefore: before.pct,
      goalPctAfter: after.pct,
      label: label ?? `✓ Added ${formatCurrency(lineDelta)} to ${roomName}`,
    });
  }

  async function handleApplyUpgrade(item: ClaimItem, option: UpgradeOption) {
    if (!session?.claim_items || isItemLocked(item)) return;
    setIsSaving(true);
    try {
    const beforeClaim = session.claim_items;
    const lineDelta = (option.price - item.unit_cost) * item.qty;
    const stableCode = `upgrade:${roomName}:${item.description}:${item.unit_cost}`.slice(0, 180);
    const snap: ClaimItem["pre_upgrade_item"] = {
      description: item.description,
      brand: item.brand,
      model: item.model,
      unit_cost: item.unit_cost,
      category: item.category,
      source: item.source ?? "original",
    };
    const nextItems = items.map((ci) => {
      if (ci.room === item.room && ci.description === item.description && ci.unit_cost === item.unit_cost) {
        return {
          ...ci,
          description: option.title,
          brand: option.brand,
          model: option.model,
          unit_cost: option.price,
          previous_unit_cost: item.unit_cost,
          pre_upgrade_item: snap,
          source: "upgrade" as const,
          age_years: 0,
          age_months: 0,
          condition: "New" as const,
          vendor_url: option.url || undefined,
          vendor_name: option.retailer || undefined,
        };
      }
      return ci;
    });
    const rest = beforeClaim.filter((i) => i.room !== roomName);
    const afterClaim = [...rest, ...nextItems];
    await saveRoomItems(nextItems);
    fireUpgradeReward(beforeClaim, afterClaim, lineDelta);
    if (guided && !firstUpgradeGuidedRef.current) {
      firstUpgradeGuidedRef.current = true;
      setGuidedUpgradeDelta(lineDelta);
      setGuidedUpgradeFromTo({ from: item.unit_cost, to: option.price });
    }
    try {
      await supabase.from("bundle_decisions").upsert(
        {
          bundle_code: stableCode,
          room: roomName,
          bundle_name: `Upgrade: ${item.description}`,
          action: "upgrade_applied",
          items: [
            {
              room: roomName,
              description: option.title,
              brand: option.brand,
              model: option.model,
              qty: item.qty,
              unit_cost: option.price,
              category: item.category,
              source: "upgrade",
              vendor_url: option.url,
              vendor_name: option.retailer,
            },
          ],
          total_value: option.price * item.qty,
        },
        { onConflict: "bundle_code" }
      );
    } catch (e) {
      console.warn(e);
    }
    setToast(`Upgraded — ${option.title}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleChangeUpgrade(item: ClaimItem, option: UpgradeOption) {
    if (!session?.claim_items || !item.pre_upgrade_item || isItemLocked(item)) return;
    setIsSaving(true);
    try {
    const beforeClaim = session.claim_items;
    const lineDelta = (option.price - item.unit_cost) * item.qty;
    const orig = item.pre_upgrade_item;
    const nextItems = items.map((ci) => {
      if (ci.room === item.room && ci.description === item.description && ci.unit_cost === item.unit_cost) {
        return {
          ...ci,
          description: option.title,
          brand: option.brand,
          model: option.model,
          unit_cost: option.price,
          previous_unit_cost: orig.unit_cost,
          pre_upgrade_item: orig,
          source: "upgrade" as const,
          age_years: 0,
          age_months: 0,
          condition: "New" as const,
          vendor_url: option.url || undefined,
          vendor_name: option.retailer || undefined,
        };
      }
      return ci;
    });
    const rest = beforeClaim.filter((i) => i.room !== roomName);
    const afterClaim = [...rest, ...nextItems];
    await saveRoomItems(nextItems);
    fireUpgradeReward(beforeClaim, afterClaim, lineDelta);
    setToast(`Changed upgrade — ${option.title}`);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRevert(item: ClaimItem) {
    if (!item.pre_upgrade_item || isItemLocked(item)) return;
    setIsSaving(true);
    try {
    const prev = item.pre_upgrade_item;
    const nextItems = items.map((ci) => {
      if (ci.room === item.room && ci.description === item.description && ci.unit_cost === item.unit_cost) {
        return {
          ...ci,
          description: prev.description,
          brand: prev.brand,
          model: item.model,
          unit_cost: prev.unit_cost,
          category: prev.category,
          source: item.pre_upgrade_item?.source ?? "original",
          previous_unit_cost: undefined,
          pre_upgrade_item: undefined,
          vendor_url: undefined,
          vendor_name: undefined,
        };
      }
      return ci;
    });
    await saveRoomItems(nextItems);
    setToast("Reverted to original line");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleApplySuggestionsFromBanner(nextClaim: ClaimItem[]) {
    if (!session?.claim_items) return;
    setIsSaving(true);
    try {
      await saveSession({ claim_items: nextClaim }, sessionId);
      setSession((prev) => (prev ? { ...prev, claim_items: nextClaim } : prev));
      setItems(nextClaim.filter((i) => i.room === roomName));
      if (typeof window !== "undefined" && roomSlug) {
        localStorage.setItem(`suggestions_shown_${roomSlug}`, "shown");
      }
      setReopenSuggestions(false);
      setSuggestionsModalOpen(false);
      setToast("Applied selected suggestions");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleFocusedBundleAdd(lines: ClaimItem[]) {
    if (!session?.claim_items || lines.length === 0 || !roomName) return;
    const beforeClaim = session.claim_items;
    pushUndoSnapshot();
    const withRoom = lines.map((l) => ({ ...l, room: roomName }));
    const merged = mergeClaimIncoming(beforeClaim, withRoom, "bundle");
    await saveSession({ claim_items: merged }, sessionId);
    setSession((prev) => (prev ? { ...prev, claim_items: merged } : prev));
    setItems(merged.filter((i) => i.room === roomName));
    const delta = withRoom.reduce((s, l) => s + l.qty * l.unit_cost, 0);
    fireUpgradeReward(beforeClaim, merged, delta);
    setToast(`✓ Added ${formatCurrency(delta)}`);
  }

  async function handleConsumableBundleAdd(b: Bundle) {
    if (!session?.claim_items || !roomName) return;
    pushUndoSnapshot();
    const beforeClaim = session.claim_items;
    const lines: ClaimItem[] = b.items.map((bi) => ({
      room: roomName,
      description: bi.description,
      brand: bi.brand || "",
      model: "",
      qty: bi.qty,
      age_years: 0,
      age_months: 0,
      condition: "New",
      unit_cost: bi.unit_cost,
      category: bi.category,
      source: "bundle",
    }));
    const merged = mergeClaimIncoming(beforeClaim, lines, "bundle");
    await saveSession({ claim_items: merged }, sessionId);
    setSession((prev) => (prev ? { ...prev, claim_items: merged } : prev));
    setItems(merged.filter((i) => i.room === roomName));
    const delta = lines.reduce((s, l) => s + l.qty * l.unit_cost, 0);
    fireUpgradeReward(beforeClaim, merged, delta);
    setToast(`✓ Added ${formatCurrency(delta)}`);
  }

  async function applyHouseholdMultiplier(m: number) {
    if (!session?.claim_items || tier2Sorted.length === 0) return;
    pushUndoSnapshot();
    const beforeClaim = session.claim_items;
    const nextRoom: ClaimItem[] = [];
    for (const ci of items) {
      if (ci.unit_cost >= 500) {
        nextRoom.push(ci);
        continue;
      }
      const line: MiscLine = {
        description: ci.description,
        qty: ci.qty,
        unit_cost: ci.unit_cost,
      };
      const segs = computeMiscSegments(line, m);
      const [first, ...rest] = segs;
      if (!first) {
        nextRoom.push(ci);
        continue;
      }
      nextRoom.push({
        ...ci,
        qty: first.qty,
        unit_cost: first.unit_cost,
      });
      for (const seg of rest) {
        nextRoom.push({
          ...ci,
          qty: seg.qty,
          unit_cost: seg.unit_cost,
        });
      }
    }
    const afterClaim = [...beforeClaim.filter((i) => i.room !== roomName), ...nextRoom];
    await persistRoomItemsSnapshot(nextRoom);
    const bt = beforeClaim.reduce((s, i) => s + i.qty * i.unit_cost, 0);
    const at = afterClaim.reduce((s, i) => s + i.qty * i.unit_cost, 0);
    fireUpgradeReward(beforeClaim, afterClaim, at - bt);
    setHouseholdPendingMult(null);
    setToast("Household items updated");
  }

  async function sendSpecificItemRequest() {
    if (!requestText.trim() || !roomName) return;
    setRequestStatus("loading");
    try {
      const { error } = await supabase.from("client_suggestions").insert({
        room: roomName,
        message: requestText.trim(),
        status: "pending",
      });
      if (error) setRequestStatus("error");
      else {
        setRequestStatus("success");
        setRequestText("");
      }
    } catch {
      setRequestStatus("error");
    }
  }

  function saveTargetFromEdit() {
    const raw = parseInt(targetInput.replace(/\D/g, ""), 10);
    if (Number.isNaN(raw) || raw < 0) return;
    const v = roundRoomGoalSlider(raw);
    setRoomTarget(v);
    writeRoomGoal(sessionId, roomName, v);
    setEditTarget(false);
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-gray-500 text-base">
        <SmallSpinner />
        Loading…
      </div>
    );
  }

  const showRoomChrome = !!roomName && !isLoading;

  const suggestionsModalVisible =
    !guided &&
    suggestionsModalOpen &&
    !!roomName &&
    !isLoading &&
    roomSuggestionList.length > 0 &&
    !!session?.claim_items;

  return (
    <div className="flex min-h-screen flex-col bg-white pb-24 md:pb-20">
      {session ? (
        <SuggestionConfirmModal
          open={suggestionsModalVisible}
          roomSlug={roomSlug}
          roomName={roomName}
          claimItems={session.claim_items ?? []}
          list={roomSuggestionList}
          onApply={handleApplySuggestionsFromBanner}
          onDismiss={() => {
            setReopenSuggestions(false);
            if (typeof window !== "undefined" && roomSlug) {
              localStorage.setItem(`suggestions_shown_${roomSlug}`, "shown");
            }
            setSuggestionsModalOpen(false);
          }}
          disabled={isSaving}
        />
      ) : null}
      {loadError ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
          <p className="max-w-md text-base text-red-700">{loadError}</p>
          <button
            type="button"
            onClick={() => void bootstrap()}
            className="min-h-[48px] rounded-xl bg-[#2563EB] px-6 text-sm font-bold text-white hover:bg-blue-700"
          >
            Retry
          </button>
          <Link href="/review" className="text-sm text-[#2563EB] underline">
            ← Dashboard
          </Link>
        </div>
      ) : isLoading ? (
        <div className="mx-auto w-full max-w-[1100px] flex-1 animate-pulse px-4 py-8 md:px-8">
          <div className="h-4 w-32 rounded bg-gray-200" />
          <div className="mt-6 h-10 w-2/3 max-w-md rounded bg-gray-200" />
          <div className="mt-4 h-4 w-full max-w-xl rounded bg-gray-100" />
          <div className="mt-8 space-y-3 rounded-2xl border border-gray-100 p-4">
            <div className="h-24 rounded-lg bg-gray-100" />
            <div className="h-24 rounded-lg bg-gray-100" />
            <div className="h-24 rounded-lg bg-gray-100" />
          </div>
        </div>
      ) : !roomName || (!items.length && roomSuggestionList.length === 0) ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-base text-[#6B7280]">
          No items for this room.
          <Link href="/review" className="mt-4 font-medium text-[#2563EB] hover:underline">
            ← All rooms
          </Link>
        </div>
      ) : (
        <>
          <header className="w-full bg-white">
            <div className="mx-auto w-full max-w-[1100px] px-4 py-6 transition-all duration-300 md:px-8">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[#6B7280]">
                  <Link href="/review" className="font-medium text-[#2563EB] hover:underline">
                    Home
                  </Link>
                  <span aria-hidden className="text-gray-300">
                    ›
                  </span>
                  <span className="truncate font-semibold text-gray-900">{displayRoomTitle(roomName)}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isSaving && <SmallSpinner />}
                  {navPrev ? (
                    <button
                      type="button"
                      onClick={() => {
                        const q = guided ? "?guided=true" : "";
                        router.push(`/review/${navPrev.slug}${q}`);
                      }}
                      className="min-h-[48px] inline-flex items-center rounded-lg px-2 text-sm font-medium text-[#2563EB] hover:underline md:text-base"
                    >
                      ← {navPrev.name}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => router.push("/review")}
                      className="min-h-[48px] inline-flex items-center rounded-lg px-2 text-sm font-medium text-[#2563EB] hover:underline md:text-base"
                    >
                      ← All rooms
                    </button>
                  )}
                  {navNext ? (
                    <button
                      type="button"
                      onClick={() => {
                        const q = guided ? "?guided=true" : "";
                        router.push(`/review/${navNext.slug}${q}`);
                      }}
                      className="min-h-[48px] inline-flex items-center rounded-lg px-2 text-sm font-medium text-[#2563EB] hover:underline md:text-base"
                    >
                      {navNext.name} →
                    </button>
                  ) : null}
                </div>
              </div>

              <h1 className="mt-5 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
                {displayRoomTitle(roomName)}
              </h1>
              <div className="mt-3 h-px w-full bg-gray-200" />

              <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2 text-sm text-[#6B7280] md:text-base">
                <span>
                  Original <span className="font-semibold tabular-nums text-gray-900">{formatCurrency(originalRoomValue)}</span>
                </span>
                <span className="text-gray-300">·</span>
                <span>
                  Current <span className="font-semibold tabular-nums text-gray-900">{formatCurrency(roomTotal)}</span>
                </span>
                <span className="text-gray-300">·</span>
                <span className="inline-flex flex-wrap items-center gap-1">
                  Target{" "}
                  <span className="font-semibold tabular-nums text-gray-900">{formatCurrency(roomTarget)}</span>
                  <button
                    type="button"
                    className="text-base leading-none"
                    onClick={() => {
                      setTargetInput(String(roomTarget));
                      setEditTarget(true);
                    }}
                    aria-label="Edit room goal"
                  >
                    ✏️
                  </button>
                </span>
                <span className="text-gray-300">·</span>
                <span>
                  Gap <span className="font-semibold tabular-nums text-gray-900">{formatCurrency(gapRemaining)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setShowResetConfirm(true)}
                  className="ml-1 text-xs font-medium text-[#2563EB] underline-offset-2 hover:underline"
                >
                  Reset room
                </button>
                {roomSuggestionList.length > 0 && !guided ? (
                  <>
                    <span className="text-gray-300">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        setReopenSuggestions(true);
                        setSuggestionsModalOpen(true);
                      }}
                      className="text-xs font-semibold text-amber-800 underline-offset-2 hover:underline"
                    >
                      View initial suggestions
                    </button>
                  </>
                ) : null}
              </p>

              {editTarget && (
                <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-gray-50/80 p-4 shadow-sm">
                  <input
                    className="min-w-[140px] flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                    value={targetInput}
                    onChange={(e) => setTargetInput(e.target.value)}
                    placeholder="350000"
                  />
                  <button
                    type="button"
                    onClick={saveTargetFromEdit}
                    className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-bold text-white transition-all duration-200 hover:bg-blue-700"
                  >
                    Save
                  </button>
                  <button type="button" onClick={() => setEditTarget(false)} className="text-sm text-[#6B7280] hover:text-gray-900">
                    Cancel
                  </button>
                </div>
              )}

              <div className="mt-8">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium text-gray-800">{progressPct}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-full rounded-full bg-[#2563EB] transition-[width] duration-500 ease-out"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs leading-relaxed text-[#6B7280] md:text-sm">
                  Upgrade existing items below, then add new items to reach your goal
                </p>
              </div>

            </div>
          </header>

          <main
            id="claim-items-anchor"
            className="mx-auto w-full max-w-[1100px] flex-1 scroll-mt-24 overflow-x-hidden px-4 py-6 md:px-8"
          >
            <section className="rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300">
              <div className="border-b border-gray-100 px-5 py-5 md:px-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900">
                  Upgrade existing items
                </h2>
                <p className="mt-1 text-sm text-[#6B7280]">
                  Items $500+ with cached upgrade options. Use Upgrade to see replacements.
                </p>
              </div>

              {tier1Sorted.length === 0 ? (
                <p className="px-5 py-8 text-sm text-[#6B7280] md:px-6">No major items ($500+) in this room.</p>
              ) : (
                <div>
                  {tier1Sorted.map((item, idx) => {
                    const lk = lockKeyForItem(item);
                    const locked = lockedKeys.includes(lk);
                    const rowKey = lk;
                    const showUpgradeFlow = isUpgradeCandidate(item) && item.unit_cost >= 500;
                    const cacheHas =
                      showUpgradeFlow &&
                      (cachedDescs.has(norm(item.description)) ||
                        cachedDescs.has(norm(item.pre_upgrade_item?.description ?? "")));
                    const showAccordion = showUpgradeFlow && cacheHas;
                    const upgraded = item.source === "upgrade" && !!item.pre_upgrade_item;
                    const pre = item.pre_upgrade_item;
                    const isOpen = openUpgradeKey === rowKey;
                    const rowBg = locked
                      ? "bg-blue-50/40"
                      : upgraded
                        ? "bg-emerald-50/30"
                        : "bg-white";

                    return (
                      <div
                        key={`${generateItemId(item)}-${idx}`}
                        className={`relative border-b border-gray-100 transition-colors duration-300 last:border-b-0 ${rowBg}`}
                      >
                        <button
                          type="button"
                          disabled={locked || isSaving}
                          onClick={() => void handleRemoveItemRow(item)}
                          className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full border border-gray-300 text-lg leading-none text-gray-400 transition hover:border-red-400 hover:text-red-500 disabled:opacity-30"
                          aria-label="Remove line from claim"
                        >
                          ×
                        </button>
                        <div className="flex min-h-[72px] flex-col gap-3 px-4 py-4 pr-12 md:flex-row md:items-center md:justify-between md:px-6 md:pr-14">
                          <div className="min-w-0 flex-1">
                            {upgraded && pre ? (
                              <>
                                <p className="text-[17px] text-[#6B7280] line-through [overflow-wrap:anywhere]">
                                  {pre.description}{" "}
                                  <span className="font-semibold tabular-nums">{formatCurrency(pre.unit_cost)}</span>
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <p className="text-[17px] font-bold text-gray-900 [overflow-wrap:anywhere]">{item.description}</p>
                                  <SourceTag source={item.source} />
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-3">
                                  <span className="text-[17px] font-bold tabular-nums text-[#2563EB]">
                                    {formatCurrency(item.unit_cost)} ✓
                                  </span>
                                  <span className="text-[#6B7280]">·</span>
                                  <QtyAdjuster
                                    qty={item.qty}
                                    disabled={locked || isSaving}
                                    onChange={(q) => void updateItemQty(item, q)}
                                  />
                                  {qtyFlashKey === lk ? (
                                    <span className="text-xs font-medium text-[#16A34A] transition-opacity duration-300">
                                      Qty updated
                                    </span>
                                  ) : null}
                                  <span className="text-[#6B7280]">·</span>
                                  {editingAgeKey === lk ? (
                                    <span className="inline-flex flex-wrap items-center gap-2">
                                      <input
                                        type="number"
                                        min={0}
                                        max={120}
                                        className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
                                        value={ageDraft}
                                        onChange={(e) => setAgeDraft(e.target.value)}
                                      />
                                      <span className="text-sm text-[#6B7280]">years</span>
                                      <button
                                        type="button"
                                        className="text-sm font-semibold text-[#2563EB]"
                                        onClick={() =>
                                          void updateItemAge(
                                            item,
                                            Math.min(120, Math.max(0, parseInt(ageDraft, 10) || 0))
                                          )
                                        }
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        className="text-sm text-[#6B7280]"
                                        onClick={() => setEditingAgeKey(null)}
                                      >
                                        Cancel
                                      </button>
                                    </span>
                                  ) : (
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          if (!locked && !isSaving) {
                                            setEditingAgeKey(lk);
                                            setAgeDraft(String(item.age_years ?? 0));
                                          }
                                        }
                                      }}
                                      onClick={() => {
                                        if (locked || isSaving) return;
                                        setEditingAgeKey(lk);
                                        setAgeDraft(String(item.age_years ?? 0));
                                      }}
                                      className={`cursor-pointer text-base font-medium text-gray-900 underline decoration-[#2563EB] decoration-2 underline-offset-2 ${locked || isSaving ? "opacity-40" : ""}`}
                                    >
                                      {displayAgeYears(item) < 1
                                        ? "New / < 1 year"
                                        : `${displayAgeYears(item)} years`}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-sm font-bold tabular-nums text-[#16A34A]">
                                  +{formatCurrency((item.unit_cost - pre.unit_cost) * item.qty)} added
                                </p>
                                <div className="mt-2 flex flex-wrap gap-4">
                                  <button
                                    type="button"
                                    disabled={locked || isSaving}
                                    onClick={() =>
                                      isOpen ? setOpenUpgradeKey(null) : setOpenUpgradeKey(rowKey)
                                    }
                                    className="text-sm font-medium text-[#2563EB] underline decoration-[#2563EB]/30 underline-offset-2 transition-colors hover:decoration-[#2563EB] disabled:opacity-40"
                                  >
                                    {isOpen ? "✕ Close" : "Change"}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={locked || isSaving}
                                    onClick={() => void handleRevert(item)}
                                    className="text-sm font-medium text-[#6B7280] underline decoration-gray-300 underline-offset-2 disabled:opacity-40"
                                  >
                                    Revert
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                                  <p className="text-[17px] font-semibold text-gray-900 [overflow-wrap:anywhere]">
                                    {item.description}
                                  </p>
                                  {item.brand ? (
                                    <span className="text-sm font-medium text-[#6B7280]">{item.brand}</span>
                                  ) : null}
                                  <SourceTag source={item.source} />
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-3">
                                  <span className="text-[17px] font-bold tabular-nums text-gray-900">
                                    {formatCurrency(item.unit_cost)}
                                  </span>
                                  <span className="text-[#6B7280]">·</span>
                                  <QtyAdjuster
                                    qty={item.qty}
                                    disabled={locked || isSaving}
                                    onChange={(q) => void updateItemQty(item, q)}
                                  />
                                  {qtyFlashKey === lk ? (
                                    <span className="text-xs font-medium text-[#16A34A] transition-opacity duration-300">
                                      Qty updated
                                    </span>
                                  ) : null}
                                  <span className="text-[#6B7280]">·</span>
                                  {editingAgeKey === lk ? (
                                    <span className="inline-flex flex-wrap items-center gap-2">
                                      <input
                                        type="number"
                                        min={0}
                                        max={120}
                                        className="w-14 rounded border border-gray-300 px-2 py-1 text-sm"
                                        value={ageDraft}
                                        onChange={(e) => setAgeDraft(e.target.value)}
                                      />
                                      <span className="text-sm text-[#6B7280]">years</span>
                                      <button
                                        type="button"
                                        className="text-sm font-semibold text-[#2563EB]"
                                        onClick={() =>
                                          void updateItemAge(
                                            item,
                                            Math.min(120, Math.max(0, parseInt(ageDraft, 10) || 0))
                                          )
                                        }
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        className="text-sm text-[#6B7280]"
                                        onClick={() => setEditingAgeKey(null)}
                                      >
                                        Cancel
                                      </button>
                                    </span>
                                  ) : (
                                    <span
                                      role="button"
                                      tabIndex={0}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          if (!locked && !isSaving) {
                                            setEditingAgeKey(lk);
                                            setAgeDraft(String(item.age_years ?? 0));
                                          }
                                        }
                                      }}
                                      onClick={() => {
                                        if (locked || isSaving) return;
                                        setEditingAgeKey(lk);
                                        setAgeDraft(String(item.age_years ?? 0));
                                      }}
                                      className={`cursor-pointer text-base font-medium text-gray-900 underline decoration-[#2563EB] decoration-2 underline-offset-2 ${locked || isSaving ? "opacity-40" : ""}`}
                                    >
                                      {displayAgeYears(item) < 1
                                        ? "New / < 1 year"
                                        : `${displayAgeYears(item)} years`}
                                    </span>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                            {showAccordion && !upgraded ? (
                              <>
                                <button
                                  type="button"
                                  disabled={locked || isSaving}
                                  onClick={() => setOpenUpgradeKey(null)}
                                  className="inline-flex h-10 items-center justify-center rounded-lg border-2 border-gray-300 bg-white px-3 text-sm font-semibold text-gray-700 transition-all duration-200 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-40"
                                >
                                  Keep ✓
                                </button>
                                {isOpen ? (
                                  <button
                                    type="button"
                                    disabled={locked || isSaving}
                                    onClick={() => setOpenUpgradeKey(null)}
                                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border-2 border-gray-400 bg-white px-3 text-sm font-semibold text-gray-700 transition-all duration-200 hover:bg-gray-50 disabled:opacity-40"
                                  >
                                    {isSaving ? <SmallSpinner /> : null}
                                    ✕ Close
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    disabled={locked || isSaving}
                                    onClick={() => setOpenUpgradeKey(rowKey)}
                                    className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-lg border-2 border-[#2563EB] bg-white px-3 text-sm font-semibold text-[#2563EB] transition-all duration-200 hover:bg-blue-50 disabled:opacity-40"
                                  >
                                    <span aria-hidden>↑</span> Upgrade
                                  </button>
                                )}
                              </>
                            ) : null}
                            {item.unit_cost >= 500 ? <LockButton locked={locked} onToggle={() => toggleLock(lk)} /> : null}
                          </div>
                        </div>

                        {showAccordion ? (
                          <div
                            className={`overflow-hidden transition-[max-height] duration-300 ease-in-out ${
                              isOpen ? "max-h-[2200px]" : "max-h-0"
                            }`}
                          >
                            <div className="border-t border-gray-100 bg-gray-50/90 px-4 py-6 md:px-6">
                              <UpgradeOptionsPanel
                                key={`${item.description}-${item.unit_cost}-${idx}`}
                                item={item}
                                locked={locked}
                                cacheHas={cacheHas}
                                isPanelOpen={isOpen}
                                onClose={() => setOpenUpgradeKey(null)}
                                onApply={async (opt) => {
                                  if (upgraded && item.pre_upgrade_item) await handleChangeUpgrade(item, opt);
                                  else await handleApplyUpgrade(item, opt);
                                }}
                                onApplied={() => setOpenUpgradeKey(null)}
                                onRefreshNotice={(msg) => setToast(msg)}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}

                </div>
              )}
            </section>

            <section className="mt-12">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900">
                Add items to {displayRoomTitle(roomName).toUpperCase()}
              </h2>
              <p className="mt-1 text-sm text-[#6B7280]">
                Focused addition sets — choose a tier (Essential through Full or Ultimate), then add checked lines to
                your claim.
              </p>

              <div className="mt-8 space-y-8">
                {focusedBundles.length === 0 ? (
                  <p className="text-sm text-[#6B7280]">No focused addition packages for this room yet.</p>
                ) : (
                  focusedBundles.map((b) => (
                    <FocusedAdditionCard
                      key={b.bundle_code}
                      bundle={b}
                      roomName={roomName}
                      existingItems={session?.claim_items ?? []}
                      sessionId={sessionId}
                      disabled={isSaving}
                      onAdd={(lines) => void handleFocusedBundleAdd(lines)}
                    />
                  ))
                )}
              </div>

              {isAdminUser && adminOnlyBundles.length > 0 ? (
                <div className="mt-10 rounded-2xl border border-dashed border-purple-200 bg-purple-50/40 p-5">
                  <p className="text-xs font-bold uppercase tracking-wide text-purple-900">Admin · full letter-tier packages</p>
                  <p className="mt-1 text-sm text-purple-800">
                    Hidden from clients. Open the bundle browser to preview large packages (over $30k).
                  </p>
                  <Link
                    href={`/review/bundles/${roomSlug}`}
                    className="mt-3 inline-flex min-h-[48px] items-center rounded-xl bg-purple-700 px-4 text-sm font-bold text-white hover:bg-purple-800"
                  >
                    Open bundle browser →
                  </Link>
                  <ul className="mt-3 max-h-40 list-inside list-disc overflow-y-auto text-xs text-purple-900">
                    {adminOnlyBundles.slice(0, 40).map((b) => (
                      <li key={b.bundle_code}>
                        {b.bundle_code} — {b.name} ({formatCurrency(b.total_value)})
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-bold uppercase tracking-wide text-gray-900">💬 Request a specific item</p>
                <p className="mt-2 text-sm text-[#6B7280]">
                  Don&apos;t see something? Tell us and we&apos;ll add it.
                </p>
                {requestStatus === "success" ? (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-[#16A34A]">Request sent — thank you.</p>
                    <button
                      type="button"
                      className="mt-3 text-sm font-semibold text-[#2563EB] underline"
                      onClick={() => setRequestStatus("idle")}
                    >
                      Send another
                    </button>
                  </div>
                ) : (
                  <>
                    <textarea
                      className="mt-4 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400"
                      rows={3}
                      placeholder="Description"
                      value={requestText}
                      onChange={(e) => {
                        setRequestText(e.target.value);
                        if (requestStatus === "error") setRequestStatus("idle");
                      }}
                    />
                    {requestStatus === "error" ? (
                      <p className="mt-2 text-xs text-red-600">Could not send — try again.</p>
                    ) : null}
                    <button
                      type="button"
                      disabled={!requestText.trim() || requestStatus === "loading"}
                      onClick={() => void sendSpecificItemRequest()}
                      className="mt-4 rounded-lg bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
                    >
                      {requestStatus === "loading" ? "Sending…" : "Send Request"}
                    </button>
                  </>
                )}
              </div>
            </section>

            <section className="mt-12 rounded-2xl border border-gray-100 bg-white shadow-sm">
              {tier2Sorted.length === 0 ? (
                <div className="px-5 py-6 text-sm text-[#6B7280] md:px-6">No household items under $500 in this room.</div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setHouseholdSectionOpen((o) => !o)}
                    className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 text-left md:px-6"
                  >
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-900">
                      HOUSEHOLD ITEMS ({tier2Sorted.length} items · {formatCurrency(miscOriginalTotal)})
                      <span className="ml-2 tabular-nums text-gray-500">
                        {householdSectionOpen ? "▼" : "▶"}
                      </span>
                    </span>
                    <span className="text-sm tabular-nums text-[#6B7280]">{formatCurrency(miscOriginalTotal)}</span>
                  </button>
                  {householdSectionOpen ? (
                    <div className="space-y-6 px-5 py-6 md:px-6">
                      <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white">
                        {tier2Sorted.map((item, idx) => (
                          <li
                            key={`hh-${generateItemId(item)}-${idx}`}
                            className="flex flex-wrap items-center gap-2 px-4 py-2.5 text-sm"
                          >
                            <span className="min-w-0 flex-1 font-medium text-gray-900 [overflow-wrap:anywhere]">
                              {item.description}
                            </span>
                            <span className="shrink-0 tabular-nums text-[#6B7280]">
                              {formatCurrency(item.unit_cost)} × {item.qty} ={" "}
                              {formatCurrency(item.unit_cost * item.qty)}
                            </span>
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => void handleRemoveItemRow(item)}
                              className="shrink-0 rounded border border-gray-300 px-2 py-0.5 text-xs text-gray-600 hover:border-red-400 hover:text-red-600 disabled:opacity-40"
                              aria-label="Remove line"
                            >
                              ×
                            </button>
                          </li>
                        ))}
                      </ul>

                      <div>
                        <p className="text-sm font-semibold text-gray-800">How many of each did you have?</p>
                        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                          <button
                            type="button"
                            onClick={() => {
                              setHouseholdCustomOpen(false);
                              setHouseholdPendingMult(1);
                            }}
                            className={`min-h-[48px] rounded-xl border px-3 py-3 text-left text-sm font-semibold ${
                              householdPendingMult === 1 && !householdCustomOpen
                                ? "border-[#2563EB] bg-blue-50"
                                : "border-gray-200 bg-white"
                            }`}
                          >
                            Same
                            {householdPendingMult === 1 && !householdCustomOpen ? (
                              <span className="mt-1 block text-xs font-normal text-[#16A34A]">✓</span>
                            ) : (
                              <span className="mt-1 block text-xs font-normal text-[#6B7280] tabular-nums">
                                {formatCurrency(householdButtonDeltas.same)}
                              </span>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setHouseholdCustomOpen(false);
                              setHouseholdPendingMult(2);
                            }}
                            className={`min-h-[48px] rounded-xl border px-3 py-3 text-left text-sm font-semibold ${
                              householdPendingMult === 2 && !householdCustomOpen
                                ? "border-[#2563EB] bg-blue-50"
                                : "border-gray-200 bg-white"
                            }`}
                          >
                            ×2
                            <span className="mt-1 block text-xs font-normal text-[#16A34A] tabular-nums">
                              +{formatCurrency(miscOriginalTotal)}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setHouseholdCustomOpen(false);
                              setHouseholdPendingMult(3);
                            }}
                            className={`min-h-[48px] rounded-xl border px-3 py-3 text-left text-sm font-semibold ${
                              householdPendingMult === 3 && !householdCustomOpen
                                ? "border-[#2563EB] bg-blue-50"
                                : "border-gray-200 bg-white"
                            }`}
                          >
                            ×3
                            <span className="mt-1 block text-xs font-normal text-[#16A34A] tabular-nums">
                              +{formatCurrency(miscOriginalTotal * 2)}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setHouseholdCustomOpen(true);
                              const m = householdCustomMult < 4 ? 4 : householdCustomMult;
                              setHouseholdCustomMult(m);
                              setHouseholdPendingMult(m);
                            }}
                            className={`min-h-[48px] rounded-xl border px-3 py-3 text-left text-sm font-semibold ${
                              householdCustomOpen ? "border-[#2563EB] bg-blue-50" : "border-gray-200 bg-white"
                            }`}
                          >
                            More ▼
                            <span className="mt-1 block text-xs font-normal text-[#16A34A] tabular-nums">
                              +
                              {formatCurrency(
                                Math.max(0, householdButtonDeltas.custom - householdButtonDeltas.same)
                              )}
                            </span>
                          </button>
                        </div>
                        {householdCustomOpen ? (
                          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
                            <label className="text-xs font-medium text-gray-700">Multiplier 3× – 10×</label>
                            <input
                              type="range"
                              min={3}
                              max={10}
                              step={1}
                              value={householdCustomMult}
                              onChange={(e) => {
                                const v = Number(e.target.value);
                                setHouseholdCustomMult(v);
                                setHouseholdPendingMult(v);
                              }}
                              className="mt-2 h-2 w-full accent-[#2563EB]"
                            />
                            <p className="mt-2 text-sm tabular-nums text-gray-800">
                              {householdCustomMult}× · add{" "}
                              <span className="font-semibold text-[#16A34A]">
                                +
                                {formatCurrency(
                                  Math.max(0, householdMultDelta(householdCustomMult) - householdButtonDeltas.same)
                                )}
                              </span>
                            </p>
                          </div>
                        ) : null}
                      </div>

                      {householdPendingMult != null ? (
                        <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
                          {householdPreviewTotalDelta <= 0.005 ? (
                            <p className="text-[#6B7280]">No dollar change at this level.</p>
                          ) : (
                            <>
                              <p className="font-medium text-gray-900">
                                Add{" "}
                                <span className="font-semibold text-[#16A34A] tabular-nums">
                                  {formatCurrency(householdPreviewTotalDelta)}
                                </span>{" "}
                                to your claim for more household items?
                              </p>
                              <p className="mt-2 text-xs text-[#6B7280]">
                                Updates {tier2Sorted.length} lines (ceiling rules may adjust individual rows).
                              </p>
                              <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-[#6B7280]">
                                {householdPreviewLines
                                  .filter((l) => Math.abs(l.delta) > 0.01)
                                  .slice(0, 16)
                                  .map((l, j) => (
                                    <li key={`${l.item.description}-${j}`} className="[overflow-wrap:anywhere]">
                                      <span className="font-medium text-gray-800">{l.item.description}</span>{" "}
                                      {formatCurrency(l.before)} → {formatCurrency(l.after)} (
                                      <span className="text-[#16A34A]">+{formatCurrency(l.delta)}</span>)
                                    </li>
                                  ))}
                              </ul>
                              <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() =>
                                    householdPendingMult != null &&
                                    void applyHouseholdMultiplier(householdPendingMult)
                                  }
                                  className="min-h-[48px] flex-1 rounded-xl bg-[#2563EB] py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
                                >
                                  Confirm +{formatCurrency(householdPreviewTotalDelta)}
                                </button>
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => setHouseholdPendingMult(null)}
                                  className="min-h-[48px] flex-1 rounded-xl border border-gray-300 bg-white py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                                >
                                  Cancel
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ) : null}

                      {consumableBundles.length > 0 ? (
                        <div className="mt-8 border-t border-gray-100 pt-6">
                          <p className="text-xs font-bold uppercase tracking-wide text-gray-900">
                            Restock & consumable packs
                          </p>
                          <p className="mt-1 text-sm text-[#6B7280]">
                            One-tap add common replenishment lines for this room.
                          </p>
                          <div className="mt-4 space-y-3">
                            {consumableBundles.map((b) => (
                              <div
                                key={b.bundle_code}
                                className="flex flex-col gap-2 rounded-xl border border-gray-100 bg-gray-50/80 p-4 sm:flex-row sm:items-center sm:justify-between"
                              >
                                <div className="min-w-0">
                                  <p className="font-semibold text-gray-900">{b.name}</p>
                                  <p className="text-xs text-[#6B7280]">{b.items.length} lines · {formatCurrency(b.total_value)}</p>
                                </div>
                                <button
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => void handleConsumableBundleAdd(b)}
                                  className="min-h-[48px] shrink-0 rounded-xl bg-[#16A34A] px-4 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-40"
                                >
                                  Add pack
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </section>

            <p className="mt-10 text-center text-sm text-[#6B7280]">
              Art and decorative items are managed separately in the Art Collection section.
            </p>
          </main>
        </>
      )}

      {showRoomChrome ? (
        <footer className="fixed bottom-0 inset-x-0 z-30 min-h-[52px] border-t border-gray-200 bg-white py-2 shadow-lg md:py-0">
          <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-2 px-4 md:min-h-[56px] md:flex-nowrap md:gap-4 md:px-8">
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                title="Undo"
                aria-label="Undo"
                disabled={!undoAvail || isSaving}
                onClick={() => void undoRoom()}
                className="flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-lg border border-gray-200 text-lg leading-none text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
              >
                ⟲
              </button>
              <button
                type="button"
                title="Redo"
                aria-label="Redo"
                disabled={!redoAvail || isSaving}
                onClick={() => void redoRoom()}
                className="flex min-h-[48px] min-w-[48px] shrink-0 items-center justify-center rounded-lg border border-gray-200 text-lg leading-none text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
              >
                ⟳
              </button>
            </div>
            <div className="hidden min-w-0 flex-[1_1_200px] flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums text-[#6B7280] md:flex md:text-sm">
              <span>
                Original: <span className="font-medium text-gray-900">{formatCurrency(originalRoomValue)}</span>
              </span>
              <span>
                Upgrades:{" "}
                <span className="font-semibold text-[#16A34A]">+{formatCurrency(upgradeDeltaSub)}</span>
              </span>
              <span>
                Added: <span className="font-semibold text-[#16A34A]">+{formatCurrency(addedSub)}</span>
              </span>
              <span>
                Total:{" "}
                <span className="font-bold text-[#2563EB]">{formatCurrency(roomTotal)}</span>
                <span className="font-normal text-[#6B7280]"> / {formatCurrency(roomTarget)} goal</span>
              </span>
            </div>
            <div className="flex min-w-0 flex-1 basis-[45%] items-center md:hidden">
              <span className="truncate text-xs tabular-nums">
                <span className="text-[#6B7280]">Total </span>
                <span className="font-bold text-[#2563EB]">{formatCurrency(roomTotal)}</span>
                <span className="text-[#6B7280]"> / {formatCurrency(roomTarget)}</span>
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const q = guided ? "?guided=true" : "";
                  if (navPrev) router.push(`/review/${navPrev.slug}${q}`);
                  else router.push("/review");
                }}
                className="inline-flex min-h-[48px] items-center rounded-lg border border-gray-200 px-3 text-xs font-medium text-gray-800 transition-colors hover:bg-gray-50 md:text-sm"
              >
                {navPrev ? `← ${navPrev.name}` : "← All rooms"}
              </button>
              {navNext ? (
                <button
                  type="button"
                  onClick={() => {
                    const q = guided ? "?guided=true" : "";
                    router.push(`/review/${navNext.slug}${q}`);
                  }}
                  className="inline-flex min-h-[48px] items-center rounded-lg bg-[#2563EB] px-4 text-xs font-bold text-white transition-colors hover:bg-blue-700 md:text-sm"
                >
                  {navNext.name} →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => router.push("/review")}
                  className="inline-flex min-h-[48px] items-center rounded-lg bg-gray-200 px-4 text-xs font-medium text-gray-800 md:text-sm"
                >
                  Done
                </button>
              )}
            </div>
          </div>
        </footer>
      ) : null}

      {showResetConfirm ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true">
            <p className="text-base font-semibold text-gray-900">Reset this room?</p>
            <p className="mt-2 text-sm text-[#6B7280]">
              Remove all upgrades and additions in {roomName}? Original PDF lines will be restored.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
                onClick={() => setShowResetConfirm(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                onClick={() => void confirmResetRoom()}
              >
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Guided tour — character + bubbles */}
      {guided && (
        <>
          <div
            className={`fixed bottom-48 right-4 z-[48] origin-bottom-right transition-transform duration-500 ease-out md:bottom-40 ${
              guidedEnter ? "translate-x-0" : "translate-x-[130%]"
            }`}
          >
            <div className="scale-100 drop-shadow-md sm:scale-[1.25]">
              <AniGuide
                expression={showGuidedComplete ? "happy" : guidedUpgradeDelta != null ? "excited" : "excited"}
                size={80}
              />
            </div>
          </div>

          {guidedLoadBubble && !guidedLoadDismissed && (
            <div className="fixed bottom-48 right-4 z-[49] flex w-[min(calc(100vw-2rem),320px)] flex-col items-stretch gap-3 sm:bottom-36 sm:right-[5.5rem] sm:max-w-[300px]">
              <SpeechBubble
                direction="right"
                visible={guidedLoadVisible}
                text={
                  upgradeCandidates.length > 0
                    ? `This is the ${roomName}!\nYou have ${upgradeCandidates.length} upgradeable ${upgradeCandidates.length === 1 ? "item" : "items"} worth ${formatCurrency(upgradeSubtotal)}.\nLet's see what we can upgrade! ✨`
                    : `This is the ${roomName}!\nThere are no lines here that need the upgrade assistant right now — art and small decor belong in Art Collection.\nCheck suggested additions below if any! ✨`
                }
              />
              <button
                type="button"
                onClick={() => {
                  setGuidedLoadDismissed(true);
                  setGuidedLoadVisible(false);
                }}
                className="min-h-[48px] rounded-xl bg-[#2563EB] px-4 text-base font-bold text-white shadow-md transition hover:bg-blue-700"
              >
                OK →
              </button>
            </div>
          )}

          {guidedUpgradeDelta != null && guidedUpgradeFromTo && (
            <div className="fixed bottom-48 right-4 z-[49] flex w-[min(calc(100vw-2rem),320px)] flex-col items-stretch gap-3 sm:bottom-36 sm:right-[5.5rem] sm:max-w-[300px]">
              <SpeechBubble
                direction="right"
                visible
                text={`Nice! You just upgraded from ${formatCurrency(guidedUpgradeFromTo.from)} → ${formatCurrency(guidedUpgradeFromTo.to)}.\nThat's added to your claim!`}
              />
              <p className="text-center text-3xl font-black text-green-600 tabular-nums drop-shadow-sm">
                +<CountUpMoney value={guidedUpgradeDelta} />
              </p>
              <button
                type="button"
                onClick={() => {
                  setGuidedUpgradeDelta(null);
                  setGuidedUpgradeFromTo(null);
                }}
                className="min-h-[48px] rounded-xl bg-[#16A34A] px-4 text-base font-bold text-white shadow-md transition hover:bg-green-700"
              >
                Keep going →
              </button>
            </div>
          )}

          {showGuidedComplete && (
            <div className="fixed bottom-48 right-4 z-[49] flex w-[min(calc(100vw-2rem),340px)] flex-col items-stretch gap-3 rounded-2xl border border-gray-200 bg-white/95 p-4 shadow-xl backdrop-blur-sm sm:bottom-32 sm:right-[5.5rem]">
              {(() => {
                const beforeGuide =
                  baselineOriginalRoomRef.current ??
                  items
                    .filter(isUpgradeCandidate)
                    .reduce((s, i) => {
                      const u = i.pre_upgrade_item ? i.pre_upgrade_item.unit_cost : i.unit_cost;
                      return s + i.qty * u;
                    }, 0);
                return (
                  <>
              <SpeechBubble
                direction="right"
                visible
                text={`Room done! 🎉\n${roomName}: ${formatCurrency(beforeGuide)} → ${formatCurrency(roomTotal)}`}
              />
              {(() => {
                const beforeR = beforeGuide;
                const added = Math.max(0, roomTotal - beforeR);
                const pct = beforeR > 0 ? Math.round(((roomTotal - beforeR) / beforeR) * 100) : 100;
                return (
                  <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-base">
                    <div className="flex justify-between tabular-nums">
                      <span className="text-gray-600">Before</span>
                      <span className="font-semibold">{formatCurrency(beforeR)}</span>
                    </div>
                    <div className="mt-1 flex justify-between tabular-nums">
                      <span className="text-gray-600">After</span>
                      <span className="font-semibold">{formatCurrency(roomTotal)}</span>
                    </div>
                    <div className="mt-2 flex justify-between font-bold text-green-600 tabular-nums">
                      <span>Added</span>
                      <span>
                        +{formatCurrency(added)} ↑ {pct}%
                      </span>
                    </div>
                  </div>
                );
              })()}
              {navNext ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowGuidedComplete(false);
                    router.push(`/review/${navNext.slug}?guided=true`);
                  }}
                  className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#2563EB] px-4 text-center text-base font-bold text-white"
                >
                  Next: {navNext.name} →
                </button>
              ) : (
                <Link
                  href="/review"
                  onClick={() => setShowGuidedComplete(false)}
                  className="flex min-h-[48px] items-center justify-center rounded-xl bg-gray-800 px-4 text-center text-base font-bold text-white"
                >
                  Back to dashboard →
                </Link>
              )}
                  </>
                );
              })()}
            </div>
          )}
        </>
      )}

      {toast && (
        <div className="fixed left-1/2 top-20 z-40 max-w-[min(100vw-2rem,24rem)] -translate-x-1/2 rounded-xl bg-gray-900 px-5 py-3 text-center text-base text-white shadow-xl">
          {toast}
          <button type="button" className="ml-3 text-green-400" onClick={() => setToast(null)}>
            ✓
          </button>
        </div>
      )}
    </div>
  );
}
