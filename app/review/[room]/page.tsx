"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import AniGuide from "../../components/AniGuide";
import SpeechBubble from "../../components/SpeechBubble";
import { dispatchUpgradeReward } from "../../components/UpgradeRewardToast";
import { BUNDLES_DATA } from "../../lib/bundles-data";
import { CLAIM_GOAL_DEFAULT, DEFAULT_ROOM_TARGETS } from "../../lib/room-targets";
import { readRoomGoal, writeRoomGoal } from "../../lib/room-goals";
import { loadSession, saveSession, SessionData } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { ClaimItem } from "../../lib/types";
import { useClaimMode } from "../../lib/useClaimMode";
import { generateItemId, slugify, formatCurrency } from "../../lib/utils";
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

/** Persisted array of stable row keys — see lockKeyForItem / lockKeyForSuggestion */
const LS_LOCKED = "lockedItems";

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

// ── Types ─────────────────────────────────────────────────────────────────────

export type UpgradeOption = {
  label: string;
  price: number;
  title: string;
  brand: string;
  model: string;
  retailer: string;
  url: string;
};

type UpgradeProduct = {
  title: string;
  brand: string;
  model: string;
  price: number;
  retailer: string;
  url: string;
};

// ── UI bits ───────────────────────────────────────────────────────────────────

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
      className="shrink-0 rounded-lg border border-gray-200 p-2 text-lg leading-none hover:bg-gray-50"
      title={locked ? "Unlock row" : "Lock row"}
      aria-pressed={locked}
    >
      {locked ? "🔒" : "🔓"}
    </button>
  );
}

// ── Right column: existing item + cache ────────────────────────────────────────

