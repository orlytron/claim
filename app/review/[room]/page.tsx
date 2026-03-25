"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import FocusedAdditionCard from "../../components/FocusedAdditionCard";
import SuggestionConfirmBanner from "../../components/SuggestionConfirmBanner";
import SuggestionConfirmModal from "../../components/SuggestionConfirmModal";
import { dispatchUpgradeReward } from "../../components/UpgradeRewardToast";
import type { Bundle, BundleItem } from "../../lib/bundles-data";
import type { SmartItemRequestBundleJson } from "../../lib/smart-item-request";
import {
  getNextSuggestions,
  ROOM_SUGGESTIONS,
  suggestionAlreadyPresent,
} from "../../lib/room-item-suggestions";
import {
  getAdminOnlyBundlesForRoom,
  getConsumableBundlesForRoom,
  getFocusedBundlesForRoom,
} from "../../lib/bundles-client-catalog";
import { sumPendingCompleteTierFocusedBundles } from "../../lib/focused-bundle-complete-tier";
import { cleanDescription } from "../../lib/clean-description";
import { mergeClaimIncoming } from "../../lib/claim-item-merge";
import { CLAIM_GOAL_DEFAULT, DEFAULT_ROOM_TARGETS } from "../../lib/room-targets";
import { readRoomGoal, writeRoomGoal } from "../../lib/room-goals";
import { loadSession, saveSession, SessionData } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { displayAgeYears, ORIGINAL_CLAIM_ITEMS } from "../../lib/original-claim-data";
import { ClaimItem } from "../../lib/types";
import { useClaimMode } from "../../lib/useClaimMode";
import { slugify, formatCurrency } from "../../lib/utils";
import type { UpgradeOption } from "./UpgradeOptionsPanel";

export type { UpgradeOption };
import { SUGGESTED_UPGRADES } from "../../lib/suggested-upgrades";
import { ROOM_ORDER } from "../../lib/room-order";
import SmartLookup from "../../components/SmartLookup";

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
  "master-bedroom": "Master Bedroom",
  "master-bathroom": "Master Bathroom",
  "master-closet": "Master Closet",
  "david-office-guest-room": "David Office / Guest Room",
  art: "Art",
};

function displayRoomTitle(room: string) {
  return room;
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

/** Lines that can have upgrade-cache lookups (excludes art / low-value decor). */
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

function formatSignedGap(value: number): string {
  if (value < 0) return `−${formatCurrency(Math.abs(value))}`;
  if (value > 0) return `+${formatCurrency(value)}`;
  return formatCurrency(0);
}

function autoCondition(age: number): string {
  if (age === 0) return "New";
  if (age <= 5) return "Like New";
  if (age <= 10) return "Good";
  if (age <= 15) return "Decent";
  return "Used";
}

function ConsumablePackCard({
  bundle: b,
  disabled,
  onAdd,
}: {
  bundle: Bundle;
  disabled?: boolean;
  onAdd: (b: Bundle) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const lines = b.items;
  const visible = expanded ? lines : lines.slice(0, 3);
  const moreCount = Math.max(0, lines.length - 3);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold text-gray-900">
            <span aria-hidden>📦</span> {b.name}
          </p>
          <span className="shrink-0 text-sm font-bold tabular-nums text-gray-900">{formatCurrency(b.total_value)}</span>
        </div>
        <ul className="mt-3 space-y-2 text-sm">
          {visible.map((item, idx) => {
            const lineTot = item.total ?? item.qty * item.unit_cost;
            return (
              <li key={`${item.description}-${idx}`} className="flex flex-wrap items-baseline justify-between gap-2 text-gray-800">
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  {cleanDescription(item.description)}
                  {item.qty > 1 ? (
                    <>
                      <span className="text-gray-400"> ×{item.qty}</span>
                      <span className="text-xs text-gray-500"> {formatCurrency(item.unit_cost)} each</span>
                    </>
                  ) : null}
                </span>
                <span className="shrink-0 tabular-nums font-medium text-gray-900">
                  {item.qty > 1 ? `= ${formatCurrency(lineTot)}` : formatCurrency(item.unit_cost)}
                </span>
              </li>
            );
          })}
        </ul>
        {moreCount > 0 ? (
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="mt-2 text-sm font-semibold text-[#2563EB] hover:underline"
          >
            {expanded ? "▲ Show less" : `▶ Show ${moreCount} more item${moreCount === 1 ? "" : "s"}`}
          </button>
        ) : null}
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onAdd(b)}
        className="min-h-[48px] shrink-0 self-stretch rounded-xl bg-[#16A34A] px-4 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-40 sm:self-center"
      >
        + Add package
      </button>
    </div>
  );
}

