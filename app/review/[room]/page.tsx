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
import { findBundleSingletonConflicts } from "../../lib/bundle-singleton";
import { mergeClaimIncoming } from "../../lib/claim-item-merge";
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

function bundleItemSig(bi: BundleItem) {
  return `${bi.description}|${bi.total}|${bi.unit_cost}`;
}

type BundleConflictResolution = "replace" | "both" | "skip";

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
  const [bundleChecks, setBundleChecks] = useState<boolean[]>([]);
  const [bundleAdding, setBundleAdding] = useState(false);
  const [bundleAddedFlash, setBundleAddedFlash] = useState(false);
  const [qtyFlashKey, setQtyFlashKey] = useState<string | null>(null);
  const [editingAgeKey, setEditingAgeKey] = useState<string | null>(null);
  const [ageDraft, setAgeDraft] = useState("");
  const [bundleConflictModal, setBundleConflictModal] = useState<{
    selected: BundleItem[];
    pairs: { bundleItem: BundleItem; existing: ClaimItem }[];
    resolutions: (BundleConflictResolution | null)[];
  } | null>(null);

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

  const bundleSnapValues = useMemo(() => {
    const vals = BUNDLES_DATA.filter((b) => b.room === roomName).map((b) => b.total_value);
    const u = Array.from(new Set(vals)).sort((a, b) => a - b);
    return [0, ...u];
  }, [roomName]);

  useEffect(() => {
    setSliderSnapIndex(bundleSnapValues.length > 1 ? 1 : 0);
  }, [roomName, bundleSnapValues.length]);

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
      .filter(isUpgradeCandidate)
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

  const upgradeItems = useMemo(
    () => items.filter(isUpgradeCandidate).sort((a, b) => b.unit_cost - a.unit_cost),
    [items]
  );

  const upgradeSubtotal = useMemo(
    () => upgradeItems.reduce((s, i) => s + i.qty * i.unit_cost, 0),
    [upgradeItems]
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

  const upgradeRowKeys = useMemo(() => new Set(upgradeItems.map((u) => lockKeyForItem(u))), [upgradeItems, lockKeyForItem]);

  const extraRoomItems = useMemo(
    () => items.filter((i) => !upgradeRowKeys.has(lockKeyForItem(i))),
    [items, upgradeRowKeys, lockKeyForItem]
  );

  const matchesSuggestionMid = useCallback(
    (item: ClaimItem) => {
      const list = SUGGESTED_ADDITIONS[roomName] ?? [];
      return list.some((row) => {
        const opt = row.mid;
        return (
          item.source === "bundle" &&
          norm(item.description) === norm(opt.title) &&
          Math.abs(item.unit_cost - opt.price) < 0.01
        );
      });
    },
    [roomName]
  );

  const bundleOnlyExtras = useMemo(
    () => extraRoomItems.filter((i) => !matchesSuggestionMid(i)),
    [extraRoomItems, matchesSuggestionMid]
  );

  function flashQtySaved(key: string) {
    setQtyFlashKey(key);
    window.setTimeout(() => setQtyFlashKey(null), 1000);
  }

  /** Replace room items in session — full room list */
  async function saveRoomItems(newRoomItems: ClaimItem[]) {
    if (!session?.claim_items) return;
    const rest = session.claim_items.filter((i) => i.room !== roomName);
    const nextClaim = [...rest, ...newRoomItems];
    await saveSession({ claim_items: nextClaim }, sessionId);
    setSession((prev) => (prev ? { ...prev, claim_items: nextClaim } : prev));
    setItems(newRoomItems);
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

  const claimLineForSuggestion = useCallback(
    (row: SuggestedAdditionRow) => {
      const opt = row.mid;
      return items.find(
        (i) =>
          i.room === roomName &&
          i.source === "bundle" &&
          norm(i.description) === norm(opt.title) &&
          Math.abs(i.unit_cost - opt.price) < 0.01
      );
    },
    [items, roomName]
  );

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

  const sliderValue = bundleSnapValues[Math.min(sliderSnapIndex, bundleSnapValues.length - 1)] ?? 0;
  const closestBundle = useMemo(() => {
    if (!roomName || !sliderValue) return null;
    return BUNDLES_DATA.filter((b) => b.room === roomName && b.total_value === sliderValue)[0] ?? null;
  }, [roomName, sliderValue]);

  useEffect(() => {
    if (closestBundle) {
      setBundleChecks(closestBundle.items.map(() => true));
    } else {
      setBundleChecks([]);
    }
    setBundleAddedFlash(false);
  }, [closestBundle?.bundle_code]);

  const bundleStops = useMemo(() => {
    const vals = BUNDLES_DATA.filter((b) => b.room === roomName).map((b) => b.total_value);
    return Array.from(new Set(vals)).sort((a, b) => a - b);
  }, [roomName]);
  const minBundleDisplay = bundleStops[0] ?? 0;
  const maxBundleDisplay = bundleStops[bundleStops.length - 1] ?? 0;

  const bundleSelectedTotal = useMemo(() => {
    if (!closestBundle) return 0;
    return closestBundle.items.reduce((s, bi, i) => (bundleChecks[i] ? s + bi.total : s), 0);
  }, [closestBundle, bundleChecks]);

  const bundleSelectedCount = useMemo(() => {
    if (!closestBundle) return 0;
    return bundleChecks.filter(Boolean).length;
  }, [closestBundle, bundleChecks]);

  function handleBundleAddClick() {
    if (!closestBundle || !session?.claim_items) return;
    const selected = closestBundle.items.filter((_, i) => bundleChecks[i]);
    if (selected.length === 0) return;
    const pairs = findBundleSingletonConflicts(closestBundle.room, selected, items);
    if (pairs.length > 0) {
      setBundleConflictModal({
        selected,
        pairs,
        resolutions: pairs.map(() => null),
      });
      return;
    }
    void executeBundleAdd(selected, [], []);
  }

  async function executeBundleAdd(
    selected: BundleItem[],
    pairs: { bundleItem: BundleItem; existing: ClaimItem }[],
    resolutions: BundleConflictResolution[]
  ) {
    if (!closestBundle || !session?.claim_items) return;
    setBundleAdding(true);
    const beforeClaim = session.claim_items;
    try {
      let claim = [...beforeClaim];
      const toAdd: BundleItem[] = [];

      for (const bi of selected) {
        const sig = bundleItemSig(bi);
        const idx = pairs.findIndex((p) => bundleItemSig(p.bundleItem) === sig);
        if (idx < 0) {
          toAdd.push(bi);
          continue;
        }
        const r = resolutions[idx];
        if (r === "skip") continue;
        if (r === "replace") {
          const ex = pairs[idx].existing;
          claim = claim.filter((c) => !sameClaimLine(c, ex));
        }
        toAdd.push(bi);
      }

      const incoming: ClaimItem[] = toAdd.map((bi) => ({
        room: closestBundle.room,
        description: bi.description,
        brand: bi.brand,
        model: "",
        qty: bi.qty,
        age_years: 0,
        age_months: 0,
        condition: "New",
        unit_cost: bi.unit_cost,
        category: bi.category,
        source: "bundle",
      }));

      if (incoming.length === 0) {
        setBundleConflictModal(null);
        setToast("Nothing added — overlapping items were skipped.");
        return;
      }

      const merged = mergeClaimIncoming(claim, incoming, "bundle");
      const totalVal = incoming.reduce((s, i) => s + i.unit_cost * i.qty, 0);

      const { error: accErr } = await supabase.from("bundle_decisions").upsert(
        {
          bundle_code: closestBundle.bundle_code,
          room: closestBundle.room,
          bundle_name: closestBundle.name,
          action: "partial_accept",
          items: selected as BundleItem[],
          total_value: selected.reduce((s, i) => s + i.total, 0),
          note: null,
        },
        { onConflict: "bundle_code" }
      );
      if (accErr) console.warn("bundle_decisions partial_accept blocked:", accErr.message);

      await saveSession({ claim_items: merged }, sessionId);
      setSession((prev) => (prev ? { ...prev, claim_items: merged } : prev));
      setItems(merged.filter((i) => i.room === roomName));
      fireUpgradeReward(beforeClaim, merged, totalVal);
      setToast(`Added ${incoming.length} item${incoming.length !== 1 ? "s" : ""} from bundle`);
      setBundleAddedFlash(true);
      window.setTimeout(() => setBundleAddedFlash(false), 2500);
      setBundleConflictModal(null);
    } finally {
      setBundleAdding(false);
    }
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
                  <dt className="flex items-center gap-1 text-[#6B7280]">
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
                <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900">Upgrade what you have</h2>
                <p className="mt-1 text-sm text-[#6B7280]">Click Upgrade on any item to see options</p>
              </div>

              {upgradeItems.length === 0 ? (
                <p className="px-5 py-8 text-sm text-[#6B7280] md:px-6">
                  No upgrade candidates in this room (art and small decor are handled elsewhere).
                </p>
              ) : (
                <div>
                  {upgradeItems.map((item, idx) => {
                    const lk = lockKeyForItem(item);
                    const locked = lockedKeys.includes(lk);
                    const rowKey = lk;
                    const cacheHas =
                      cachedDescs.has(norm(item.description)) ||
                      cachedDescs.has(norm(item.pre_upgrade_item?.description ?? ""));
                    const upgraded = item.source === "upgrade" && !!item.pre_upgrade_item;
                    const pre = item.pre_upgrade_item;
                    const origUnit = pre?.unit_cost ?? item.unit_cost;
                    const isOpen = openUpgradeKey === rowKey;
                    const rowBg = locked
                      ? "bg-blue-50/40"
                      : upgraded
                        ? "bg-emerald-50/30"
                        : "bg-white";

                    return (
                      <div
                        key={`${generateItemId(item)}-${idx}`}
                        className={`border-b border-gray-100 transition-colors duration-300 last:border-b-0 ${rowBg}`}
                      >
                        <div className="flex min-h-[72px] flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6">
                          <div className="min-w-0 flex-1">
                            {upgraded && pre ? (
                              <>
                                <p className="text-[17px] text-[#6B7280] line-through [overflow-wrap:anywhere]">
                                  {pre.description}{" "}
                                  <span className="font-semibold tabular-nums">{formatCurrency(pre.unit_cost)}</span>
                                </p>
                                <p className="mt-2 text-[17px] font-bold text-gray-900 [overflow-wrap:anywhere]">{item.description}</p>
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
                                    <button
                                      type="button"
                                      disabled={locked || isSaving}
                                      onClick={() => {
                                        setEditingAgeKey(lk);
                                        setAgeDraft(String(item.age_years ?? 0));
                                      }}
                                      className="text-base font-bold text-[#2563EB] underline decoration-blue-200 underline-offset-2 hover:decoration-[#2563EB] disabled:opacity-40"
                                    >
                                      {!item.age_years || item.age_years < 1
                                        ? "New / < 1 year"
                                        : `${item.age_years} years old`}
                                    </button>
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
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                  <p className="text-[17px] font-semibold text-gray-900 [overflow-wrap:anywhere]">{item.description}</p>
                                  {item.brand ? (
                                    <span className="shrink-0 text-sm text-[#6B7280]">{item.brand}</span>
                                  ) : null}
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
                                    <button
                                      type="button"
                                      disabled={locked || isSaving}
                                      onClick={() => {
                                        setEditingAgeKey(lk);
                                        setAgeDraft(String(item.age_years ?? 0));
                                      }}
                                      className="text-base font-bold text-[#2563EB] underline decoration-blue-200 underline-offset-2 hover:decoration-[#2563EB] disabled:opacity-40"
                                    >
                                      {!item.age_years || item.age_years < 1
                                        ? "New / < 1 year"
                                        : `${item.age_years} years old`}
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                            {!upgraded ? (
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
                            <LockButton locked={locked} onToggle={() => toggleLock(lk)} />
                          </div>
                        </div>

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
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {bundleOnlyExtras.length > 0 ? (
              <section className="mt-10 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm md:p-6">
                <h3 className="text-sm font-semibold text-gray-900">Added from bundles (this room)</h3>
                <p className="mt-1 text-xs text-[#6B7280]">Adjust quantity or age for lines that came from a bundle.</p>
                <ul className="mt-4 divide-y divide-gray-100">
                  {bundleOnlyExtras.map((item, idx) => {
                    const xk = `bundle-extra-${lockKeyForItem(item)}-${idx}`;
                    return (
                      <li key={xk} className="flex flex-wrap items-center gap-3 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-medium text-gray-900 [overflow-wrap:anywhere]">{item.description}</p>
                          <p className="mt-1 text-[13px] text-[#6B7280]">{item.brand || "—"}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[15px] font-bold tabular-nums text-[#2563EB]">{formatCurrency(item.unit_cost)}</span>
                          <QtyAdjuster
                            qty={item.qty}
                            disabled={isSaving}
                            onChange={(q) => void updateItemQty(item, q)}
                          />
                          {qtyFlashKey === lockKeyForItem(item) ? (
                            <span className="text-xs font-medium text-[#16A34A]">Qty updated</span>
                          ) : null}
                          {editingAgeKey === xk ? (
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
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => {
                                setEditingAgeKey(xk);
                                setAgeDraft(String(item.age_years ?? 0));
                              }}
                              className="text-sm font-bold text-[#2563EB] underline underline-offset-2 disabled:opacity-40"
                            >
                              {!item.age_years || item.age_years < 1
                                ? "New / < 1 year"
                                : `${item.age_years} years old`}
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            <section className="mt-12">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-900">Add to this room</h2>
              <p className="mt-1 text-sm text-[#6B7280]">Add items that weren&apos;t in your original claim</p>

              <div className="mt-8 grid gap-10 md:grid-cols-2 md:gap-12">
                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Suggested additions</h3>
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
                              const line = claimLineForSuggestion(row);
                              const suggAgeKey = `sugg-age-${row.id}`;
                              return (
                                <li key={row.id} className="flex min-h-[56px] flex-wrap items-center gap-3 px-4 py-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                                      <p className="text-[15px] font-medium text-gray-900 [overflow-wrap:anywhere]">{opt.title}</p>
                                      <span className="text-[15px] font-bold tabular-nums text-[#2563EB]">
                                        {formatCurrency(added && line ? line.unit_cost : opt.price)}
                                      </span>
                                      {added && line ? (
                                        <>
                                          <QtyAdjuster
                                            qty={line.qty}
                                            disabled={isSaving}
                                            onChange={(q) => void updateItemQty(line, q)}
                                          />
                                          {qtyFlashKey === lockKeyForItem(line) ? (
                                            <span className="text-xs font-medium text-[#16A34A]">Qty updated</span>
                                          ) : null}
                                          <span className="text-[#6B7280]">·</span>
                                          {editingAgeKey === suggAgeKey ? (
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
                                                    line,
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
                                            <button
                                              type="button"
                                              disabled={isSaving}
                                              onClick={() => {
                                                setEditingAgeKey(suggAgeKey);
                                                setAgeDraft(String(line.age_years ?? 0));
                                              }}
                                              className="text-base font-bold text-[#2563EB] underline decoration-blue-200 underline-offset-2 disabled:opacity-40"
                                            >
                                              {!line.age_years || line.age_years < 1
                                                ? "New / < 1 year"
                                                : `${line.age_years} years old`}
                                            </button>
                                          )}
                                        </>
                                      ) : null}
                                    </div>
                                    <p className="mt-1 text-[13px] text-[#6B7280]">
                                      {opt.brand ?? "—"}
                                      {opt.url ? (
                                        <>
                                          {" "}
                                          ·{" "}
                                          <a
                                            href={opt.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-[#2563EB] underline-offset-2 hover:underline"
                                          >
                                            View
                                          </a>
                                        </>
                                      ) : null}
                                    </p>
                                  </div>
                                  <div className="flex shrink-0 items-center">
                                    <button
                                      type="button"
                                      disabled={isSaving}
                                      onClick={() => void handleToggleSuggestionMid(row)}
                                      className={`flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold transition-all duration-200 disabled:opacity-40 ${
                                        added
                                          ? "bg-[#16A34A] text-white shadow-sm"
                                          : "border-2 border-[#2563EB] bg-white text-[#2563EB] hover:bg-blue-50"
                                      }`}
                                      aria-label={added ? "Remove from claim" : "Add to claim"}
                                    >
                                      {added ? "✓" : "+"}
                                    </button>
                                  </div>
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
                          {suggestExpand ? "Show fewer suggestions ▲" : "Show more suggestions ▼"}
                        </button>
                      ) : null}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-gray-800">Bundles</h3>
                  {bundleStops.length === 0 ? (
                    <p className="mt-4 text-sm text-[#6B7280]">No bundles defined for this room.</p>
                  ) : (
                    <div className="mt-4 space-y-4">
                      <p className="text-center text-xs text-[#6B7280]">← drag to explore bundles →</p>
                      <div className="flex flex-wrap items-center justify-center gap-2 text-xs tabular-nums text-[#6B7280] sm:text-sm">
                        <span>Budget: {formatCurrency(minBundleDisplay)}</span>
                        <input
                          type="range"
                          min={0}
                          max={Math.max(0, bundleSnapValues.length - 1)}
                          step={1}
                          value={Math.min(sliderSnapIndex, bundleSnapValues.length - 1)}
                          onChange={(e) => setSliderSnapIndex(Number(e.target.value))}
                          className="mx-1 h-2 w-full max-w-[240px] flex-1 accent-[#2563EB] sm:max-w-none"
                        />
                        <span>{formatCurrency(maxBundleDisplay)}</span>
                      </div>

                      <div className="rounded-2xl bg-white p-6 shadow-md transition-shadow duration-200">
                        {closestBundle &&
                        bundleChecks.length > 0 &&
                        bundleChecks.length === closestBundle.items.length ? (
                          <>
                            <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 pb-4">
                              <h4 className="text-base font-semibold text-gray-900 [overflow-wrap:anywhere]">{closestBundle.name}</h4>
                              <span className="text-base font-bold tabular-nums text-gray-900">
                                {formatCurrency(closestBundle.total_value)}
                              </span>
                            </div>
                            <ul className="mt-2 divide-y divide-gray-100">
                              {closestBundle.items.map((bi, i) => (
                                <li key={`${bi.description}-${i}`} className="flex min-h-[44px] items-center gap-3 py-2">
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 shrink-0 rounded border-gray-300 accent-[#2563EB]"
                                    checked={!!bundleChecks[i]}
                                    onChange={() =>
                                      setBundleChecks((prev) => {
                                        const next = [...prev];
                                        next[i] = !next[i];
                                        return next;
                                      })
                                    }
                                  />
                                  <span className="min-w-0 flex-1 text-[15px] text-gray-900 [overflow-wrap:anywhere]">
                                    {bi.brand ? `${bi.brand} ` : ""}
                                    {bi.description}
                                  </span>
                                  <span className="shrink-0 text-[15px] font-bold tabular-nums text-gray-900">{formatCurrency(bi.total)}</span>
                                </li>
                              ))}
                            </ul>
                            <div className="mt-4 border-t border-gray-200 pt-4 text-sm font-semibold text-gray-800">
                              Selected: {bundleSelectedCount} item{bundleSelectedCount !== 1 ? "s" : ""} ·{" "}
                              <span className="tabular-nums">{formatCurrency(bundleSelectedTotal)}</span>
                            </div>
                            <button
                              type="button"
                              disabled={bundleAdding || bundleSelectedCount === 0 || isSaving}
                              onClick={() => handleBundleAddClick()}
                              className={`mt-5 flex h-12 w-full items-center justify-center rounded-xl text-base font-bold transition-all duration-300 md:h-14 md:text-base ${
                                bundleAddedFlash
                                  ? "bg-[#16A34A] text-white"
                                  : "bg-[#2563EB] text-white hover:bg-blue-700"
                              } disabled:opacity-40`}
                            >
                              {bundleAdding ? "…" : bundleAddedFlash ? "✓ Added" : "Add Selected Items →"}
                            </button>
                          </>
                        ) : (
                          <p className="py-8 text-center text-sm text-[#6B7280]">
                            Move the slider to select a bundle for this room.
                          </p>
                        )}
                      </div>
                      <Link
                        href={`/review/bundles/${roomSlug}`}
                        className="inline-block text-sm font-semibold text-[#2563EB] hover:underline"
                      >
                        Browse all bundles →
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <p className="mt-10 text-center text-sm text-[#6B7280]">
              Art and decorative items are managed separately in the Art Collection section.
            </p>
          </main>
        </>
      )}

      {showRoomChrome ? (
        <footer className="fixed bottom-0 inset-x-0 z-30 h-16 border-t border-gray-200 bg-white shadow-lg">
          <div className="mx-auto flex h-full max-w-[1100px] items-center justify-between gap-3 px-4 md:gap-6 md:px-8">
            <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-1 text-xs tabular-nums text-[#6B7280] md:flex md:text-sm">
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
            <div className="flex min-w-0 flex-1 items-center md:hidden">
              <span className="truncate text-sm tabular-nums">
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

      {bundleConflictModal ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
          <div
            className="max-h-[min(90vh,520px)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bundle-conflict-title"
          >
            <h2 id="bundle-conflict-title" className="text-lg font-bold text-gray-900">
              Some items in this bundle overlap with what you already have:
            </h2>
            <div className="mt-4 space-y-6">
              {bundleConflictModal.pairs.map((p, i) => (
                <div key={i} className="border-t border-gray-100 pt-4 first:border-t-0 first:pt-0">
                  <p className="text-sm text-[#6B7280]">
                    You have:{" "}
                    <span className="font-semibold text-gray-900">
                      {p.existing.brand ? `${p.existing.brand} ` : ""}
                      {p.existing.description}
                    </span>{" "}
                    <span className="tabular-nums">({formatCurrency(p.existing.unit_cost * p.existing.qty)})</span>
                  </p>
                  <p className="mt-1 text-sm text-[#6B7280]">
                    Bundle has:{" "}
                    <span className="font-semibold text-gray-900">
                      {p.bundleItem.brand ? `${p.bundleItem.brand} ` : ""}
                      {p.bundleItem.description}
                    </span>{" "}
                    <span className="tabular-nums">({formatCurrency(p.bundleItem.total)})</span>
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {(["replace", "both", "skip"] as const).map((choice) => (
                      <button
                        key={choice}
                        type="button"
                        onClick={() =>
                          setBundleConflictModal((prev) => {
                            if (!prev) return prev;
                            const next = [...prev.resolutions];
                            next[i] = choice;
                            return { ...prev, resolutions: next };
                          })
                        }
                        className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors sm:text-sm ${
                          bundleConflictModal.resolutions[i] === choice
                            ? "border-[#2563EB] bg-blue-50 text-[#2563EB]"
                            : "border-gray-200 text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {choice === "replace"
                          ? "Replace existing"
                          : choice === "both"
                            ? "Add both"
                            : "Skip"}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700"
                onClick={() => setBundleConflictModal(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  bundleAdding ||
                  bundleConflictModal.resolutions.some((r) => r == null)
                }
                onClick={() =>
                  void executeBundleAdd(
                    bundleConflictModal.selected,
                    bundleConflictModal.pairs,
                    bundleConflictModal.resolutions as BundleConflictResolution[]
                  )
                }
                className="rounded-lg bg-[#2563EB] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                Continue
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
                  upgradeItems.length > 0
                    ? `This is the ${roomName}!\nYou have ${upgradeItems.length} upgradeable ${upgradeItems.length === 1 ? "item" : "items"} worth ${formatCurrency(upgradeSubtotal)}.\nLet's see what we can upgrade! ✨`
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
