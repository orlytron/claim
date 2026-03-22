"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import AniGuide from "../../components/AniGuide";
import SpeechBubble from "../../components/SpeechBubble";
import { dispatchUpgradeReward } from "../../components/UpgradeRewardToast";
import { BUNDLES_DATA, type BundleItem } from "../../lib/bundles-data";
import { CLAIM_GOAL_DEFAULT, DEFAULT_ROOM_TARGETS } from "../../lib/room-targets";
import { readRoomGoal, writeRoomGoal } from "../../lib/room-goals";
import { loadSession, saveSession, SessionData } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { getSingletonKey as bundleRoomSlotKey } from "../../lib/bundle-room-singleton-key";
import {
  computeItemAtSlider,
  computeNotches,
  type MiscLine,
} from "../../lib/misc-items-slider";
import { displayAgeYears, ORIGINAL_CLAIM_ITEMS } from "../../lib/original-claim-data";
import { ClaimItem } from "../../lib/types";
import { useClaimMode } from "../../lib/useClaimMode";
import { generateItemId, slugify, formatCurrency } from "../../lib/utils";
import { UpgradeOptionsPanel, type UpgradeOption } from "./UpgradeOptionsPanel";

export type { UpgradeOption };
import {
  SUGGESTED_ADDITIONS,
  suggestionAlreadyInClaim,
  type SuggestedAdditionRow,
} from "./suggested-additions";

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
  const searchParams = useSearchParams();
  const guided = searchParams.get("guided") === "true";
  const { sessionId, hydrated } = useClaimMode();

  const [session, setSession] = useState<SessionData | null>(null);
  const [roomName, setRoomName] = useState("");
  const [items, setItems] = useState<ClaimItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [allRooms, setAllRooms] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1000);
    return () => clearTimeout(t);
  }, [toast]);
  const [cachedDescs, setCachedDescs] = useState<Set<string>>(new Set());
  const [lockedKeys, setLockedKeys] = useState<string[]>([]);
  const [roomTarget, setRoomTarget] = useState(0);
  const [claimGoal, setClaimGoal] = useState(CLAIM_GOAL_DEFAULT);
  const [editTarget, setEditTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const [skippedSuggestions, setSkippedSuggestions] = useState<Set<string>>(new Set());
  const [sliderSnapIndex, setSliderSnapIndex] = useState(0);
  const [openUpgradeKey, setOpenUpgradeKey] = useState<string | null>(null);
  const [suggestExpand, setSuggestExpand] = useState(false);
  const [miscSectionOpen, setMiscSectionOpen] = useState(false);
  const [miscMultIndex, setMiscMultIndex] = useState(0);
  const [bundleBudgetValue, setBundleBudgetValue] = useState(0);
  const [bundleSectionOpen, setBundleSectionOpen] = useState(true);
  const [bundleChecks, setBundleChecks] = useState<boolean[]>([]);
  const [bundleAdding, setBundleAdding] = useState(false);
  const [bundleAddedFlash, setBundleAddedFlash] = useState(false);
  const [qtyFlashKey, setQtyFlashKey] = useState<string | null>(null);
  const [editingAgeKey, setEditingAgeKey] = useState<string | null>(null);
  const [ageDraft, setAgeDraft] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);

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

  const bundleBudgetRange = useMemo(() => {
    const vals = BUNDLES_DATA.filter((b) => b.room === roomName).map((b) => b.total_value);
    if (vals.length === 0) return { min: 17_000, max: 285_000 };
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [roomName]);

  useEffect(() => {
    setBundleBudgetValue(bundleBudgetRange.min);
    setMiscMultIndex(0);
    setMiscSectionOpen(false);
    setBundleSectionOpen(true);
  }, [roomName, bundleBudgetRange.min, bundleBudgetRange.max]);

  useEffect(() => {
    setLockedKeys(readLocked());
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void bootstrap();
  }, [roomSlug, hydrated, sessionId]);

  async function bootstrap() {
    setIsLoading(true);
    setItems([]);
    const sess = await loadSession(sessionId);
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
    setAllRooms(rooms);
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
  const miscLines: MiscLine[] = useMemo(
    () => tier2Sorted.map((i) => ({ description: i.description, qty: i.qty, unit_cost: i.unit_cost })),
    [tier2Sorted]
  );
  const miscNotches = useMemo(() => computeNotches(miscLines), [miscLines]);
  const miscMultiplier = miscNotches[Math.min(miscMultIndex, Math.max(0, miscNotches.length - 1))] ?? 1;
  const miscPreviewLines = useMemo(() => {
    return tier2Sorted.map((item) => {
      const next = computeItemAtSlider(item, miscMultiplier);
      const before = item.qty * item.unit_cost;
      const after = next.qty * next.unit_cost;
      return { item, next, before, after, delta: after - before };
    });
  }, [tier2Sorted, miscMultiplier]);
  const miscOriginalTotal = useMemo(
    () => tier2Sorted.reduce((s, i) => s + i.qty * i.unit_cost, 0),
    [tier2Sorted]
  );
  const miscPreviewTotal = useMemo(() => miscPreviewLines.reduce((s, l) => s + l.after, 0), [miscPreviewLines]);
  const miscNotchTotals = useMemo(() => {
    return miscNotches.map((m) =>
      tier2Sorted.reduce((s, i) => {
        const n = computeItemAtSlider(i, m);
        return s + n.qty * n.unit_cost;
      }, 0)
    );
  }, [tier2Sorted, miscNotches]);

  const upgradeCandidates = useMemo(() => items.filter(isUpgradeCandidate), [items]);

  const upgradeSubtotal = useMemo(
    () => upgradeCandidates.reduce((s, i) => s + i.qty * i.unit_cost, 0),
    [upgradeCandidates]
  );

  const missingSuggestions = useMemo(() => {
    const list = SUGGESTED_ADDITIONS[roomName] ?? [];
    return list.filter(
      (s) => !suggestionAlreadyInClaim(items, s.label) && !skippedSuggestions.has(s.id)
    );
  }, [roomName, items, skippedSuggestions]);

  const roomTotal = useMemo(() => items.reduce((s, i) => s + i.qty * i.unit_cost, 0), [items]);
  /** Original claim lines only (excludes bundle/art adds); uses pre-upgrade unit when upgraded */
  const originalRoomValue = useMemo(
    () =>
      items.reduce((s, i) => {
        if (i.source === "bundle" || i.source === "art") return s;
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
        .filter((i) => i.source === "bundle" || i.source === "art")
        .reduce((s, i) => s + i.qty * i.unit_cost, 0),
    [items]
  );

  const suggestionByCategory = useMemo(() => {
    const m = new Map<string, SuggestedAdditionRow[]>();
    for (const r of missingSuggestions) {
      const cat = r.category || "Other";
      m.set(cat, [...(m.get(cat) ?? []), r]);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [missingSuggestions]);

  const progressPct = roomTarget > 0 ? Math.min(100, Math.round((roomTotal / roomTarget) * 100)) : 0;
  const gapRemaining = Math.max(0, roomTarget - roomTotal);

  useEffect(() => {
    if (!guided || guidedCompleteLatchRef.current || progressPct < 100) return;
    guidedCompleteLatchRef.current = true;
    setShowGuidedComplete(true);
  }, [guided, progressPct]);

  const roomIdx = allRooms.indexOf(roomName);
  const prevRoom = roomIdx > 0 ? allRooms[roomIdx - 1] : null;
  const nextRoom = roomIdx < allRooms.length - 1 ? allRooms[roomIdx + 1] : null;

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

  function fireUpgradeReward(beforeItems: ClaimItem[], afterItems: ClaimItem[], lineDelta: number) {
    const before = claimTotals(beforeItems);
    const after = claimTotals(afterItems);
    dispatchUpgradeReward({
      delta: lineDelta,
      claimTotal: after.total,
      goalPctBefore: before.pct,
      goalPctAfter: after.pct,
    });
  }

  async function handleApplyUpgrade(item: ClaimItem, option: UpgradeOption) {
    if (!session?.claim_items || isItemLocked(item)) return;
    setIsSaving(true);
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
    setIsSaving(false);
    setToast(`Upgraded — ${option.title}`);
  }

  async function handleChangeUpgrade(item: ClaimItem, option: UpgradeOption) {
    if (!session?.claim_items || !item.pre_upgrade_item || isItemLocked(item)) return;
    setIsSaving(true);
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
    setIsSaving(false);
    setToast(`Changed upgrade — ${option.title}`);
  }

  async function handleRevert(item: ClaimItem) {
    if (!item.pre_upgrade_item || isItemLocked(item)) return;
    setIsSaving(true);
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
    setIsSaving(false);
    setToast("Reverted to original line");
  }

  async function handleAddSuggestion(row: SuggestedAdditionRow, tier: "mid" | "premium") {
    if (!session?.claim_items) return;
    const opt = tier === "mid" ? row.mid : row.premium;
    const line: ClaimItem = {
      room: roomName,
      description: opt.title,
      brand: opt.brand ?? "",
      model: "",
      qty: 1,
      age_years: 0,
      age_months: 0,
      condition: "New",
      unit_cost: opt.price,
      category: row.category,
      source: "bundle",
      vendor_url: opt.url,
    };
    const beforeClaim = session.claim_items;
    const nextRoom = [...items, line];
    const rest = beforeClaim.filter((i) => i.room !== roomName);
    const afterClaim = [...rest, ...nextRoom];
    const lineDelta = opt.price;
    await saveRoomItems(nextRoom);
    fireUpgradeReward(beforeClaim, afterClaim, lineDelta);
    setToast(`Added ${row.label}`);
  }

  const suggestionMidInClaim = useCallback(
    (row: SuggestedAdditionRow) => {
      const opt = row.mid;
      return items.some(
        (i) =>
          i.room === roomName &&
          i.source === "bundle" &&
          norm(i.description) === norm(opt.title) &&
          Math.abs(i.unit_cost - opt.price) < 0.01
      );
    },
    [items, roomName]
  );

  async function handleRemoveSuggestionMid(row: SuggestedAdditionRow) {
    if (!session?.claim_items) return;
    setIsSaving(true);
    const opt = row.mid;
    const nextRoomItems = items.filter(
      (i) =>
        !(
          i.room === roomName &&
          i.source === "bundle" &&
          norm(i.description) === norm(opt.title) &&
          Math.abs(i.unit_cost - opt.price) < 0.01
        )
    );
    await saveRoomItems(nextRoomItems);
    setIsSaving(false);
    setToast(`Removed ${row.label}`);
  }

  async function handleToggleSuggestionMid(row: SuggestedAdditionRow) {
    if (suggestionMidInClaim(row)) await handleRemoveSuggestionMid(row);
    else await handleAddSuggestion(row, "mid");
  }

  function saveTargetFromEdit() {
    const raw = parseInt(targetInput.replace(/\D/g, ""), 10);
    if (Number.isNaN(raw) || raw < 0) return;
    const v = roundRoomGoalSlider(raw);
    setRoomTarget(v);
    writeRoomGoal(sessionId, roomName, v);
    setEditTarget(false);
  }

  function applyRoomGoalFromSlider(v: number) {
    const rounded = roundRoomGoalSlider(v);
    setRoomTarget(rounded);
    writeRoomGoal(sessionId, roomName, rounded);
  }

  const closestBundle = useMemo(() => {
    if (!roomName) return null;
    const list = BUNDLES_DATA.filter((b) => b.room === roomName);
    if (list.length === 0) return null;
    const v =
      bundleBudgetValue > 0 ? bundleBudgetValue : (bundleBudgetRange.min + bundleBudgetRange.max) / 2;
    return list.reduce((best, b) =>
      Math.abs(b.total_value - v) <= Math.abs(best.total_value - v) ? b : best
    );
  }, [roomName, bundleBudgetValue, bundleBudgetRange.min, bundleBudgetRange.max]);

  useEffect(() => {
    if (closestBundle) {
      setBundleChecks(closestBundle.items.map(() => true));
    } else {
      setBundleChecks([]);
    }
    setBundleAddedFlash(false);
  }, [closestBundle?.bundle_code]);

  const minBundleDisplay = bundleBudgetRange.min;
  const maxBundleDisplay = bundleBudgetRange.max;

  const bundleSelectedTotal = useMemo(() => {
    if (!closestBundle) return 0;
    return closestBundle.items.reduce((s, bi, i) => (bundleChecks[i] ? s + bi.total : s), 0);
  }, [closestBundle, bundleChecks]);

  const bundleSelectedCount = useMemo(() => {
    if (!closestBundle) return 0;
    return bundleChecks.filter(Boolean).length;
  }, [closestBundle, bundleChecks]);

  const bundleUpgradeDeltaSelected = useMemo(() => {
    if (!closestBundle) return 0;
    let d = 0;
    closestBundle.items.forEach((bi, i) => {
      if (!bundleChecks[i]) return;
      const slot = bundleRoomSlotKey(bi.description);
      if (slot == null) return;
      const existing = items.find(
        (c) => c.room === roomName && bundleRoomSlotKey(c.description) === slot
      );
      if (!existing) return;
      const oldT = existing.qty * existing.unit_cost;
      const newT = bi.unit_cost * existing.qty;
      d += newT - oldT;
    });
    return d;
  }, [closestBundle, bundleChecks, items, roomName]);

  const bundleAdditionsSelected = useMemo(() => {
    if (!closestBundle) return 0;
    let d = 0;
    closestBundle.items.forEach((bi, i) => {
      if (!bundleChecks[i]) return;
      const slot = bundleRoomSlotKey(bi.description);
      const existing =
        slot != null
          ? items.find((c) => c.room === roomName && bundleRoomSlotKey(c.description) === slot)
          : undefined;
      if (existing) return;
      d += bi.total;
    });
    return d;
  }, [closestBundle, bundleChecks, items, roomName]);

  function findExistingForBundleSlot(bi: BundleItem, roomItems: ClaimItem[]): ClaimItem | undefined {
    const slot = bundleRoomSlotKey(bi.description);
    if (slot == null) return undefined;
    return roomItems.find((c) => c.room === roomName && bundleRoomSlotKey(c.description) === slot);
  }

  async function handleApplyPackage() {
    if (!closestBundle || !session?.claim_items) return;
    const beforeClaim = session.claim_items;
    const selectedIndices = closestBundle.items.map((_, i) => i).filter((i) => bundleChecks[i]);
    if (selectedIndices.length === 0) return;
    setBundleAdding(true);
    try {
      pushUndoSnapshot();
      let nextRoom = items.map((i) => ({ ...i }));
      let packageExtra = 0;

      for (const i of selectedIndices) {
        const bi = closestBundle.items[i];
        const existing = findExistingForBundleSlot(bi, nextRoom);
        if (existing) {
          const oldLine = existing.qty * existing.unit_cost;
          const newLine = bi.unit_cost * existing.qty;
          packageExtra += newLine - oldLine;
          const snap: ClaimItem["pre_upgrade_item"] = existing.pre_upgrade_item ?? {
            description: existing.description,
            brand: existing.brand,
            model: existing.model,
            unit_cost: existing.unit_cost,
            category: existing.category,
            source: existing.source ?? "original",
          };
          nextRoom = nextRoom.map((c) =>
            sameClaimLine(c, existing)
              ? {
                  ...c,
                  description: bi.description,
                  brand: bi.brand || c.brand,
                  model: c.model,
                  unit_cost: bi.unit_cost,
                  previous_unit_cost: existing.unit_cost,
                  pre_upgrade_item: snap,
                  source: "upgrade" as const,
                  age_years: 0,
                  age_months: 0,
                  condition: "New" as const,
                }
              : c
          );
        } else {
          packageExtra += bi.total;
          nextRoom.push({
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
          });
        }
      }

      const afterClaim = [...beforeClaim.filter((i) => i.room !== roomName), ...nextRoom];
      await persistRoomItemsSnapshot(nextRoom);
      fireUpgradeReward(beforeClaim, afterClaim, packageExtra);

      const selectedItems = selectedIndices.map((i) => closestBundle.items[i]);
      const { error: accErr } = await supabase.from("bundle_decisions").upsert(
        {
          bundle_code: closestBundle.bundle_code,
          room: closestBundle.room,
          bundle_name: closestBundle.name,
          action: "applied",
          items: selectedItems as BundleItem[],
          total_value: selectedItems.reduce((s, bi) => s + bi.total, 0),
          note: null,
        },
        { onConflict: "bundle_code" }
      );
      if (accErr) console.warn("bundle_decisions applied blocked:", accErr.message);

      setToast(`Package applied · +${formatCurrency(packageExtra)}`);
      setBundleAddedFlash(true);
      window.setTimeout(() => setBundleAddedFlash(false), 1200);
      setBundleSectionOpen(false);
    } finally {
      setBundleAdding(false);
    }
  }

  async function applyMiscSliderToAll() {
    if (!session?.claim_items || tier2Sorted.length === 0) return;
    const m = miscMultiplier;
    pushUndoSnapshot();
    const nextRoom = items.map((ci) => {
      const hit = tier2Sorted.find((t) => sameClaimLine(t, ci));
      if (!hit) return ci;
      const n = computeItemAtSlider(hit, m);
      return { ...ci, qty: n.qty, unit_cost: n.unit_cost };
    });
    await persistRoomItemsSnapshot(nextRoom);
    setToast("Misc items updated");
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-gray-500 text-base">
        <SmallSpinner />
        Loading…
      </div>
    );
  }

  const showRoomChrome =
    !!roomName && !isLoading && (items.length > 0 || missingSuggestions.length > 0);
  const visibleSuggestionCategories = suggestExpand ? suggestionByCategory : suggestionByCategory.slice(0, 3);
  const hasMoreSuggestionCategories = suggestionByCategory.length > 3;

  return (
    <div className="flex min-h-screen flex-col bg-white pb-24 md:pb-20">
      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-24">
          <SmallSpinner />
        </div>
      ) : !roomName || (!items.length && !missingSuggestions.length) ? (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-base text-[#6B7280]">
          No items for this room.
          <Link href="/review" className="mt-4 font-medium text-[#2563EB] hover:underline">
            ← All rooms
          </Link>
        </div>
      ) : (
        <>
          <header className="w-full bg-white">
            <div className="mx-auto w-full max-w-[1100px] px-8 py-6 transition-all duration-300">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Link href="/review" className="text-sm font-medium text-[#2563EB] transition-colors hover:underline md:text-base">
                  ← All Rooms
                </Link>
                <div className="flex items-center gap-2">
                  {isSaving && <SmallSpinner />}
                  {nextRoom ? (
                    <Link
                      href={`/review/${slugify(nextRoom)}${guided ? "?guided=true" : ""}`}
                      className="text-sm font-medium text-[#2563EB] transition-colors hover:underline md:text-base"
                    >
                      Next Room →
                    </Link>
                  ) : null}
                </div>
              </div>

              <h1 className="mt-6 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">{roomName}</h1>
              <div className="mt-3 h-px w-full bg-gray-200" />

              <dl className="mt-6 grid gap-3 text-sm md:grid-cols-2 md:gap-x-8 md:gap-y-2 md:text-base">
                <div className="flex justify-between gap-4 border-b border-gray-100 pb-2 md:border-0 md:pb-0">
                  <dt className="text-[#6B7280]">Original value</dt>
                  <dd className="font-medium tabular-nums text-gray-900">{formatCurrency(originalRoomValue)}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-gray-100 pb-2 md:border-0 md:pb-0">
                  <dt className="text-[#6B7280]">Current total</dt>
                  <dd className="font-medium tabular-nums text-gray-900">{formatCurrency(roomTotal)}</dd>
                </div>
                <div className="flex justify-between gap-4 border-b border-gray-100 pb-2 md:border-0 md:pb-0">
                  <dt className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[#6B7280]">
                    Room goal
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
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(true)}
                      className="text-xs font-medium text-[#2563EB] underline-offset-2 hover:underline"
                    >
                      Reset room to original
                    </button>
                  </dt>
                  <dd className="font-medium tabular-nums text-gray-900">{formatCurrency(roomTarget)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#6B7280]">Gap remaining</dt>
                  <dd className="font-semibold tabular-nums text-gray-900">{formatCurrency(gapRemaining)}</dd>
                </div>
              </dl>

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

              <div className="mt-8">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm text-[#6B7280]">
                  <span>
                    Room target: <span className="font-semibold text-gray-900">{formatCurrency(roomTarget)}</span>
                  </span>
                  <span className="tabular-nums">
                    {formatCurrency(0)} — {formatCurrency(ROOM_GOAL_SLIDER_MAX)}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={ROOM_GOAL_SLIDER_MAX}
                  step={ROOM_GOAL_SLIDER_STEP}
                  value={Math.min(ROOM_GOAL_SLIDER_MAX, roomTarget)}
                  onChange={(e) => applyRoomGoalFromSlider(Number(e.target.value))}
                  className="h-2 w-full accent-[#2563EB]"
                  aria-label="Room goal"
                />
              </div>
            </div>
          </header>

          <main className="mx-auto w-full max-w-[1100px] flex-1 px-8 py-6">
            <section className="rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300">
              <div className="border-b border-gray-100 px-5 py-5 md:px-6">
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900">Your room inventory</h2>
                <p className="mt-1 text-sm text-[#6B7280]">
                  All claim lines for this room. Use Upgrade on eligible items to see replacement options.
                </p>
              </div>

              {tier1Sorted.length === 0 && tier2Sorted.length === 0 ? (
                <p className="px-5 py-8 text-sm text-[#6B7280] md:px-6">No items in this room.</p>
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
                                    onClick={() => setOpenUpgradeKey(rowKey)}
                                    className="text-sm font-medium text-[#2563EB] underline decoration-[#2563EB]/30 underline-offset-2 transition-colors hover:decoration-[#2563EB] disabled:opacity-40"
                                  >
                                    Change
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
                                <button
                                  type="button"
                                  disabled={locked || isSaving}
                                  onClick={() => setOpenUpgradeKey(rowKey)}
                                  className="inline-flex h-10 items-center justify-center gap-1 rounded-lg border-2 border-[#2563EB] bg-white px-3 text-sm font-semibold text-[#2563EB] transition-all duration-200 hover:bg-blue-50 disabled:opacity-40"
                                >
                                  <span aria-hidden>↑</span> Upgrade
                                </button>
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
                                onApply={async (opt) => {
                                  if (upgraded && item.pre_upgrade_item) await handleChangeUpgrade(item, opt);
                                  else await handleApplyUpgrade(item, opt);
                                }}
                                onApplied={() => setOpenUpgradeKey(null)}
                                onRefreshNotice={(msg) => setToast(msg)}
                                onCatalogEmpty={() => setOpenUpgradeKey(null)}
                              />
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}

                  {tier2Sorted.length > 0 ? (
                    <div className="border-t-2 border-gray-200 bg-gray-50/50">
                      <button
                        type="button"
                        onClick={() => setMiscSectionOpen((o) => !o)}
                        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left md:px-6"
                      >
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-900">
                          MISCELLANEOUS ITEMS ({tier2Sorted.length} items · {formatCurrency(miscOriginalTotal)}){" "}
                          <span className="tabular-nums">{miscSectionOpen ? "▼" : "▶"}</span>
                        </span>
                      </button>
                      {miscSectionOpen ? (
                        <div className="space-y-6 border-t border-gray-200 px-4 pb-6 pt-4 md:px-6">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">Adjust all items</p>
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-[#6B7280]">
                              <span>1.0x</span>
                              <span className="font-semibold text-gray-900">{miscMultiplier.toFixed(2)}x</span>
                              <span>3.0x</span>
                            </div>
                            <input
                              type="range"
                              min={0}
                              max={Math.max(0, miscNotches.length - 1)}
                              step={1}
                              value={Math.min(miscMultIndex, Math.max(0, miscNotches.length - 1))}
                              onChange={(e) => setMiscMultIndex(Number(e.target.value))}
                              className="mt-1 h-2 w-full accent-[#2563EB]"
                              aria-label="Adjust miscellaneous items"
                            />
                            <div className="mt-2 flex justify-between text-[11px] tabular-nums text-[#6B7280]">
                              {miscNotchTotals.length > 0 ? (
                                <>
                                  <span>{formatCurrency(miscNotchTotals[0] ?? 0)}</span>
                                  {miscNotchTotals.length > 3 ? (
                                    <span>{formatCurrency(miscNotchTotals[Math.floor(miscNotchTotals.length / 2)] ?? 0)}</span>
                                  ) : null}
                                  {miscNotchTotals.length > 1 ? (
                                    <span>{formatCurrency(miscNotchTotals[miscNotchTotals.length - 1] ?? 0)} max</span>
                                  ) : null}
                                </>
                              ) : null}
                            </div>
                          </div>
                          <div className="rounded-xl border border-gray-200 bg-white p-4 text-sm">
                            <p className="tabular-nums text-gray-900">
                              {formatCurrency(miscOriginalTotal)} → {formatCurrency(miscPreviewTotal)}
                              {miscPreviewTotal - miscOriginalTotal !== 0 ? (
                                <span className="ml-2 font-semibold text-[#16A34A]">
                                  (+{formatCurrency(miscPreviewTotal - miscOriginalTotal)})
                                </span>
                              ) : null}
                            </p>
                            {miscPreviewLines.some(
                              (l) =>
                                l.item.qty !== l.next.qty ||
                                Math.abs(l.item.unit_cost - l.next.unit_cost) > 0.01
                            ) ? (
                              <ul className="mt-3 space-y-2 text-[13px] text-[#6B7280]">
                                {miscPreviewLines
                                  .filter(
                                    (l) =>
                                      l.item.qty !== l.next.qty ||
                                      Math.abs(l.item.unit_cost - l.next.unit_cost) > 0.01
                                  )
                                  .slice(0, 12)
                                  .map((l, j) => (
                                    <li key={`${l.item.description}-${j}`} className="[overflow-wrap:anywhere]">
                                      <span className="font-medium text-gray-800">{l.item.description}</span> ×{l.item.qty}{" "}
                                      {formatCurrency(l.item.unit_cost)} → ×{l.next.qty}{" "}
                                      {formatCurrency(l.next.unit_cost)} (+{formatCurrency(l.delta)})
                                    </li>
                                  ))}
                              </ul>
                            ) : (
                              <p className="mt-2 text-[13px] text-[#6B7280]">No changes at this level.</p>
                            )}
                            <button
                              type="button"
                              disabled={isSaving || tier2Sorted.length === 0}
                              onClick={() => void applyMiscSliderToAll()}
                              className="mt-4 w-full rounded-lg bg-[#2563EB] py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
                            >
                              Apply to All
                            </button>
                          </div>
                          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white">
                            {tier2Sorted.map((item, idx) => (
                              <li
                                key={`misc-${generateItemId(item)}-${idx}`}
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
                                  ✕
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )}
            </section>

            <section className="mt-12">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900">Add missing items</h2>
              <p className="mt-1 text-sm text-[#6B7280]">
                Items typically found in this room that aren&apos;t in your original claim
              </p>

              <div className="mt-8">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Common additions</h3>
                  {missingSuggestions.length === 0 ? (
                    <p className="mt-4 text-sm text-[#6B7280]">No suggestions for this room.</p>
                  ) : (
                    <div className="mt-4 space-y-8">
                      {visibleSuggestionCategories.map(([cat, rows]) => (
                        <div key={cat}>
                          <p className="text-xs font-bold uppercase tracking-wide text-[#6B7280]">{cat}</p>
                          <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-100 bg-white shadow-sm">
                            {rows.map((row) => {
                              const added = suggestionMidInClaim(row);
                              const opt = row.mid;
                              return (
                                <li
                                  key={row.id}
                                  className="flex min-h-[48px] flex-wrap items-center gap-2 px-4 py-2.5"
                                >
                                  <span className="min-w-0 flex-1 text-[15px] font-medium text-gray-900 [overflow-wrap:anywhere]">
                                    {opt.title}
                                  </span>
                                  <span className="shrink-0 text-sm text-[#6B7280]">{opt.brand ?? "—"}</span>
                                  <span className="shrink-0 text-[15px] font-bold tabular-nums text-gray-900">
                                    {formatCurrency(opt.price)}
                                  </span>
                                  <button
                                    type="button"
                                    disabled={isSaving}
                                    onClick={() => void handleToggleSuggestionMid(row)}
                                    className={`shrink-0 rounded-lg px-3 py-1 text-sm font-bold transition disabled:opacity-40 ${
                                      added
                                        ? "bg-[#16A34A] text-white"
                                        : "border-2 border-[#2563EB] bg-white text-[#2563EB] hover:bg-blue-50"
                                    }`}
                                    aria-label={added ? "Added" : "Add to claim"}
                                  >
                                    {added ? "✓ Added" : "+"}
                                  </button>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      ))}
                      {hasMoreSuggestionCategories ? (
                        <button
                          type="button"
                          onClick={() => setSuggestExpand((e) => !e)}
                          className="text-sm font-semibold text-[#2563EB] hover:underline"
                        >
                          {suggestExpand ? "Show fewer ▲" : "Show more ▼"}
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="mt-12 rounded-2xl border border-gray-100 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => setBundleSectionOpen((o) => !o)}
                className="flex w-full items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 text-left md:px-6"
              >
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900">Add by package</h2>
                  <p className="mt-1 text-sm text-[#6B7280]">
                    Pre-grouped items sized to fill your room budget
                  </p>
                </div>
                <span className="text-gray-400">{bundleSectionOpen ? "▼" : "▶"}</span>
              </button>
              {bundleSectionOpen ? (
                <div className="px-5 py-6 md:px-6">
                  {BUNDLES_DATA.filter((b) => b.room === roomName).length === 0 ? (
                    <p className="text-sm text-[#6B7280]">No bundles defined for this room.</p>
                  ) : (
                    <div className="space-y-6">
                      <div>
                        <p className="text-center text-xs text-[#6B7280]">← drag to explore →</p>
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs tabular-nums text-[#6B7280] sm:text-sm">
                          <span className="shrink-0 font-medium">{formatCurrency(minBundleDisplay)}</span>
                          <input
                            type="range"
                            min={minBundleDisplay}
                            max={maxBundleDisplay}
                            step={1000}
                            value={Math.min(maxBundleDisplay, Math.max(minBundleDisplay, bundleBudgetValue))}
                            onChange={(e) => setBundleBudgetValue(Number(e.target.value))}
                            className="h-2 min-w-0 flex-1 accent-[#2563EB]"
                            aria-label="Bundle budget explorer"
                          />
                          <span className="shrink-0 font-medium">{formatCurrency(maxBundleDisplay)}</span>
                        </div>
                        {closestBundle ? (
                          <p className="mt-3 text-center text-sm font-semibold text-gray-900">
                            {closestBundle.name}{" "}
                            <span className="tabular-nums text-[#2563EB]">
                              {formatCurrency(closestBundle.total_value)}
                            </span>
                          </p>
                        ) : null}
                      </div>

                      {closestBundle && bundleChecks.length === closestBundle.items.length ? (
                        <div className="rounded-2xl border border-gray-200 bg-gray-50/50 p-4 md:p-6">
                          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-200 pb-4">
                            <h4 className="text-lg font-semibold text-gray-900 [overflow-wrap:anywhere]">
                              {closestBundle.name}
                            </h4>
                            <span className="text-lg font-bold tabular-nums text-gray-900">
                              {formatCurrency(closestBundle.total_value)}
                            </span>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
                            <div>
                              <p className="border-b border-gray-200 pb-2 text-xs font-bold uppercase tracking-wide text-[#6B7280]">
                                Upgrades existing
                              </p>
                              <ul className="mt-3 space-y-4">
                                {closestBundle.items.map((bi, i) => {
                                  const existing = findExistingForBundleSlot(bi, items);
                                  if (!existing) return null;
                                  const delta = bi.unit_cost * existing.qty - existing.unit_cost * existing.qty;
                                  return (
                                    <li key={`bl-${i}`} className="flex gap-2 text-sm">
                                      <input
                                        type="checkbox"
                                        className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 accent-[#2563EB]"
                                        checked={!!bundleChecks[i]}
                                        onChange={() =>
                                          setBundleChecks((prev) => {
                                            const next = [...prev];
                                            next[i] = !next[i];
                                            return next;
                                          })
                                        }
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-[13px] text-gray-500 line-through [overflow-wrap:anywhere]">
                                          {existing.brand ? `${existing.brand} ` : ""}
                                          {existing.description}{" "}
                                          <span className="tabular-nums font-semibold">
                                            {formatCurrency(existing.unit_cost * existing.qty)}
                                          </span>
                                        </p>
                                        <p className="mt-1 font-medium text-gray-900 [overflow-wrap:anywhere]">
                                          → {bi.brand ? `${bi.brand} ` : ""}
                                          {bi.description}
                                        </p>
                                        <p className="mt-1 tabular-nums text-gray-900">
                                          {formatCurrency(bi.unit_cost * existing.qty)}
                                          {delta > 0 ? (
                                            <span className="ml-2 font-semibold text-[#16A34A]">
                                              (+{formatCurrency(delta)})
                                            </span>
                                          ) : null}
                                        </p>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                            <div>
                              <p className="border-b border-gray-200 pb-2 text-xs font-bold uppercase tracking-wide text-[#6B7280]">
                                Adds new
                              </p>
                              <ul className="mt-3 space-y-4">
                                {closestBundle.items.map((bi, i) => {
                                  if (findExistingForBundleSlot(bi, items)) return null;
                                  return (
                                    <li key={`br-${i}`} className="flex gap-2 text-sm">
                                      <input
                                        type="checkbox"
                                        className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 accent-[#2563EB]"
                                        checked={!!bundleChecks[i]}
                                        onChange={() =>
                                          setBundleChecks((prev) => {
                                            const next = [...prev];
                                            next[i] = !next[i];
                                            return next;
                                          })
                                        }
                                      />
                                      <div className="min-w-0 flex-1">
                                        <p className="font-medium text-gray-900 [overflow-wrap:anywhere]">
                                          + {bi.brand ? `${bi.brand} ` : ""}
                                          {bi.description}
                                        </p>
                                        <p className="mt-1 font-bold tabular-nums text-gray-900">
                                          {formatCurrency(bi.total)}
                                        </p>
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          </div>

                          <div className="mt-6 border-t border-gray-200 pt-4 text-sm text-gray-800">
                            <p>
                              Upgrades:{" "}
                              <span className="font-semibold text-[#16A34A]">
                                +{formatCurrency(Math.max(0, bundleUpgradeDeltaSelected))}
                              </span>
                            </p>
                            <p className="mt-1">
                              Additions:{" "}
                              <span className="font-semibold text-[#16A34A]">
                                +{formatCurrency(bundleAdditionsSelected)}
                              </span>
                            </p>
                            <p className="mt-2 text-base font-bold text-gray-900">
                              Selected:{" "}
                              <span className="tabular-nums">{formatCurrency(bundleSelectedTotal)}</span> total
                            </p>
                          </div>

                          <button
                            type="button"
                            disabled={bundleAdding || bundleSelectedCount === 0 || isSaving}
                            onClick={() => void handleApplyPackage()}
                            className={`mt-5 flex h-12 w-full items-center justify-center rounded-xl text-base font-bold transition md:h-14 ${
                              bundleAddedFlash
                                ? "bg-[#16A34A] text-white"
                                : "bg-[#2563EB] text-white hover:bg-blue-700"
                            } disabled:opacity-40`}
                          >
                            {bundleAdding ? "…" : bundleAddedFlash ? "✓ Applied" : "✓ Apply this package"}
                          </button>
                          <Link
                            href={`/review/bundles/${roomSlug}`}
                            className="mt-4 inline-block text-sm font-semibold text-[#2563EB] hover:underline"
                          >
                            Browse all bundles →
                          </Link>
                        </div>
                      ) : (
                        <p className="text-center text-sm text-[#6B7280]">Loading package…</p>
                      )}
                    </div>
                  )}
                </div>
              ) : null}
            </section>

            <p className="mt-10 text-center text-sm text-[#6B7280]">
              Art and decorative items are managed separately in the Art Collection section.
            </p>
          </main>
        </>
      )}

      {showRoomChrome ? (
        <footer className="fixed bottom-0 inset-x-0 z-30 min-h-16 border-t border-gray-200 bg-white py-2 shadow-lg md:py-0">
          <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-2 px-4 md:min-h-16 md:flex-nowrap md:gap-4 md:px-8">
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                title="Undo"
                aria-label="Undo"
                disabled={!undoAvail || isSaving}
                onClick={() => void undoRoom()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-lg leading-none text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
              >
                ⟲
              </button>
              <button
                type="button"
                title="Redo"
                aria-label="Redo"
                disabled={!redoAvail || isSaving}
                onClick={() => void redoRoom()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 text-lg leading-none text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-40"
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
              <Link
                href={prevRoom ? `/review/${slugify(prevRoom)}${guided ? "?guided=true" : ""}` : "/review"}
                className="hidden rounded-lg border border-gray-200 px-3 py-2 text-xs font-medium text-gray-800 transition-colors hover:bg-gray-50 sm:inline md:text-sm"
              >
                ← Rooms
              </Link>
              {nextRoom ? (
                <Link
                  href={`/review/${slugify(nextRoom)}${guided ? "?guided=true" : ""}`}
                  className="rounded-lg bg-[#2563EB] px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 md:text-sm"
                >
                  Next Room →
                </Link>
              ) : (
                <Link href="/review" className="rounded-lg bg-gray-200 px-3 py-2 text-xs font-medium text-gray-800 md:text-sm">
                  Done
                </Link>
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
              {nextRoom ? (
                <Link
                  href={`/review/${slugify(nextRoom)}?guided=true`}
                  onClick={() => setShowGuidedComplete(false)}
                  className="flex min-h-[48px] items-center justify-center rounded-xl bg-[#2563EB] px-4 text-center text-base font-bold text-white"
                >
                  Next Room: {nextRoom} →
                </Link>
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
        <div className="fixed bottom-52 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-gray-900 px-5 py-3 text-base text-white shadow-xl">
          {toast}
          <button type="button" className="ml-3 text-green-400" onClick={() => setToast(null)}>
            ✓
          </button>
        </div>
      )}
    </div>
  );
}