function ExistingUpgradePanel({
  item,
  locked,
  cacheHas,
  onApply,
}: {
  item: ClaimItem;
  locked: boolean;
  cacheHas: boolean;
  onApply: (option: UpgradeOption) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ mid: UpgradeProduct; premium: UpgradeProduct } | null>(null);
  const [customDesc, setCustomDesc] = useState("");
  const [customPrice, setCustomPrice] = useState("");
  const [applying, setApplying] = useState<"mid" | "premium" | "custom" | null>(null);

  const baseUnit =
    item.source === "upgrade" && item.pre_upgrade_item ? item.pre_upgrade_item.unit_cost : item.unit_cost;

  useEffect(() => {
    setCustomDesc(item.description);
  }, [item.description]);

  useEffect(() => {
    if (!cacheHas || locked) return;
    let cancelled = false;
    const descForApi =
      item.source === "upgrade" ? item.description : item.pre_upgrade_item?.description ?? item.description;
    const priceForApi =
      item.source === "upgrade" ? item.unit_cost : item.pre_upgrade_item?.unit_cost ?? item.unit_cost;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/search-upgrade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_description: descForApi,
            brand: item.brand || "",
            current_price: priceForApi,
            category: item.category || "",
          }),
        });
        if (!res.ok) throw new Error("fetch");
        const j = (await res.json()) as { mid: UpgradeProduct; premium: UpgradeProduct };
        if (!cancelled) setData(j);
      } catch {
        if (!cancelled) setData(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    cacheHas,
    locked,
    item.brand,
    item.category,
    item.description,
    item.unit_cost,
    item.source,
    item.pre_upgrade_item?.description,
    item.pre_upgrade_item?.unit_cost,
  ]);

  const customOk = customDesc.trim().length > 0 && parseFloat(customPrice) > 0;

  function rowClass(active: boolean) {
    return `flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2.5 text-base transition-colors duration-300 ${
      active ? "border-blue-400 bg-blue-50" : "border-gray-200 bg-white/80"
    }`;
  }

  const midSelected =
    item.source === "upgrade" && data && Math.abs(item.unit_cost - data.mid.price) < 0.01;
  const premSelected =
    item.source === "upgrade" && data && Math.abs(item.unit_cost - data.premium.price) < 0.01;

  if (locked) {
    return (
      <div className="rounded-xl border border-blue-100 bg-[#EFF6FF] p-4 text-base text-gray-600">
        Locked — unlock to change upgrade options.
      </div>
    );
  }

  if (!cacheHas) return null;

  return (
    <div className="min-h-[120px] space-y-3 rounded-xl border border-gray-200 bg-[#F0F7FF] p-4 text-base">
      {loading ? (
        <div className="flex items-center gap-2 py-6 text-gray-500">
          <SmallSpinner /> Loading suggestions…
        </div>
      ) : (
        <>
          {item.source === "upgrade" && item.pre_upgrade_item && (
            <p className="border-b border-gray-200 pb-2 text-sm text-gray-600">
              Pick another option below, or <span className="font-medium">revert</span> on the left.
            </p>
          )}

          {data && (
            <>
              <div className={rowClass(!!midSelected)}>
                <span className="shrink-0 font-bold text-gray-700">Mid:</span>
                <span className="min-w-0 flex-1 truncate font-medium text-gray-900" title={data.mid.title}>
                  {data.mid.title}
                </span>
                <span className="shrink-0 font-bold tabular-nums">{formatCurrency(data.mid.price)}</span>
                <span className="shrink-0 font-bold text-green-600 tabular-nums">
                  +{formatCurrency((data.mid.price - baseUnit) * item.qty)}
                </span>
                <a
                  href={data.mid.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm font-semibold text-blue-600 underline"
                >
                  View ↗
                </a>
                <button
                  type="button"
                  disabled={applying !== null}
                  onClick={() => {
                    setApplying("mid");
                    void onApply({
                      label: "Mid",
                      price: data.mid.price,
                      title: data.mid.title,
                      brand: data.mid.brand,
                      model: data.mid.model,
                      retailer: data.mid.retailer,
                      url: data.mid.url,
                    }).finally(() => setApplying(null));
                  }}
                  className="shrink-0 rounded-lg bg-[#2563EB] px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  {applying === "mid" ? "…" : "Select ↗"}
                </button>
              </div>
              <div className={rowClass(!!premSelected)}>
                <span className="shrink-0 font-bold text-gray-700">Premium:</span>
                <span className="min-w-0 flex-1 truncate font-medium text-gray-900" title={data.premium.title}>
                  {data.premium.title}
                </span>
                <span className="shrink-0 font-bold tabular-nums">{formatCurrency(data.premium.price)}</span>
                <span className="shrink-0 font-bold text-green-600 tabular-nums">
                  +{formatCurrency((data.premium.price - baseUnit) * item.qty)}
                </span>
                <a
                  href={data.premium.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm font-semibold text-blue-600 underline"
                >
                  View ↗
                </a>
                <button
                  type="button"
                  disabled={applying !== null}
                  onClick={() => {
                    setApplying("premium");
                    void onApply({
                      label: "Premium",
                      price: data.premium.price,
                      title: data.premium.title,
                      brand: data.premium.brand,
                      model: data.premium.model,
                      retailer: data.premium.retailer,
                      url: data.premium.url,
                    }).finally(() => setApplying(null));
                  }}
                  className="shrink-0 rounded-lg bg-[#2563EB] px-3 py-1.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-40"
                >
                  {applying === "premium" ? "…" : "Select ↗"}
                </button>
              </div>
            </>
          )}

          <div className={rowClass(false)}>
            <span className="shrink-0 font-bold text-gray-700">Custom:</span>
            <input
              type="text"
              value={customDesc}
              onChange={(e) => setCustomDesc(e.target.value)}
              className="min-w-[120px] flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
              placeholder="Description"
            />
            <div className="flex shrink-0 items-center gap-1">
              <span className="text-gray-400">$</span>
              <input
                type="number"
                min={0}
                step="any"
                value={customPrice}
                onChange={(e) => setCustomPrice(e.target.value)}
                className="w-24 rounded-lg border border-gray-200 px-2 py-1.5 text-sm tabular-nums"
                placeholder="Price"
              />
            </div>
            <button
              type="button"
              disabled={applying !== null || !customOk}
              onClick={() => {
                setApplying("custom");
                void onApply({
                  label: "Custom",
                  price: parseFloat(customPrice),
                  title: customDesc.trim(),
                  brand: item.brand,
                  model: "",
                  retailer: "",
                  url: "",
                }).finally(() => setApplying(null));
              }}
              className="shrink-0 rounded-lg bg-[#16A34A] px-3 py-1.5 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-40"
            >
              {applying === "custom" ? "…" : "Apply"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function NoCacheUpgradePanel({
  locked,
  item,
  onAddCustom,
}: {
  locked: boolean;
  item: ClaimItem;
  onAddCustom: (price: number, title: string, brand: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [title, setTitle] = useState(item.description);
  const [brand, setBrand] = useState(item.brand || "");
  const [saving, setSaving] = useState(false);

  if (locked) {
    return (
      <div className="rounded-xl border border-blue-100 bg-[#EFF6FF] p-4 text-base text-gray-600">
        Locked — unlock to add a custom replacement.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-gray-300 bg-[#F0F7FF] p-4 text-base text-gray-600">
      <p className="mb-3">(no upgrade available)</p>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-[#2563EB] font-semibold underline"
        >
          + Add custom replacement
        </button>
      ) : (
        <div className="space-y-2">
          <input className="w-full rounded-lg border px-3 py-2" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Description" />
          <input className="w-full rounded-lg border px-3 py-2" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand (optional)" />
          <div className="flex gap-2 items-center">
            <span>$</span>
            <input type="number" className="flex-1 rounded-lg border px-3 py-2" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Price" />
          </div>
          <button
            type="button"
            disabled={saving || !title.trim() || parseFloat(price) <= 0}
            onClick={() => {
              setSaving(true);
              void onAddCustom(parseFloat(price), title.trim(), brand.trim()).finally(() => setSaving(false));
            }}
            className="rounded-lg bg-[#16A34A] px-4 py-2 font-bold text-white disabled:opacity-40"
          >
            Save replacement
          </button>
        </div>
      )}
    </div>
  );
}

function SuggestedAdditionPanel({
  row,
  locked,
  onAdd,
  onSkip,
}: {
  row: SuggestedAdditionRow;
  locked: boolean;
  onAdd: (option: "mid" | "premium") => Promise<void>;
  onSkip: () => void;
}) {
  const [busy, setBusy] = useState<"mid" | "premium" | null>(null);

  if (locked) {
    return (
      <div className="rounded-xl border border-blue-100 bg-[#EFF6FF] p-4 text-base text-gray-600">Locked</div>
    );
  }

  function rowCls() {
    return "flex flex-wrap items-center gap-2 rounded-xl border border-gray-200 bg-white/80 px-3 py-2.5 text-base";
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-[#F0F7FF] p-4 text-base">
      <div className={rowCls()}>
        <span className="shrink-0 font-bold text-gray-700">Mid:</span>
        <span className="min-w-0 flex-1 truncate font-medium" title={row.mid.title}>
          {row.mid.title}
        </span>
        <span className="shrink-0 font-bold tabular-nums">{formatCurrency(row.mid.price)}</span>
        <span className="shrink-0 font-bold text-green-600 tabular-nums">+{formatCurrency(row.mid.price)}</span>
        <a href={row.mid.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-600 underline">
          View ↗
        </a>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            setBusy("mid");
            void onAdd("mid").finally(() => setBusy(null));
          }}
          className="rounded-lg bg-[#2563EB] px-3 py-1.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy === "mid" ? "…" : "Select ↗"}
        </button>
      </div>
      <div className={rowCls()}>
        <span className="shrink-0 font-bold text-gray-700">Premium:</span>
        <span className="min-w-0 flex-1 truncate font-medium" title={row.premium.title}>
          {row.premium.title}
        </span>
        <span className="shrink-0 font-bold tabular-nums">{formatCurrency(row.premium.price)}</span>
        <span className="shrink-0 font-bold text-green-600 tabular-nums">+{formatCurrency(row.premium.price)}</span>
        <a href={row.premium.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-blue-600 underline">
          View ↗
        </a>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            setBusy("premium");
            void onAdd("premium").finally(() => setBusy(null));
          }}
          className="rounded-lg bg-[#2563EB] px-3 py-1.5 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy === "premium" ? "…" : "Select ↗"}
        </button>
      </div>
      <button type="button" onClick={onSkip} className="text-sm text-gray-500 underline">
        Skip this row
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

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
    if (!guided || items.length === 0 || baselineOriginalRoomRef.current !== null) return;
    const o = items
      .filter((i) => !i.source || i.source === "original")
      .reduce((s, i) => s + i.qty * i.unit_cost, 0);
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
        setRoomTarget(readRoomGoal(sessionId, fallbackName) ?? def);
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
    setRoomTarget(storedGoal ?? def);

    const descriptions = roomItems.map((i) => i.pre_upgrade_item?.description ?? i.description);
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

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => b.unit_cost - a.unit_cost),
    [items]
  );

  const missingSuggestions = useMemo(() => {
    const list = SUGGESTED_ADDITIONS[roomName] ?? [];
    return list.filter(
      (s) => !suggestionAlreadyInClaim(items, s.label) && !skippedSuggestions.has(s.id)
    );
  }, [roomName, items, skippedSuggestions]);

  const roomTotal = useMemo(() => items.reduce((s, i) => s + i.qty * i.unit_cost, 0), [items]);
  const originalSub = useMemo(
    () =>
      items
        .filter((i) => !i.source || i.source === "original")
        .reduce((s, i) => s + i.qty * i.unit_cost, 0),
    [items]
  );
  const upgradedSub = useMemo(
    () => items.filter((i) => i.source === "upgrade").reduce((s, i) => s + i.qty * i.unit_cost, 0),
    [items]
  );
  const addedSub = useMemo(
    () => items.filter((i) => i.source === "bundle").reduce((s, i) => s + i.qty * i.unit_cost, 0),
    [items]
  );

  const progressPct = roomTarget > 0 ? Math.min(100, Math.round((roomTotal / roomTarget) * 100)) : 0;
  const gapRemaining = Math.max(0, roomTarget - roomTotal);
  const stillNeeded = Math.max(0, roomTarget - roomTotal);

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
  const lockKeyForSuggestion = useCallback((id: string) => `${roomName}|suggested|${id}`, [roomName]);

  function toggleLock(key: string) {
    const next = lockedKeys.includes(key) ? lockedKeys.filter((k) => k !== key) : [...lockedKeys, key];
    setLockedKeys(next);
    writeLocked(next);
  }

  function isItemLocked(item: ClaimItem) {
    return lockedKeys.includes(lockKeyForItem(item));
  }
  function isSuggestionLocked(id: string) {
    return lockedKeys.includes(lockKeyForSuggestion(id));
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

  function saveTargetFromEdit() {
    const v = parseInt(targetInput.replace(/\D/g, ""), 10);
    if (!v || v < 0) return;
    setRoomTarget(v);
    writeRoomGoal(sessionId, roomName, v);
    setEditTarget(false);
  }

  const maxSnap = bundleSnapValues[bundleSnapValues.length - 1] ?? 0;
  const sliderValue = bundleSnapValues[Math.min(sliderSnapIndex, bundleSnapValues.length - 1)] ?? 0;
  const closestBundle = useMemo(() => {
    if (!roomName || !sliderValue) return null;
    return BUNDLES_DATA.filter((b) => b.room === roomName && b.total_value === sliderValue)[0] ?? null;
  }, [roomName, sliderValue]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-gray-500 text-base">
        <SmallSpinner />
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-white pb-56">
      <header className="border-b border-gray-200 bg-white px-4 sm:px-6 py-4">
        <Link href="/review" className="text-base text-[#2563EB] font-medium hover:underline">
          ← All Rooms
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="text-2xl font-bold text-gray-900">{roomName || "Room"}</h1>
          {isSaving && <SmallSpinner />}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-base text-gray-700">
          <span>
            Target: <span className="font-bold tabular-nums">{formatCurrency(roomTarget)}</span>
          </span>
          <span className="text-gray-300">·</span>
          <span>
            Current: <span className="font-bold tabular-nums">{formatCurrency(roomTotal)}</span>
          </span>
          <button
            type="button"
            className="ml-1 text-xl leading-none"
            onClick={() => {
              setTargetInput(String(roomTarget));
              setEditTarget(true);
            }}
            aria-label="Edit target"
          >
            ✏️
          </button>
        </div>
        {editTarget && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              className="rounded-lg border border-gray-300 px-3 py-2 text-base min-w-[140px]"
              value={targetInput}
              onChange={(e) => setTargetInput(e.target.value)}
              placeholder="350000"
            />
            <button type="button" onClick={saveTargetFromEdit} className="rounded-lg bg-[#2563EB] px-4 py-2 text-base font-bold text-white">
              Save
            </button>
            <button type="button" onClick={() => setEditTarget(false)} className="text-base text-gray-500">
              Cancel
            </button>
          </div>
        )}
        <div className="mt-4">
          <p className="text-base text-gray-600 mb-1">Progress: {progressPct}%</p>
          <div className="h-3 w-full max-w-xl rounded-full bg-gray-200 overflow-hidden">
            <div
              className="h-full bg-[#2563EB] transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center p-12">
          <SmallSpinner />
        </div>
      ) : !roomName || !items.length && !missingSuggestions.length ? (
        <div className="flex-1 p-8 text-center text-base text-gray-500">
          No items for this room.
          <Link href="/review" className="block mt-4 text-[#2563EB]">
            ← All rooms
          </Link>
        </div>
      ) : (
        <>
          <div className="flex-1 px-4 sm:px-6 py-6 w-full max-w-[1400px] mx-auto">
            <div className="hidden md:grid md:grid-cols-2 border-b-2 border-gray-300 bg-gray-50">
              <div className="text-base font-bold uppercase tracking-wide py-4 px-4 border-r border-gray-200">
                What you have
              </div>
              <div className="text-base font-bold uppercase tracking-wide py-4 px-4 bg-[#F0F7FF]">
                Suggested upgrade →
              </div>
            </div>

            <div className="divide-y divide-gray-200 border-x border-b border-gray-200 rounded-b-lg overflow-hidden">
              {sortedItems.map((item, idx) => {
                const lk = lockKeyForItem(item);
                const locked = lockedKeys.includes(lk);
                const cacheHas =
                  cachedDescs.has(norm(item.description)) ||
                  cachedDescs.has(norm(item.pre_upgrade_item?.description ?? ""));
                const upgraded = item.source === "upgrade" && item.previous_unit_cost != null;
                const rowBg = locked ? "bg-[#EFF6FF]" : upgraded ? "bg-green-50/90" : "bg-white";

                return (
                  <div
                    key={`${generateItemId(item)}-${idx}`}
                    className={`flex flex-col md:grid md:grid-cols-2 ${rowBg}`}
                  >
                    <div className="border-b md:border-b-0 md:border-r border-gray-200 p-4 py-5 text-base min-h-[100px] md:bg-white/80">
                      <p className="md:hidden font-bold uppercase tracking-wide text-gray-500 text-sm mb-3">What you have</p>
                      <div className="flex justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          {upgraded && item.pre_upgrade_item ? (
                            <>
                              <p className="line-through text-gray-400">
                                {item.pre_upgrade_item.description}{" "}
                                <span className="tabular-nums">{formatCurrency(item.previous_unit_cost!)}</span>
                              </p>
                              <p className="text-gray-500 my-1">↓</p>
                              <p className="font-bold text-gray-900">{item.description}</p>
                              <p className="text-blue-600 font-bold tabular-nums mt-1">
                                {formatCurrency(item.unit_cost)} ✓
                              </p>
                              {item.previous_unit_cost != null && (
                                <p className="mt-1 text-base font-bold text-green-600 tabular-nums">
                                  +{formatCurrency((item.unit_cost - item.previous_unit_cost) * item.qty)} added ✓
                                </p>
                              )}
                              <div className="mt-2 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  disabled={locked || isSaving}
                                  onClick={() =>
                                    document.getElementById(`upgrade-panel-${idx}`)?.scrollIntoView({ behavior: "smooth", block: "nearest" })
                                  }
                                  className="text-sm text-[#2563EB] underline disabled:opacity-40"
                                >
                                  change
                                </button>
                                <button
                                  type="button"
                                  disabled={locked || isSaving}
                                  onClick={() => void handleRevert(item)}
                                  className="text-sm text-gray-600 underline disabled:opacity-40"
                                >
                                  revert
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <p className="font-bold text-gray-900 text-lg leading-snug">{item.description}</p>
                              <p className="text-gray-600 mt-1">
                                {item.brand ? <>{item.brand} · </> : null}Qty: {item.qty}
                              </p>
                              <p className="font-semibold tabular-nums mt-2">{formatCurrency(item.unit_cost)}</p>
                            </>
                          )}
                        </div>
                        <LockButton locked={locked} onToggle={() => toggleLock(lk)} />
                      </div>
                    </div>
                    <div id={`upgrade-panel-${idx}`} className="p-4 py-5 bg-[#F0F7FF] text-base">
                      <p className="md:hidden font-bold uppercase tracking-wide text-gray-600 text-sm mb-3">Suggested upgrade →</p>
                      {cacheHas ? (
                        <ExistingUpgradePanel
                          key={`${item.description}-${item.unit_cost}-${idx}`}
                          item={item}
                          locked={locked}
                          cacheHas={cacheHas}
                          onApply={(opt) =>
                            upgraded && item.pre_upgrade_item
                              ? handleChangeUpgrade(item, opt)
                              : handleApplyUpgrade(item, opt)
                          }
                        />
                      ) : (
                        <NoCacheUpgradePanel
                          locked={locked}
                          item={item}
                          onAddCustom={async (price, title, brand) => {
                            const opt: UpgradeOption = {
                              label: "Custom",
                              price,
                              title,
                              brand,
                              model: "",
                              retailer: "",
                              url: "",
                            };
                            if (upgraded && item.pre_upgrade_item) await handleChangeUpgrade(item, opt);
                            else await handleApplyUpgrade(item, opt);
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              })}

              {missingSuggestions.map((row) => {
                const lk = lockKeyForSuggestion(row.id);
                const locked = lockedKeys.includes(lk);
                return (
                  <div key={row.id} className={`flex flex-col md:grid md:grid-cols-2 ${locked ? "bg-[#EFF6FF]" : "bg-white"}`}>
                    <div className="border-b md:border-b-0 md:border-r border-gray-200 p-4 py-5 text-base bg-gray-50/50">
                      <p className="md:hidden font-bold uppercase tracking-wide text-gray-500 text-sm mb-3">What you have</p>
                      <div className="flex justify-between gap-3">
                        <div>
                          <p className="text-gray-500 italic">(not in original claim)</p>
                          <p className="font-bold text-gray-900 mt-1 text-lg">Suggested addition</p>
                          <p className="text-gray-700 mt-1">{row.label}</p>
                        </div>
                        <LockButton locked={locked} onToggle={() => toggleLock(lk)} />
                      </div>
                    </div>
                    <div className="p-4 py-5 bg-[#F0F7FF]">
                      <p className="md:hidden font-bold uppercase tracking-wide text-gray-600 text-sm mb-3">Suggested upgrade →</p>
                      <SuggestedAdditionPanel
                        row={row}
                        locked={locked}
                        onAdd={(tier) => handleAddSuggestion(row, tier)}
                        onSkip={() => setSkippedSuggestions((s) => new Set([...s, row.id]))}
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bundle slider */}
            <section className="mt-10 rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <p className="text-base font-semibold text-gray-900">
                Gap remaining for this room: <span className="tabular-nums">{formatCurrency(gapRemaining)}</span>
              </p>
              <p className="text-base text-gray-600 mt-2 mb-4">Add more via bundles:</p>
              <div className="flex items-center gap-3 text-base tabular-nums text-gray-700 mb-2">
                <span>{formatCurrency(0)}</span>
                <input
                  type="range"
                  min={0}
                  max={Math.max(0, bundleSnapValues.length - 1)}
                  step={1}
                  value={Math.min(sliderSnapIndex, bundleSnapValues.length - 1)}
                  onChange={(e) => setSliderSnapIndex(Number(e.target.value))}
                  className="flex-1 accent-[#2563EB] h-3"
                />
                <span>{formatCurrency(maxSnap)}</span>
              </div>
              {closestBundle && (
                <p className="text-base text-gray-700 mb-2">
                  Closest bundle: <span className="font-semibold">{closestBundle.name}</span> ·{" "}
                  {formatCurrency(closestBundle.total_value)}
                </p>
              )}
              <Link
                href={`/review/bundles/${roomSlug}`}
                className="inline-flex mt-2 text-base font-bold text-[#2563EB] hover:underline"
              >
                Browse all bundles for this room →
              </Link>
            </section>
          </div>
        </>
      )}

      <footer className="fixed bottom-0 inset-x-0 z-30 border-t-2 border-gray-200 bg-white shadow-lg">
        <div className="max-w-[1400px] mx-auto px-4 py-3 text-base">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 tabular-nums sm:grid-cols-4">
            <span className="text-gray-600">Original items</span>
            <span className="text-right font-medium">{formatCurrency(originalSub)}</span>
            <span className="text-gray-600">Upgrades</span>
            <span className="text-right font-medium text-green-700">+{formatCurrency(upgradedSub)}</span>
            <span className="text-gray-600">Additions</span>
            <span className="text-right font-medium text-blue-700">+{formatCurrency(addedSub)}</span>
            <span className="text-gray-600 col-span-2 sm:col-span-1">Room total</span>
            <span className="text-right font-bold col-span-2 sm:col-span-1">
              {formatCurrency(roomTotal)} / {formatCurrency(roomTarget)}
            </span>
          </div>
          <p className="mt-2 text-base text-gray-600">
            Still needed: <span className="font-bold tabular-nums text-gray-900">{formatCurrency(stillNeeded)}</span>
          </p>
          <div className="mt-3 flex flex-wrap gap-2 justify-between">
            {prevRoom ? (
              <Link
                href={`/review/${slugify(prevRoom)}`}
                className="min-h-[44px] flex items-center rounded-xl border border-gray-200 px-4 py-2 font-medium text-gray-800"
              >
                ← Previous room
              </Link>
            ) : (
              <span />
            )}
            <Link href="/review" className="min-h-[44px] flex items-center rounded-xl bg-gray-100 px-4 py-2 font-semibold text-gray-800">
              All rooms
            </Link>
            {nextRoom ? (
              <Link
                href={`/review/${slugify(nextRoom)}${guided ? "?guided=true" : ""}`}
                className="min-h-[44px] flex items-center rounded-xl bg-[#2563EB] px-4 py-2 font-bold text-white"
              >
                {guided ? "Next Room →" : "Next room →"}
              </Link>
            ) : (
              <Link href="/review" className="min-h-[44px] flex items-center rounded-xl bg-gray-200 px-4 py-2 font-medium text-gray-700">
                Done
              </Link>
            )}
          </div>
        </div>
      </footer>

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
                text={`This is the ${roomName}!\nYou have ${items.length} items worth ${formatCurrency(roomTotal)}.\nLet's see what we can upgrade! ✨`}
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
              <SpeechBubble
                direction="right"
                visible
                text={`Room done! 🎉\n${roomName}: ${formatCurrency(baselineOriginalRoomRef.current ?? originalSub)} → ${formatCurrency(roomTotal)}`}
              />
              {(() => {
                const beforeR = baselineOriginalRoomRef.current ?? originalSub;
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
