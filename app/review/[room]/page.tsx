"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { loadSession, saveSession, SessionData, RoomSummary } from "../../lib/session";
import {
  ClaimItem,
  ItemWithTiers,
  TierKey,
  TierSuggestion,
  StoredItemTier,
} from "../../lib/types";
import { generateItemId, slugify, formatCurrency } from "../../lib/utils";

const TIER_ORDER: TierKey[] = ["keep", "entry", "mid", "premium", "ultra"];

const ROOM_CATEGORIES: Record<string, string[]> = {
  default: ["Lighting", "Artwork", "Rugs", "Storage", "Accessories", "Window Treatments"],
  kitchen: ["Small Appliances", "Cookware", "Bar & Wine", "Lighting", "Storage"],
  bedroom: ["Bedding & Linens", "Lighting", "Artwork", "Mirror", "Storage"],
  bathroom: ["Towels & Linens", "Accessories", "Mirror", "Lighting"],
  office: ["Lighting", "Storage", "Artwork", "Tech Accessories"],
  garage: ["Storage & Shelving", "Tools", "Outdoor Equipment"],
  patio: ["Outdoor Furniture", "Lighting", "Planters", "Accessories"],
};

function getRoomCategories(room: string): string[] {
  const key = room.toLowerCase();
  for (const [k, v] of Object.entries(ROOM_CATEGORIES)) {
    if (k !== "default" && key.includes(k)) return v;
  }
  return ROOM_CATEGORIES.default;
}

// ── Sub-components ──────────────────────────────────────────────────────────