export default function RoomReviewPage() {
  const params = useParams<{ room: string }>();
  const roomSlug = params.room;
  const router = useRouter();
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
  const [premiumMaxByDesc, setPremiumMaxByDesc] = useState<Record<string, number>>({});
  const [lockedKeys, setLockedKeys] = useState<string[]>([]);
  const [roomTarget, setRoomTarget] = useState(0);
  const [claimGoal, setClaimGoal] = useState(CLAIM_GOAL_DEFAULT);
  const [editingTarget, setEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState("");
  const targetEditInputRef = useRef<HTMLInputElement>(null);
  const [editingItemKey, setEditingItemKey] = useState<string | null>(null);
  const [headerExpanded, setHeaderExpanded] = useState(false);
  const [editDraft, setEditDraft] = useState({
    description: "",
    brand: "",
    model: "",
    unit_cost: "",
    age_years: "0",
    condition: "New",
    vendor: "",
    qty: "1",
    notes: "",
  });
  const [quickDesc, setQuickDesc] = useState("");
  const [quickBrand, setQuickBrand] = useState("");
  const [quickPrice, setQuickPrice] = useState("");
  const [quickAge, setQuickAge] = useState("0");
  const quickDescRef = useRef<HTMLInputElement>(null);
  const [itemBundleLoading, setItemBundleLoading] = useState<string | null>(null);
  const [itemBundleResults, setItemBundleResults] = useState<Record<string, BundleItem[]>>({});
  const [itemBundleQuery, setItemBundleQuery] = useState<Record<string, string>>({});
  const [suggestionOffset, setSuggestionOffset] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [consumablesExpanded, setConsumablesExpanded] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [suggestionsModalOpen, setSuggestionsModalOpen] = useState(false);
  /** User clicked “View initial suggestions” — reopen modal even if localStorage says dismissed. */
  const [reopenSuggestions, setReopenSuggestions] = useState(false);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const undoHistoryRef = useRef<ClaimItem[][]>([]);
  const undoFutureRef = useRef<ClaimItem[][]>([]);
  const [undoAvail, setUndoAvail] = useState(false);
  const [redoAvail, setRedoAvail] = useState(false);

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
    setLockedKeys(readLocked());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsAdminUser(window.localStorage.getItem("isAdmin") === "true");
  }, []);

  useEffect(() => {
    setShowBanner(false);
  }, [roomSlug]);

  useEffect(() => {
    if (!roomSlug) return;
    if (!roomName) {
      setSuggestionsModalOpen(false);
      return;
    }
    const hasList = (SUGGESTED_UPGRADES[roomName] ?? []).length > 0;
    if (!hasList) {
      setSuggestionsModalOpen(false);
      return;
    }
    if (reopenSuggestions) setSuggestionsModalOpen(true);
    else setSuggestionsModalOpen(false);
  }, [roomSlug, roomName, reopenSuggestions]);

  const claimItemCount = session?.claim_items?.length ?? 0;

  useEffect(() => {
    if (!sessionLoaded) return;
    if (!roomSlug) return;
    if (claimItemCount === 0) return;
    if (!roomName) return;
    if ((SUGGESTED_UPGRADES[roomName] ?? []).length === 0) {
      setShowBanner(false);
      return;
    }
    const key = `suggestions_shown_${roomSlug}`;
    const shown = typeof window !== "undefined" ? localStorage.getItem(key) : null;
    if (!shown) setShowBanner(true);
  }, [sessionLoaded, roomSlug, roomName, claimItemCount]);

  useEffect(() => {
    if (!editingTarget) {
      setTargetInput(String(roomTarget));
    }
  }, [roomTarget, editingTarget]);

  useEffect(() => {
    if (editingTarget) {
      targetEditInputRef.current?.focus();
      targetEditInputRef.current?.select();
    }
  }, [editingTarget]);

  useEffect(() => {
    if (!hydrated) return;
    void bootstrap();
  }, [roomSlug, hydrated, sessionId]);

  async function bootstrap() {
    setIsLoading(true);
    setSessionLoaded(false);
    setLoadError(null);
    setItems([]);
    let sess: SessionData | null = null;
    try {
      sess = await loadSession(sessionId);
    } catch {
      setLoadError("We couldn’t load your claim. Check your connection and try again.");
      setIsLoading(false);
      setSessionLoaded(true);
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
      setSessionLoaded(true);
      return;
    }
    setClaimGoal(sess.target_value ?? CLAIM_GOAL_DEFAULT);
    const rooms = sess.room_summary?.map((r) => r.room) ?? [...new Set(claimItems.map((i) => i.room))];
    const name = SLUG_TO_ROOM[roomSlug] ?? rooms.find((r) => slugify(r) === roomSlug) ?? "";
    setRoomName(name);
    if (!name) {
      setIsLoading(false);
      setSessionLoaded(true);
      return;
    }
    const roomItems = claimItems.filter((i) => i.room === name);
    setItems(roomItems);

    const storedGoal = readRoomGoal(sessionId, name);
    const def = DEFAULT_ROOM_TARGETS[name] ?? 0;
    setRoomTarget(roundRoomGoalSlider(storedGoal ?? def));

    const descriptions = roomItems
      .filter((i) => isUpgradeCandidate(i))
      .map((i) => i.pre_upgrade_item?.description ?? i.description);
    const params = new URLSearchParams();
    params.set("room", name);
    descriptions.forEach((d) => params.append("desc", d));
    try {
      const r = await fetch(`/api/upgrade-cache-status?${params.toString()}`);
      const j = (await r.json()) as { cached?: string[]; premiumMaxByDesc?: Record<string, number> };
      setCachedDescs(new Set((j.cached ?? []).map(norm)));
      setPremiumMaxByDesc(j.premiumMaxByDesc ?? {});
    } catch {
      setCachedDescs(new Set());
      setPremiumMaxByDesc({});
    }
    setIsLoading(false);
    setSessionLoaded(true);
  }

  /** Dedupe by description + room; keep higher unit_cost; sort by price desc (display list). */
  const displayItems = useMemo(() => {
    const uniqueItems = items.reduce((acc, item) => {
      const key = `${item.description.toLowerCase().trim()}-${item.room}`;
      if (!acc.has(key)) {
        acc.set(key, item);
      } else {
        const existing = acc.get(key)!;
        if (item.unit_cost > existing.unit_cost) {
          acc.set(key, item);
        }
      }
      return acc;
    }, new Map<string, ClaimItem>());
    return Array.from(uniqueItems.values()).sort((a, b) => b.unit_cost - a.unit_cost);
  }, [items]);

  const upgradeCandidates = useMemo(() => items.filter(isUpgradeCandidate), [items]);

  const upgradeSubtotal = useMemo(
    () => upgradeCandidates.reduce((s, i) => s + i.qty * i.unit_cost, 0),
    [upgradeCandidates]
  );

  const roomTotal = useMemo(() => items.reduce((s, i) => s + i.qty * i.unit_cost, 0), [items]);

  const currentSuggestions = useMemo(
    () => getNextSuggestions(roomName, items, suggestionOffset),
    [roomName, items, suggestionOffset]
  );

  const totalAvailable = useMemo(() => {
    const all = ROOM_SUGGESTIONS[roomName] || [];
    return all.filter((s) => !suggestionAlreadyPresent(s, items)).length;
  }, [roomName, items]);

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
  const gapSigned = roomTotal - roomTarget;

  const pendingFocusedCompleteSum = useMemo(() => {
    if (!roomName || !session?.claim_items) return 0;
    return sumPendingCompleteTierFocusedBundles(
      roomName,
      session.claim_items,
      getFocusedBundlesForRoom(roomName)
    );
  }, [roomName, session?.claim_items]);

  const upgradePremiumPotentialDelta = useMemo(() => {
    if (!items.length) return 0;
    let s = 0;
    for (const item of items) {
      if (!isUpgradeCandidate(item)) continue;
      const descKey = norm(item.pre_upgrade_item?.description ?? item.description);
      const maxP = premiumMaxByDesc[descKey];
      if (typeof maxP !== "number" || maxP <= 0) continue;
      const delta = (maxP - item.unit_cost) * item.qty;
      if (delta > 0) s += delta;
    }
    return Math.round(s * 100) / 100;
  }, [items, premiumMaxByDesc]);

  const maximumPossibleRoomTotal =
    Math.round((roomTotal + pendingFocusedCompleteSum + upgradePremiumPotentialDelta) * 100) / 100;
  const remainingGapAfterMaximum = maximumPossibleRoomTotal - roomTarget;

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
    setEditingItemKey(null);
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
      setToast("Updates saved");
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

  function normalizeBundleLineFromApi(raw: unknown): BundleItem | null {
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    const qty = Math.max(1, Math.round(Number(o.qty) || 1));
    const unit_cost = Math.round((Number(o.unit_cost) || 0) * 100) / 100;
    const description = String(o.description ?? "").trim() || "Item";
    const brand = String(o.brand ?? "").trim();
    const category = String(o.category ?? "Other").trim() || "Other";
    return {
      description,
      brand,
      qty,
      unit_cost,
      total: Math.round(unit_cost * qty * 100) / 100,
      category,
    };
  }

  async function handleItemBundle(item: ClaimItem, key: string, customQuery?: string) {
    setItemBundleLoading(key);
    try {
      const searchTerm = (customQuery ?? `${item.brand || ""} ${item.description}`).trim();
      const res = await fetch("/api/smart-item-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          request: `Generate items that go with: ${searchTerm}. Focus on related accessories, supplies and complementary items. Room: ${roomName}`,
          room: roomName,
          existingItems: items.slice(0, 10),
          sessionId,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as { success?: boolean; bundle?: SmartItemRequestBundleJson };
      if (!data.success || !data.bundle) return;
      const rawItems = data.bundle.tiers?.complete?.items;
      const relatedItems = (Array.isArray(rawItems) ? rawItems : [])
        .map(normalizeBundleLineFromApi)
        .filter((x): x is BundleItem => x != null)
        .slice(0, 8);
      setItemBundleResults((prev) => ({ ...prev, [key]: relatedItems }));
    } catch {
      // fail silently
    } finally {
      setItemBundleLoading(null);
    }
  }

  async function handleQuickAdd() {
    if (!quickDesc.trim()) return;
    const price = parseFloat(quickPrice.replace(/[^0-9.]/g, "")) || 0;
    const newItem: ClaimItem = {
      room: roomName,
      description: quickDesc.trim(),
      brand: quickBrand.trim(),
      model: "",
      qty: 1,
      age_years: parseInt(quickAge, 10) || 0,
      age_months: 0,
      condition: "New",
      unit_cost: price,
      category: "Other",
      source: "bundle",
    };
    await handleFocusedBundleAdd([newItem]);
    setQuickDesc("");
    setQuickBrand("");
    setQuickPrice("");
    setQuickAge("0");
    quickDescRef.current?.focus();
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

  function saveTarget() {
    if (!roomName) {
      setEditingTarget(false);
      return;
    }
    const raw = parseInt(String(targetInput).replace(/\D/g, ""), 10);
    if (!Number.isNaN(raw) && raw > 0) {
      const v = roundRoomGoalSlider(raw);
      writeRoomGoal(sessionId, roomName, v);
      setRoomTarget(v);
    }
    setEditingTarget(false);
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
          sessionItems={session.claim_items ?? []}
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
      {session && showBanner && showRoomChrome && roomSuggestionList.length > 0 ? (
        <SuggestionConfirmBanner
          roomName={roomName}
          list={roomSuggestionList}
          currentClaimItems={session.claim_items ?? []}
          sessionId={sessionId}
          disabled={isSaving}
          onApplySuggestions={async (nextClaim) => {
            if (nextClaim) {
              await handleApplySuggestionsFromBanner(nextClaim);
            }
            if (typeof window !== "undefined" && roomSlug) {
              localStorage.setItem(`suggestions_shown_${roomSlug}`, "shown");
            }
            setShowBanner(false);
          }}
          onSkipForNow={() => {
            if (typeof window !== "undefined" && roomSlug) {
              localStorage.setItem(`suggestions_shown_${roomSlug}`, "shown");
            }
            setShowBanner(false);
          }}
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
      ) : !roomName ? (
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
                        router.push(`/review/${navPrev.slug}`);
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
                        router.push(`/review/${navNext.slug}`);
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

              <div className="mt-3 rounded-xl border border-gray-200 bg-gray-50">
                <button
                  type="button"
                  onClick={() => setHeaderExpanded((e) => !e)}
                  className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left hover:bg-gray-100"
                >
                  <div className="flex flex-wrap items-center gap-3 text-sm tabular-nums">
                    <span className="font-bold text-gray-900">{formatCurrency(roomTotal)}</span>
                    <span className="text-gray-400">of {formatCurrency(roomTarget)}</span>
                    <span
                      className={`font-semibold ${gapSigned < 0 ? "text-red-500" : "text-green-600"}`}
                    >
                      {formatSignedGap(gapSigned)}
                    </span>
                  </div>
                  <span className="ml-4 shrink-0 text-xs text-gray-400">
                    {headerExpanded ? "▲ Less" : "▼ Details"}
                  </span>
                </button>

                {headerExpanded ? (
                  <div className="space-y-2 border-t border-gray-200 px-4 py-4 text-sm md:text-base">
                    <div className="flex flex-wrap items-center justify-between gap-2 tabular-nums">
                      <span className="text-[#6B7280]">Current:</span>
                      <span className="font-semibold text-gray-900">{formatCurrency(roomTotal)}</span>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 tabular-nums">
                      <span className="text-[#6B7280]">Target:</span>
                      {editingTarget ? (
                        <span className="inline-flex flex-wrap items-center gap-2">
                          <input
                            ref={targetEditInputRef}
                            type="number"
                            min={1}
                            className="w-40 max-w-[55vw] rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-sm font-semibold tabular-nums text-gray-900"
                            value={targetInput}
                            onChange={(e) => setTargetInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveTarget();
                              if (e.key === "Escape") {
                                setEditingTarget(false);
                                setTargetInput(String(roomTarget));
                              }
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => saveTarget()}
                            className="rounded-lg bg-[#2563EB] px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-700"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTarget(false);
                              setTargetInput(String(roomTarget));
                            }}
                            className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <span className="inline-flex flex-wrap items-center gap-2 font-semibold text-gray-900">
                          {formatCurrency(roomTarget)}
                          <button
                            type="button"
                            className="text-base leading-none text-[#2563EB] hover:opacity-80"
                            onClick={() => {
                              setTargetInput(String(roomTarget));
                              setEditingTarget(true);
                            }}
                            aria-label="Edit target"
                          >
                            ✏️
                          </button>
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 tabular-nums">
                      <span className="text-[#6B7280]">Gap:</span>
                      <span className="font-semibold text-gray-900">{formatSignedGap(gapSigned)}</span>
                    </div>
                    <div className="mt-4 space-y-2 border-t border-gray-200 pt-3 text-xs tabular-nums text-gray-800 md:text-sm">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">
                        What this room could reach
                      </p>
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="text-[#6B7280]">Current value:</span>
                        <span className="font-medium text-gray-900">{formatCurrency(roomTotal)}</span>
                      </div>
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="min-w-0 text-[#6B7280]">+ Focused additions (Complete ★ all):</span>
                        <span className="font-medium text-[#16A34A]">+{formatCurrency(pendingFocusedCompleteSum)}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="text-[#6B7280]">+ If you upgrade items:</span>
                          <span className="font-medium text-[#16A34A]">+{formatCurrency(upgradePremiumPotentialDelta)}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] leading-snug text-[#9CA3AF]">
                          (all upgrade options at premium tier)
                        </p>
                      </div>
                      <div className="flex flex-wrap justify-between gap-2 font-semibold text-gray-900">
                        <span>Maximum possible:</span>
                        <span>{formatCurrency(maximumPossibleRoomTotal)}</span>
                      </div>
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="text-[#6B7280]">Your target:</span>
                        <span className="font-medium">{formatCurrency(roomTarget)}</span>
                      </div>
                      <div className="flex flex-wrap justify-between gap-2">
                        <span className="text-[#6B7280]">Remaining gap:</span>
                        <span className="font-semibold text-gray-900">{formatSignedGap(remainingGapAfterMaximum)}</span>
                      </div>
                      <p className="pt-2 text-sm leading-snug text-gray-700">
                        {maximumPossibleRoomTotal < roomTarget ? (
                          <>
                            💡 Art collection and documentation will close the remaining gap.
                          </>
                        ) : (
                          <>✅ This room can reach its target with upgrades and additions.</>
                        )}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 border-t border-gray-200 pt-3 text-xs md:text-sm">
                      <button
                        type="button"
                        onClick={() => setShowResetConfirm(true)}
                        className="font-medium text-[#2563EB] underline-offset-2 hover:underline"
                      >
                        Reset room
                      </button>
                      {roomSuggestionList.length > 0 ? (
                        <>
                          <span className="text-gray-300">·</span>
                          <button
                            type="button"
                            onClick={() => {
                              setReopenSuggestions(true);
                              setShowBanner(false);
                              setSuggestionsModalOpen(true);
                            }}
                            className="font-semibold text-amber-800 underline-offset-2 hover:underline"
                          >
                            View initial suggestions
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <p className="mt-6 text-xs leading-relaxed text-[#6B7280] md:text-sm">
                Upgrade existing items below, then add bundles to reach your target.
              </p>

            </div>
          </header>

          <main
            id="claim-items-anchor"
            className="mx-auto w-full max-w-[1100px] flex-1 scroll-mt-24 overflow-x-hidden px-4 py-6 md:px-8"
          >
            <div className="mb-8">
              <SmartLookup
                roomName={roomName}
                onAdd={(lines) => void handleFocusedBundleAdd(lines)}
                disabled={isSaving}
                sessionId={sessionId}
                existingItems={items}
              />
            </div>
            {totalAvailable > 0 ? (
              <div className="mb-4 px-1">
                {!showSuggestions ? (
                  <button
                    type="button"
                    onClick={() => setShowSuggestions(true)}
                    className="flex items-center gap-1 py-1 text-xs text-gray-400 hover:text-gray-600"
                  >
                    <span>💡</span>
                    <span>Suggest items for this room</span>
                    <span className="text-gray-300">({totalAvailable} ideas)</span>
                  </button>
                ) : (
                  <div className="rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-medium text-gray-500">💡 What else could be here?</p>
                      <button
                        type="button"
                        onClick={() => setShowSuggestions(false)}
                        className="text-xs text-gray-300 hover:text-gray-500"
                      >
                        hide
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {currentSuggestions.map((s, i) => (
                        <span
                          key={i}
                          className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs text-gray-600"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                    {totalAvailable > suggestionOffset + 5 ? (
                      <button
                        type="button"
                        onClick={() => setSuggestionOffset((o) => o + 5)}
                        className="mt-2 text-xs text-gray-400 hover:text-gray-600"
                      >
                        Show more ideas →
                      </button>
                    ) : null}
                    {totalAvailable <= suggestionOffset + 5 && suggestionOffset > 0 ? (
                      <p className="mt-2 text-xs text-gray-400">
                        That&apos;s all the suggestions for this room.
                      </p>
                    ) : null}
                  </div>
                )}
              </div>
            ) : null}
            <section className="rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300">
              <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4 md:px-6">
                <div>
                  <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900">What&apos;s in this room</h2>
                  <p className="mt-0.5 text-sm tabular-nums text-gray-500">
                    {displayItems.length} items · {formatCurrency(roomTotal)}
                  </p>
                </div>
              </div>

              <div className="border-b border-gray-100 bg-gray-50/50 px-4 py-4 md:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    ref={quickDescRef}
                    type="text"
                    placeholder="Item name"
                    value={quickDesc}
                    onChange={(e) => setQuickDesc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleQuickAdd();
                    }}
                    className="min-w-[160px] flex-[3] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Brand"
                    value={quickBrand}
                    onChange={(e) => setQuickBrand(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleQuickAdd();
                    }}
                    className="min-w-[110px] flex-[2] rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400"
                  />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Cost"
                    value={quickPrice}
                    onChange={(e) => setQuickPrice(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleQuickAdd();
                    }}
                    className="w-24 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400 tabular-nums"
                  />
                  <input
                    type="number"
                    placeholder="Age"
                    value={quickAge}
                    onChange={(e) => setQuickAge(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handleQuickAdd();
                    }}
                    className="w-16 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400"
                  />
                  <button
                    type="button"
                    disabled={!quickDesc.trim() || isSaving}
                    onClick={() => void handleQuickAdd()}
                    className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
                  >
                    Add →
                  </button>
                </div>
              </div>

              {displayItems.length === 0 ? (
                <div className="px-5 py-10 text-center md:px-6">
                  <p className="text-2xl">🏠</p>
                  <p className="mt-2 text-base font-semibold text-gray-900">This room is empty</p>
                  <p className="mt-1 text-sm text-gray-500">
                    Use the sections below to add items, or describe something you remember.
                  </p>
                </div>
              ) : (
                <>
                  <div
                    className="grid select-none items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-400 md:px-6"
                    style={{
                      gridTemplateColumns: "2rem 1fr 120px 3rem 4rem 80px 80px 80px 3rem",
                    }}
                  >
                    <span>#</span>
                    <span>Description</span>
                    <span>Brand</span>
                    <span className="text-center">Qty</span>
                    <span className="text-center">Age</span>
                    <span>Condition</span>
                    <span className="text-right">Each</span>
                    <span className="text-right">Total</span>
                    <span />
                  </div>
                  {displayItems.map((item, idx) => {
                    const lk = lockKeyForItem(item);
                    const locked = lockedKeys.includes(lk);
                    const isEditing = editingItemKey === lk;

                    if (isEditing) {
                      return (
                        <div key={lk} className="border-b border-blue-200 bg-blue-50/40 px-4 py-4 md:px-6">
                          <div
                            onClick={() => setEditingItemKey(null)}
                            className="flex cursor-pointer items-center justify-between border-b border-blue-100 bg-blue-50/60 px-4 py-2.5 hover:bg-blue-100/50"
                          >
                            <span className="text-sm font-medium text-gray-700">
                              {cleanDescription(item.description)}
                            </span>
                            <span className="text-xs text-gray-400">▲ Close</span>
                          </div>
                          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                            <div className="md:col-span-2">
                              <label className="text-xs font-medium text-gray-500">Description</label>
                              <input
                                autoFocus
                                value={editDraft.description}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, description: e.target.value }))
                                }
                                placeholder="Item description"
                                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500">Brand</label>
                              <input
                                value={editDraft.brand}
                                onChange={(e) => setEditDraft((d) => ({ ...d, brand: e.target.value }))}
                                placeholder="Brand or manufacturer"
                                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500">Model #</label>
                              <input
                                value={editDraft.model}
                                onChange={(e) => setEditDraft((d) => ({ ...d, model: e.target.value }))}
                                placeholder="Model number"
                                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500">
                                Original Vendor / Where purchased
                              </label>
                              <input
                                value={editDraft.vendor}
                                onChange={(e) => setEditDraft((d) => ({ ...d, vendor: e.target.value }))}
                                placeholder="e.g. gift from grandpa"
                                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500">Price (each)</label>
                              <input
                                value={editDraft.unit_cost}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, unit_cost: e.target.value }))
                                }
                                placeholder="0"
                                inputMode="decimal"
                                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm tabular-nums"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500">Qty</label>
                              <input
                                type="number"
                                min={1}
                                value={editDraft.qty || "1"}
                                onChange={(e) => setEditDraft((d) => ({ ...d, qty: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500">Age (years)</label>
                              <input
                                type="number"
                                min={0}
                                value={editDraft.age_years}
                                onChange={(e) => {
                                  const yr = parseInt(e.target.value, 10) || 0;
                                  setEditDraft((d) => ({
                                    ...d,
                                    age_years: e.target.value,
                                    condition: autoCondition(yr),
                                  }));
                                }}
                                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500">Condition</label>
                              <select
                                value={editDraft.condition}
                                onChange={(e) =>
                                  setEditDraft((d) => ({ ...d, condition: e.target.value }))
                                }
                                className="mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                              >
                                <option>New</option>
                                <option>Like New</option>
                                <option>Good</option>
                                <option>Decent</option>
                                <option>Used</option>
                              </select>
                            </div>
                          </div>
                          <div className="mt-4 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              disabled={!editDraft.description.trim() || isSaving}
                              onClick={async () => {
                                const price =
                                  parseFloat(String(editDraft.unit_cost).replace(/[^0-9.]/g, "")) || 0;
                                const age = Math.min(120, Math.max(0, parseInt(String(editDraft.age_years), 10) || 0));
                                const qty = Math.min(20, Math.max(1, parseInt(String(editDraft.qty), 10) || 1));
                                setIsSaving(true);
                                try {
                                  const next = items.map((ci) =>
                                    sameClaimLine(ci, item)
                                      ? {
                                          ...ci,
                                          description: editDraft.description.trim(),
                                          brand: editDraft.brand.trim(),
                                          model: editDraft.model.trim(),
                                          unit_cost: Math.round(price * 100) / 100,
                                          age_years: age,
                                          qty,
                                          condition: editDraft.condition,
                                          vendor_name: editDraft.vendor.trim() || undefined,
                                        }
                                      : ci
                                  );
                                  await saveRoomItems(next);
                                  setEditingItemKey(null);
                                  setToast("✓ Updated");
                                } finally {
                                  setIsSaving(false);
                                }
                              }}
                              className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingItemKey(null)}
                              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={locked || isSaving}
                              onClick={() => void handleRemoveItemRow(item)}
                              className="ml-auto rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                            >
                              Remove item
                            </button>
                          </div>
                          <div className="mt-4 border-t border-blue-100 pt-4">
                            {!(itemBundleResults[lk]?.length) ? (
                              <button
                                type="button"
                                disabled={itemBundleLoading === lk}
                                onClick={() => void handleItemBundle(item, lk)}
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                              >
                                {itemBundleLoading === lk ? (
                                  <>
                                    <div className="h-3 w-3 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                                    Finding related items...
                                  </>
                                ) : (
                                  "+ What else goes with this?"
                                )}
                              </button>
                            ) : null}

                            {itemBundleResults[lk] && itemBundleResults[lk].length > 0 ? (
                              <div className="space-y-1">
                                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400">Related items</p>
                                {itemBundleResults[lk].map((bi, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2 text-sm"
                                  >
                                    <span className="flex-1 truncate font-medium text-gray-800">{bi.description}</span>
                                    <span className="shrink-0 text-xs text-gray-400">{bi.brand || "Unbranded"}</span>
                                    <span className="w-20 shrink-0 text-right text-xs font-semibold tabular-nums text-gray-700">
                                      {formatCurrency(bi.unit_cost)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void handleFocusedBundleAdd([
                                          {
                                            room: roomName,
                                            description: bi.description,
                                            brand: bi.brand || "",
                                            model: "",
                                            qty: bi.qty || 1,
                                            unit_cost: bi.unit_cost,
                                            age_years: 0,
                                            age_months: 0,
                                            condition: "New",
                                            category: bi.category || "Other",
                                            source: "bundle",
                                          },
                                        ]);
                                      }}
                                      className="shrink-0 rounded-lg bg-[#2563EB] px-2.5 py-1 text-xs font-bold text-white hover:bg-blue-700"
                                    >
                                      + Add
                                    </button>
                                  </div>
                                ))}
                                <div className="mt-3 flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="Type a specific item to find more like this..."
                                    value={itemBundleQuery[lk] || ""}
                                    onChange={(e) =>
                                      setItemBundleQuery((prev) => ({
                                        ...prev,
                                        [lk]: e.target.value,
                                      }))
                                    }
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && itemBundleQuery[lk]?.trim()) {
                                        void handleItemBundle(item, lk, itemBundleQuery[lk]);
                                      }
                                    }}
                                    className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm placeholder-gray-400"
                                  />
                                  <button
                                    type="button"
                                    disabled={!itemBundleQuery[lk]?.trim() || itemBundleLoading === lk}
                                    onClick={() => {
                                      if (itemBundleQuery[lk]?.trim()) {
                                        void handleItemBundle(item, lk, itemBundleQuery[lk]);
                                      }
                                    }}
                                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                                  >
                                    Find more →
                                  </button>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setItemBundleResults((prev) => {
                                      const n = { ...prev };
                                      delete n[lk];
                                      return n;
                                    });
                                  }}
                                  className="mt-1 text-xs text-gray-400 hover:text-gray-600"
                                >
                                  Clear results
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    }

                    const condShow = item.condition?.trim() || autoCondition(displayAgeYears(item));

                    return (
                      <div
                        key={`${lk}-${idx}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          if (locked || isSaving) return;
                          setEditingItemKey(lk);
                          setEditDraft({
                            description: item.description,
                            brand: item.brand || "",
                            model: item.model || "",
                            unit_cost: String(item.unit_cost),
                            age_years: String(displayAgeYears(item)),
                            condition: item.condition?.trim() || autoCondition(displayAgeYears(item)),
                            vendor: item.vendor_name || "",
                            qty: String(item.qty),
                            notes: "",
                          });
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            if (locked || isSaving) return;
                            setEditingItemKey(lk);
                            setEditDraft({
                              description: item.description,
                              brand: item.brand || "",
                              model: item.model || "",
                              unit_cost: String(item.unit_cost),
                              age_years: String(displayAgeYears(item)),
                              condition: item.condition?.trim() || autoCondition(displayAgeYears(item)),
                              vendor: item.vendor_name || "",
                              qty: String(item.qty),
                              notes: "",
                            });
                          }
                        }}
                        className="group grid cursor-pointer items-center gap-2 border-b border-gray-100 px-4 py-2.5 text-sm transition-colors last:border-0 hover:bg-blue-50/30 md:px-6"
                        style={{
                          gridTemplateColumns: "2rem 1fr 120px 3rem 4rem 80px 80px 80px 3rem",
                        }}
                      >
                        <span className="text-xs tabular-nums text-gray-400">{idx + 1}</span>
                        <span className="truncate font-medium text-gray-900">
                          {cleanDescription(item.description)}
                          {(item.source === "bundle" || item.source === "suggestion") && (
                            <sup className="ml-0.5 text-[9px] text-gray-400">*</sup>
                          )}
                        </span>
                        <span className="truncate text-xs text-gray-500">
                          {item.brand?.trim() ? (
                            item.brand.trim()
                          ) : (
                            <span className="text-blue-400 underline decoration-dotted">Unbranded</span>
                          )}
                        </span>
                        <span className="text-center text-xs tabular-nums text-gray-500">×{item.qty}</span>
                        <span className="text-center text-xs tabular-nums text-gray-400">
                          {displayAgeYears(item) > 0 ? `${displayAgeYears(item)}yr` : "New"}
                        </span>
                        <span className="truncate text-xs text-gray-500">{condShow}</span>
                        <span className="text-right text-xs tabular-nums text-gray-700">
                          {formatCurrency(item.unit_cost)}
                        </span>
                        <span className="text-right text-sm font-semibold tabular-nums text-gray-900">
                          {formatCurrency(item.unit_cost * item.qty)}
                        </span>
                        <button
                          type="button"
                          disabled={locked || isSaving}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleRemoveItemRow(item);
                          }}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-base leading-none text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 disabled:pointer-events-none disabled:opacity-0"
                          aria-label="Remove line"
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </>
              )}
            </section>

            <section className="mt-12">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900">
                Add items to {displayRoomTitle(roomName).toUpperCase()}
              </h2>
              <p className="mt-1 text-sm text-[#6B7280]">
                Look up replacement options, then add focused bundles or individual lines to your claim.
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

              {consumableBundles.length > 0 ? (
                <div className="mt-6 rounded-2xl border border-gray-200 bg-white shadow-sm">
                  <button
                    type="button"
                    onClick={() => setConsumablesExpanded((e) => !e)}
                    className="flex w-full items-center justify-between rounded-2xl px-5 py-4 hover:bg-gray-50"
                  >
                    <p className="text-left text-sm font-bold uppercase tracking-wide text-gray-700">
                      Restock & Consumable Packs
                      <span className="ml-2 font-normal normal-case text-gray-400">
                        ({consumableBundles.length} packs)
                      </span>
                    </p>
                    <span className="text-sm text-gray-400">{consumablesExpanded ? "▲" : "▼"}</span>
                  </button>

                  {consumablesExpanded ? (
                    <div className="space-y-4 border-t border-gray-100 p-5">
                      {consumableBundles.map((b) => (
                        <ConsumablePackCard
                          key={b.bundle_code}
                          bundle={b}
                          disabled={isSaving}
                          onAdd={(pack) => void handleConsumableBundleAdd(pack)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

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
            </section>

            <p className="mt-10 text-center text-sm text-[#6B7280]">
              Art and decorative items are managed separately in the Art Collection section.
            </p>
          </main>
        </>
      )}

      {showRoomChrome ? (
        <footer className="fixed bottom-0 inset-x-0 z-30 min-h-[52px] border-t border-gray-200 bg-white py-2 shadow-lg md:py-0">
          <div className="h-1.5 w-full bg-gray-200" title="Room progress toward target">
            <div
              className="h-full bg-[#2563EB] transition-[width] duration-500 ease-out"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-2 px-4 md:min-h-[56px] md:flex-nowrap md:gap-4 md:px-8">
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                disabled={!undoAvail || isSaving}
                onClick={() => void undoRoom()}
                className="inline-flex min-h-[48px] items-center gap-1.5 rounded-lg border-2 border-gray-300 px-4 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-30"
              >
                ⟲ Undo
              </button>
              <button
                type="button"
                disabled={!redoAvail || isSaving}
                onClick={() => void redoRoom()}
                className="inline-flex min-h-[48px] items-center gap-1.5 rounded-lg border-2 border-gray-300 px-4 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-30"
              >
                Redo ⟳
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
                Add: <span className="font-semibold text-[#16A34A]">+{formatCurrency(addedSub)}</span>
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
                  if (navPrev) router.push(`/review/${navPrev.slug}`);
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
                    router.push(`/review/${navNext.slug}`);
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-gray-500/25 p-4 backdrop-blur-[1px]">
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

      {toast && (
        <div className="fixed left-1/2 top-20 z-40 max-w-[min(100vw-2rem,24rem)] -translate-x-1/2 rounded-xl border border-gray-200 bg-white px-5 py-3 text-center text-base text-gray-900 shadow-lg">
          {toast}
          <button type="button" className="ml-3 font-semibold text-[#16A34A]" onClick={() => setToast(null)}>
            ✓
          </button>
        </div>
      )}
    </div>
  );
}