function Spinner({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <svg
      className={`animate-spin text-[#2563EB] ${size === "md" ? "h-5 w-5" : "h-3.5 w-3.5"}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function PlausibilityDot({ p }: { p?: "green" | "yellow" | "red" }) {
  if (!p || p === "green") return <span className="h-2.5 w-2.5 rounded-full bg-[#16A34A] shrink-0" />;
  if (p === "yellow") return <span className="h-2.5 w-2.5 rounded-full bg-[#D97706] shrink-0" />;
  return <span className="h-2.5 w-2.5 rounded-full bg-[#DC2626] shrink-0" />;
}

function ItemSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-2.5 w-2.5 rounded-full bg-gray-200" />
        <div className="h-4 w-48 rounded bg-gray-200" />
      </div>
      <div className="mb-4 h-3 w-32 rounded bg-gray-100" />
      <div className="h-2 w-full rounded-full bg-gray-200" />
      <div className="mt-2 flex justify-between">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-3 w-12 rounded bg-gray-100" />
        ))}
      </div>
    </div>
  );
}

function TierSlider({
  tiers,
  selectedTier,
  onChange,
  onRelease,
}: {
  tiers: TierSuggestion[];
  selectedTier: TierKey;
  onChange: (t: TierKey) => void;
  onRelease: (t: TierKey) => void;
}) {
  const idx = TIER_ORDER.indexOf(selectedTier);
  const fillPct = (idx / 4) * 100;

  return (
    <div className="py-3">
      <input
        type="range"
        min={0}
        max={4}
        step={1}
        value={idx}
        onChange={(e) => onChange(TIER_ORDER[+e.target.value])}
        onMouseUp={(e) => onRelease(TIER_ORDER[+(e.target as HTMLInputElement).value])}
        onTouchEnd={(e) => onRelease(TIER_ORDER[+(e.target as HTMLInputElement).value])}
        className="h-2 w-full cursor-pointer appearance-none rounded-full accent-[#2563EB]"
        style={{
          background: `linear-gradient(to right, #2563EB ${fillPct}%, #E5E7EB ${fillPct}%)`,
        }}
      />
      <div className="mt-2 flex">
        {TIER_ORDER.map((tier, i) => {
          const t = tiers.find((x) => x.tier === tier);
          const active = i === idx;
          return (
            <button
              key={tier}
              onClick={() => { onChange(tier); onRelease(tier); }}
              className="flex flex-1 flex-col items-center gap-0.5 text-center"
            >
              <span
                className={`text-xs capitalize font-medium ${
                  active ? "text-[#2563EB]" : "text-gray-400"
                }`}
              >
                {tier}
              </span>
              <span
                className={`text-xs tabular-nums ${
                  active ? "font-semibold text-gray-900" : "text-gray-400"
                }`}
              >
                {t ? formatCurrency(t.unit_cost) : "—"}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ItemCard({
  item,
  onTierChange,
  onTierSave,
}: {
  item: ItemWithTiers;
  onTierChange: (id: string, tier: TierKey) => void;
  onTierSave: (id: string, tier: TierKey) => void;
}) {
  const tierData = item.tiers.find((t) => t.tier === item.selected_tier);
  const lineTotal = (tierData?.unit_cost ?? item.unit_cost) * item.qty;

  if (item.is_loading_tiers) return <ItemSkeleton />;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <PlausibilityDot p={tierData?.plausibility} />
          <div>
            <h3 className="font-semibold text-gray-900 leading-snug">{item.description}</h3>
            {item.brand && <p className="text-xs text-gray-400">{item.brand}</p>}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums text-gray-900">
            {formatCurrency(lineTotal)}
          </p>
          {item.qty > 1 && (
            <p className="text-xs tabular-nums text-gray-400">
              {item.qty} × {formatCurrency(tierData?.unit_cost ?? item.unit_cost)}
            </p>
          )}
        </div>
      </div>

      <p className="mt-1 text-xs text-gray-400">
        Original: {formatCurrency(item.unit_cost)} · Qty: {item.qty}
      </p>

      {/* Slider */}
      {item.tiers.length > 0 ? (
        <TierSlider
          tiers={item.tiers}
          selectedTier={item.selected_tier}
          onChange={(t) => onTierChange(item.id, t)}
          onRelease={(t) => onTierSave(item.id, t)}
        />
      ) : (
        <p className="mt-3 text-xs text-gray-400">Tier suggestions unavailable</p>
      )}

      {/* Selected tier details */}
      {tierData && item.selected_tier !== "keep" && (
        <div className="mt-2 rounded-md bg-gray-50 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-gray-900">{tierData.label}</p>
              <p className="text-xs text-gray-500">
                {[tierData.brand, tierData.material, tierData.origin]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {tierData.vendor_url ? (
              <a
                href={tierData.vendor_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-xs text-[#2563EB] hover:underline"
              >
                View ↗
              </a>
            ) : null}
          </div>

          {/* Upgrade multiple & plausibility */}
          {tierData.upgrade_multiple > 1 && (
            <div
              className={`mt-2.5 rounded p-2.5 text-xs ${
                tierData.plausibility === "yellow"
                  ? "bg-amber-50 text-amber-800"
                  : tierData.plausibility === "red"
                  ? "bg-red-50 text-red-800"
                  : "bg-green-50 text-green-800"
              }`}
            >
              <div className="flex items-center gap-1.5 font-medium">
                <PlausibilityDot p={tierData.plausibility} />
                {tierData.upgrade_multiple.toFixed(1)}x upgrade
                {tierData.plausibility_reason ? ` · ${tierData.plausibility_reason}` : ""}
              </div>
              {tierData.adjuster_narrative && tierData.plausibility !== "green" && (
                <p className="mt-1 italic opacity-90">&ldquo;{tierData.adjuster_narrative}&rdquo;</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SuggestionCard({
  s,
  onAdd,
}: {
  s: TierSuggestion;
  onAdd: (s: TierSuggestion) => void;
}) {
  return (
    <div className="flex flex-col rounded-lg border border-gray-200 bg-white p-4">
      <p className="font-medium text-gray-900 text-sm">{s.label}</p>
      <p className="text-xs text-gray-500 mt-0.5">
        {[s.brand, s.material, s.origin].filter(Boolean).join(" · ")}
      </p>
      <p className="mt-2 text-lg font-semibold tabular-nums text-gray-900">
        {formatCurrency(s.unit_cost)}
      </p>
      {s.vendor && (
        <p className="text-xs text-gray-400 mt-0.5">{s.vendor}</p>
      )}
      <button
        onClick={() => onAdd(s)}
        className="mt-auto pt-3 text-xs font-medium text-[#2563EB] hover:underline text-left"
      >
        + Add to claim
      </button>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function RoomReviewPage() {
  const params = useParams<{ room: string }>();
  const roomSlug = params.room;

  const [session, setSession] = useState<SessionData | null>(null);
  const [roomName, setRoomName] = useState<string>("");
  const [items, setItems] = useState<ItemWithTiers[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Navigation
  const [allRooms, setAllRooms] = useState<string[]>([]);

  // Add items section
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<TierSuggestion[] | null>(null);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [customRequest, setCustomRequest] = useState("");

  // Accumulate tier saves without re-reading Supabase on every write
  const pendingTiersRef = useRef<Record<string, StoredItemTier>>({});

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    bootstrap();
  }, [roomSlug]);

  async function bootstrap() {
    setIsLoading(true);
    setItems([]);
    setSuggestions(null);
    setActiveCategory(null);

    const sess = await loadSession();
    setSession(sess);

    if (!sess?.claim_items?.length) return;

    // Seed the pending-tiers accumulator from saved state
    if (sess.item_tiers) {
      pendingTiersRef.current = { ...sess.item_tiers };
    }

    // Match slug → room name
    const rooms = sess.room_summary?.map((r) => r.room) ??
      [...new Set(sess.claim_items.map((i) => i.room))];
    setAllRooms(rooms);

    const name = rooms.find((r) => slugify(r) === roomSlug) ?? "";
    setRoomName(name);

    if (!name) { setIsLoading(false); return; }

    const roomClaimItems = sess.claim_items.filter((i) => i.room === name);

    const initialItems: ItemWithTiers[] = roomClaimItems.map((item) => {
      const id = generateItemId(item);
      const stored = sess.item_tiers?.[id];
      return {
        ...item,
        id,
        tiers: stored?.tiers ?? [],
        selected_tier: stored?.selected_tier ?? "keep",
        is_loading_tiers: !stored?.tiers?.length,
      };
    });

    setItems(initialItems);
    setIsLoading(false);

    // Generate tiers for items that don't have them yet
    const needTiers = initialItems.filter((i) => i.is_loading_tiers);
    if (needTiers.length > 0) {
      generateTiersInParallel(needTiers, sess);
    }
  }

  async function generateTiersInParallel(
    needTiers: ItemWithTiers[],
    sess: SessionData
  ) {
    const budget = sess.room_budgets?.[roomName] ?? 0;

    const promises = needTiers.map(async (item) => {
      try {
        const res = await fetch("/api/generate-tiers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item,
            lifestyle_profile: sess.lifestyle_profile,
            room_budget: budget,
          }),
        });

        if (!res.ok) throw new Error(`${res.status}`);
        const tiers = (await res.json()) as TierSuggestion[];

        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, tiers, is_loading_tiers: false } : i
          )
        );

        // Persist — accumulate in ref to avoid clobbering concurrent writes
        pendingTiersRef.current[item.id] = {
          tiers,
          selected_tier: "keep",
        };
        await saveSession({ item_tiers: { ...pendingTiersRef.current } });
      } catch (err) {
        console.error(`Tier generation failed for ${item.description}:`, err);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? { ...i, is_loading_tiers: false } : i
          )
        );
      }
    });

    await Promise.allSettled(promises);
  }

  // ── Tier interactions ──────────────────────────────────────────────────────

  function handleTierChange(id: string, tier: TierKey) {
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, selected_tier: tier } : i))
    );
  }

  async function handleTierSave(id: string, tier: TierKey) {
    const item = items.find((i) => i.id === id);
    if (!item) return;

    pendingTiersRef.current[id] = {
      tiers: item.tiers,
      selected_tier: tier,
    };
    await saveSession({ item_tiers: { ...pendingTiersRef.current } });
  }

  // ── Add items ──────────────────────────────────────────────────────────────

  async function handleCategoryClick(category: string) {
    if (activeCategory === category) {
      setActiveCategory(null);
      setSuggestions(null);
      return;
    }
    setActiveCategory(category);
    setSuggestions(null);
    setIsLoadingSuggestions(true);

    try {
      const roomTotal = items.reduce((s, i) => {
        const td = i.tiers.find((t) => t.tier === i.selected_tier);
        return s + (td?.unit_cost ?? i.unit_cost) * i.qty;
      }, 0);

      const res = await fetch("/api/suggest-additions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: roomName,
          room_budget: session?.room_budgets?.[roomName] ?? 0,
          current_room_total: roomTotal,
          existing_items: items as ClaimItem[],
          lifestyle_profile: session?.lifestyle_profile ?? null,
          category,
          custom_request: "",
        }),
      });
      if (!res.ok) throw new Error("Suggestions failed");
      setSuggestions((await res.json()) as TierSuggestion[]);
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }

  async function handleCustomRequest() {
    if (!customRequest.trim()) return;
    setActiveCategory("custom");
    setSuggestions(null);
    setIsLoadingSuggestions(true);

    try {
      const roomTotal = items.reduce((s, i) => {
        const td = i.tiers.find((t) => t.tier === i.selected_tier);
        return s + (td?.unit_cost ?? i.unit_cost) * i.qty;
      }, 0);

      const res = await fetch("/api/suggest-additions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: roomName,
          room_budget: session?.room_budgets?.[roomName] ?? 0,
          current_room_total: roomTotal,
          existing_items: items as ClaimItem[],
          lifestyle_profile: session?.lifestyle_profile ?? null,
          category: "custom",
          custom_request: customRequest,
        }),
      });
      if (!res.ok) throw new Error("Suggestions failed");
      setSuggestions((await res.json()) as TierSuggestion[]);
    } catch {
      setSuggestions([]);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }

  async function handleAddSuggestion(s: TierSuggestion) {
    const newItem: ClaimItem = {
      room: roomName,
      description: s.label,
      brand: s.brand,
      model: s.model,
      qty: 1,
      age_years: 0,
      age_months: 0,
      condition: "New",
      unit_cost: s.unit_cost,
      category: activeCategory ?? "",
    };

    const id = generateItemId(newItem);
    const newItemWithTiers: ItemWithTiers = {
      ...newItem,
      id,
      tiers: [s],
      selected_tier: "keep",
      is_loading_tiers: false,
    };

    setItems((prev) => [...prev, newItemWithTiers]);

    // Persist: add to claim_items + item_tiers
    const updatedClaimItems = [
      ...(session?.claim_items ?? []),
      newItem,
    ];
    pendingTiersRef.current[id] = { tiers: [s], selected_tier: "keep" };

    await saveSession({
      claim_items: updatedClaimItems,
      item_tiers: { ...pendingTiersRef.current },
    });
    setSession((prev) =>
      prev ? { ...prev, claim_items: updatedClaimItems } : prev
    );
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const roomBudget = session?.room_budgets?.[roomName] ?? 0;
  const roomTotal = items.reduce((s, i) => {
    const td = i.tiers.find((t) => t.tier === i.selected_tier);
    return s + (td?.unit_cost ?? i.unit_cost) * i.qty;
  }, 0);
  const budgetPct = roomBudget > 0 ? Math.min(100, (roomTotal / roomBudget) * 100) : 0;

  const plausibilityCounts = items.reduce(
    (acc, i) => {
      if (i.is_loading_tiers || !i.tiers.length) return acc;
      const td = i.tiers.find((t) => t.tier === i.selected_tier);
      const p = td?.plausibility ?? "green";
      acc[p]++;
      return acc;
    },
    { green: 0, yellow: 0, red: 0 }
  );

  const roomIdx = allRooms.indexOf(roomName);
  const prevRoom = roomIdx > 0 ? allRooms[roomIdx - 1] : null;
  const nextRoom = roomIdx < allRooms.length - 1 ? allRooms[roomIdx + 1] : null;

  const categories = getRoomCategories(roomName);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen">
      {/* Page header */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/review" className="text-xs text-gray-400 hover:text-gray-600">
                ← All Rooms
              </Link>
            </div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">{roomName}</h1>
              {roomBudget > 0 && (
                <span className="text-sm tabular-nums text-gray-500">
                  {formatCurrency(roomTotal)}{" "}
                  <span className="text-gray-400">/ {formatCurrency(roomBudget)}</span>
                </span>
              )}
            </div>
          </div>

          {/* Plausibility summary */}
          <div className="flex items-center gap-3 text-xs shrink-0">
            <span className="flex items-center gap-1 text-[#16A34A]">
              <span className="h-2 w-2 rounded-full bg-[#16A34A]" />
              {plausibilityCounts.green} clean
            </span>
            <span className="flex items-center gap-1 text-[#D97706]">
              <span className="h-2 w-2 rounded-full bg-[#D97706]" />
              {plausibilityCounts.yellow} narrative
            </span>
            <span className="flex items-center gap-1 text-[#DC2626]">
              <span className="h-2 w-2 rounded-full bg-[#DC2626]" />
              {plausibilityCounts.red} flagged
            </span>
          </div>
        </div>

        {/* Budget progress bar */}
        {roomBudget > 0 && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all ${
                  budgetPct >= 100
                    ? "bg-green-500"
                    : budgetPct >= 80
                    ? "bg-amber-500"
                    : "bg-[#2563EB]"
                }`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
            <p className="mt-0.5 text-xs text-gray-400">{budgetPct.toFixed(0)}% of budget used</p>
          </div>
        )}
      </header>

      {/* Main content */}
      <main className="flex-1 px-6 py-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <ItemSkeleton key={i} />)}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-gray-500">No items found for this room.</p>
            <Link href="/review" className="mt-3 text-sm text-[#2563EB] hover:underline">
              ← Back to all rooms
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onTierChange={handleTierChange}
                onTierSave={handleTierSave}
              />
            ))}
          </div>
        )}

        {/* ── Add Items Section ────────────────────────────────────────── */}
        {!isLoading && (
          <div className="mt-8">
            <div className="mb-4">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
                + Add Items to This Room
              </h2>
              <p className="mt-1 text-xs text-gray-400">
                Add missing like-kind items to strengthen your claim.
              </p>
            </div>

            {/* Category chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => handleCategoryClick(cat)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeCategory === cat
                      ? "border-[#2563EB] bg-blue-50 text-[#2563EB]"
                      : "border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-900"
                  }`}
                >
                  + {cat}
                </button>
              ))}
            </div>

            {/* Loading suggestions */}
            {isLoadingSuggestions && (
              <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
                <Spinner size="md" /> Generating suggestions…
              </div>
            )}

            {/* Suggestion cards */}
            {suggestions && suggestions.length > 0 && (
              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {suggestions.map((s, i) => (
                  <SuggestionCard key={i} s={s} onAdd={handleAddSuggestion} />
                ))}
              </div>
            )}

            {suggestions && suggestions.length === 0 && (
              <p className="mb-4 text-sm text-gray-400">No suggestions found. Try a custom request.</p>
            )}

            {/* Custom request */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customRequest}
                onChange={(e) => setCustomRequest(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCustomRequest()}
                placeholder="I want something specific…"
                className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={handleCustomRequest}
                disabled={isLoadingSuggestions || !customRequest.trim()}
                className="rounded-md bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Get Suggestions →
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Sticky bottom bar ───────────────────────────────────────────── */}
      <footer className="sticky bottom-0 z-10 border-t border-gray-200 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="flex items-center justify-between gap-6">
          <div className="flex-1">
            {roomBudget > 0 ? (
              <>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-gray-900">
                    Room Total: {formatCurrency(roomTotal)}
                  </span>
                  <span className="tabular-nums text-gray-500">
                    {formatCurrency(roomBudget - roomTotal)} remaining
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full transition-all ${
                      budgetPct >= 100 ? "bg-green-500" : budgetPct >= 80 ? "bg-amber-500" : "bg-[#2563EB]"
                    }`}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              </>
            ) : (
              <span className="text-sm font-medium text-gray-900">
                Room Total: {formatCurrency(roomTotal)}
              </span>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {prevRoom ? (
              <Link
                href={`/review/${slugify(prevRoom)}`}
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ← {prevRoom}
              </Link>
            ) : (
              <Link
                href="/setup"
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ← Setup
              </Link>
            )}
            {nextRoom && (
              <Link
                href={`/review/${slugify(nextRoom)}`}
                className="rounded-md bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                {nextRoom} →
              </Link>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
}
