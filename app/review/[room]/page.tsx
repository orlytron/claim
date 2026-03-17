"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { loadSession, saveSession, SessionData } from "../../lib/session";
import {
  ClaimItem,
  RoomContext,
  TierSuggestion,
  StoredItemTier,
  LifestyleProfile,
} from "../../lib/types";
import { generateItemId, slugify, formatCurrency } from "../../lib/utils";

// ── Hard-coded missing items per room ───────────────────────────────────────

const MISSING_ITEMS: Record<string, string[]> = {
  "Living Room": [
    "Lighting fixtures",
    "Window treatments",
    "Throws & pillows",
    "Bar setup",
    "Additional artwork",
  ],
  Kitchen: [
    "Cookware set",
    "Espresso machine",
    "Knife set",
    "Wine storage",
    "Dinnerware set",
    "Glassware",
  ],
  "Bedroom Rafe": [
    "Bedside table",
    "Desk & chair",
    "Bookshelf",
    "Gaming setup",
    "Sports display",
  ],
  "Bedroom Orly": [
    "Bedside table",
    "Desk & chair",
    "Bookshelf",
    "Bedding set",
    "Closet organizer",
  ],
  "David Office / Guest Room": [
    "Office chair",
    "Printer",
    "Award display shelving",
    "Safe/storage",
    "Desk lamp",
  ],
  "Bathroom Master": [
    "Towel set",
    "Bath mat set",
    "Mirror",
    "Medicine cabinet",
    "Toiletry organizer",
    "Robe",
  ],
  "Bathroom White": ["Towel set", "Bath products", "Mirror", "Shower accessories"],
  Patio: ["Dining table", "Chairs", "Umbrella", "Outdoor lighting", "Planters"],
  Garage: ["Surf rack/storage", "Bike storage", "Gym equipment", "Workbench"],
};

function getMissingItems(room: string): string[] {
  return MISSING_ITEMS[room] ?? ["Lighting", "Storage", "Artwork", "Accessories"];
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
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function PlausibilityBadge({
  p,
  multiple,
}: {
  p: "green" | "yellow" | "red";
  multiple: number;
}) {
  const colors = {
    green: "bg-green-50 text-green-700 border-green-200",
    yellow: "bg-amber-50 text-amber-700 border-amber-200",
    red: "bg-red-50 text-red-700 border-red-200",
  };
  const dots = { green: "bg-[#16A34A]", yellow: "bg-[#D97706]", red: "bg-[#DC2626]" };
  const labels = { green: "Clean", yellow: "Needs narrative", red: "High flag" };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${colors[p]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dots[p]}`} />
      {multiple > 1 ? `${multiple.toFixed(1)}x · ` : ""}
      {labels[p]}
    </span>
  );
}

// ── CardState type ──────────────────────────────────────────────────────────

type CardState =
  | { mode: "default" }
  | { mode: "loading" }
  | { mode: "suggestions"; tiers: TierSuggestion[]; idx: number }
  | { mode: "accepted"; tier: TierSuggestion };

// ── ItemCard ─────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  accepted,
  profile,
  roomContext,
  roomBudget,
  onAccept,
  onRevert,
}: {
  item: ClaimItem;
  accepted?: TierSuggestion;
  profile: LifestyleProfile | null;
  roomContext?: RoomContext;
  roomBudget: number;
  onAccept: (tier: TierSuggestion) => void;
  onRevert: () => void;
}) {
  const [state, setState] = useState<CardState>(() =>
    accepted ? { mode: "accepted", tier: accepted } : { mode: "default" }
  );

  const currentTotal =
    state.mode === "accepted"
      ? state.tier.unit_cost * item.qty
      : accepted
      ? accepted.unit_cost * item.qty
      : item.unit_cost * item.qty;

  async function handleSuggest() {
    setState({ mode: "loading" });
    try {
      const res = await fetch("/api/generate-tiers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item,
          lifestyle_profile: profile,
          room_budget: roomBudget,
          room_context: roomContext ?? null,
        }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const allTiers = (await res.json()) as TierSuggestion[];
      // Show entry / mid / premium (skip keep & ultra for 3-option display)
      const suggestions = allTiers.filter(
        (t) => t.tier !== "keep" && t.tier !== "ultra"
      );
      setState({ mode: "suggestions", tiers: suggestions.length ? suggestions : allTiers.slice(1), idx: 0 });
    } catch {
      setState({ mode: "default" });
    }
  }

  function handleAccept() {
    if (state.mode !== "suggestions") return;
    const tier = state.tiers[state.idx];
    setState({ mode: "accepted", tier });
    onAccept(tier);
  }

  function handleKeepOriginal() {
    setState({ mode: "default" });
  }

  function handleRevert() {
    setState({ mode: "default" });
    onRevert();
  }

  function setIdx(newIdx: number) {
    if (state.mode === "suggestions") {
      setState({ mode: "suggestions", tiers: state.tiers, idx: newIdx });
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm p-5">
      {/* Badges row */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
          {item.room}
        </span>
        {item.category && (
          <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
            {item.category}
          </span>
        )}
        {state.mode === "accepted" && (
          <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-medium text-green-700">
            ✓ Upgraded
          </span>
        )}
      </div>

      {/* Item info */}
      <h3 className="font-semibold text-gray-900 leading-snug">{item.description}</h3>
      {(item.brand || item.model) && (
        <p className="text-xs text-gray-500 mt-0.5">
          {[item.brand, item.model].filter(Boolean).join(" · ")}
        </p>
      )}
      <p className="mt-1.5 text-xs text-gray-400">
        Qty: {item.qty} · Unit: {formatCurrency(item.unit_cost)} · Total:{" "}
        <span className={state.mode === "accepted" ? "font-semibold text-gray-700" : ""}>
          {formatCurrency(currentTotal)}
        </span>
      </p>

      {/* ── Default: action buttons ── */}
      {state.mode === "default" && (
        <div className="mt-4 flex items-center gap-3">
          <span className="text-sm text-gray-400 cursor-default">Keep as-is</span>
          <button
            onClick={handleSuggest}
            className="rounded-md bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            Suggest Upgrade →
          </button>
        </div>
      )}

      {/* ── Loading ── */}
      {state.mode === "loading" && (
        <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
          <Spinner size="md" />
          <span>Analyzing item…</span>
        </div>
      )}

      {/* ── Suggestions ── */}
      {state.mode === "suggestions" && state.tiers.length > 0 && (
        <div className="mt-4">
          <div className="rounded-lg bg-[#EFF6FF] border border-blue-100 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600 mb-3">
              Suggested Replacement
            </p>

            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 leading-snug">
                  {state.tiers[state.idx].label}
                </p>
                {(state.tiers[state.idx].brand || state.tiers[state.idx].model) && (
                  <p className="text-sm text-gray-600 mt-0.5">
                    {[state.tiers[state.idx].brand, state.tiers[state.idx].model]
                      .filter(Boolean)
                      .join(" ")}
                  </p>
                )}
                {(state.tiers[state.idx].material || state.tiers[state.idx].origin) && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[state.tiers[state.idx].material, state.tiers[state.idx].origin]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xl font-semibold tabular-nums text-gray-900">
                  {formatCurrency(state.tiers[state.idx].unit_cost)}
                </p>
                {item.qty > 1 && (
                  <p className="text-xs text-gray-400 tabular-nums">
                    × {item.qty} = {formatCurrency(state.tiers[state.idx].unit_cost * item.qty)}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3">
              <PlausibilityBadge
                p={state.tiers[state.idx].plausibility}
                multiple={state.tiers[state.idx].upgrade_multiple}
              />
            </div>

            {state.tiers[state.idx].plausibility !== "green" &&
              state.tiers[state.idx].adjuster_narrative && (
                <p className="mt-2 text-xs italic text-gray-500">
                  &ldquo;{state.tiers[state.idx].adjuster_narrative}&rdquo;
                </p>
              )}

            {state.tiers[state.idx].vendor_url && (
              <a
                href={state.tiers[state.idx].vendor_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-xs text-[#2563EB] hover:underline"
              >
                View item ↗
              </a>
            )}
          </div>

          {/* Navigation + actions */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-sm">
              <button
                onClick={() =>
                  setIdx((state as { mode: "suggestions"; tiers: TierSuggestion[]; idx: number }).idx === 0
                    ? state.tiers.length - 1
                    : (state as { mode: "suggestions"; tiers: TierSuggestion[]; idx: number }).idx - 1)
                }
                className="rounded border border-gray-200 px-2 py-1 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                ← Prev
              </button>
              <span className="text-xs text-gray-400 tabular-nums px-1">
                {(state as { mode: "suggestions"; tiers: TierSuggestion[]; idx: number }).idx + 1} of {state.tiers.length}
              </span>
              <button
                onClick={() =>
                  setIdx(((state as { mode: "suggestions"; tiers: TierSuggestion[]; idx: number }).idx + 1) % state.tiers.length)
                }
                className="rounded border border-gray-200 px-2 py-1 text-gray-500 hover:bg-gray-50 disabled:opacity-40"
              >
                Next →
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleKeepOriginal}
                className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                ✗ Keep Original
              </button>
              <button
                onClick={handleAccept}
                className="rounded-md bg-[#16A34A] px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
              >
                ✓ Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Accepted ── */}
      {state.mode === "accepted" && (
        <div className="mt-3">
          <div className="rounded-lg bg-[#EFF6FF] border border-blue-100 p-3">
            <p className="text-xs text-blue-600 mb-1.5 font-medium">Upgraded to:</p>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-gray-900 text-sm">{state.tier.label}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {[state.tier.brand, state.tier.material, state.tier.origin]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="font-semibold tabular-nums text-gray-900 text-sm">
                  {formatCurrency(state.tier.unit_cost * item.qty)}
                </p>
                <p className="text-xs text-gray-400 tabular-nums">
                  was {formatCurrency(item.unit_cost * item.qty)}
                </p>
              </div>
            </div>
            <div className="mt-2">
              <PlausibilityBadge p={state.tier.plausibility} multiple={state.tier.upgrade_multiple} />
            </div>
            {state.tier.plausibility !== "green" && state.tier.adjuster_narrative && (
              <p className="mt-1.5 text-xs italic text-gray-500">
                &ldquo;{state.tier.adjuster_narrative}&rdquo;
              </p>
            )}
          </div>
          <button
            onClick={handleRevert}
            className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            × Revert to original
          </button>
        </div>
      )}
    </div>
  );
}

// ── SuggestionCard ────────────────────────────────────────────────────────────

function SuggestionCard({ s, onAdd }: { s: TierSuggestion; onAdd: (s: TierSuggestion) => void }) {
  return (
    <div className="flex flex-col rounded-lg border border-blue-100 bg-[#EFF6FF] p-4">
      <p className="font-medium text-gray-900 text-sm leading-snug">{s.label}</p>
      <p className="text-xs text-gray-500 mt-0.5">
        {[s.brand, s.material, s.origin].filter(Boolean).join(" · ")}
      </p>
      <p className="mt-2 text-lg font-semibold tabular-nums text-gray-900">
        {formatCurrency(s.unit_cost)}
      </p>
      {s.vendor && <p className="text-xs text-gray-400 mt-0.5">{s.vendor}</p>}
      <button
        onClick={() => onAdd(s)}
        className="mt-auto pt-3 text-xs font-medium text-[#16A34A] hover:underline text-left"
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
  const [items, setItems] = useState<ClaimItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [allRooms, setAllRooms] = useState<string[]>([]);

  // Accepted tiers map: item id → accepted TierSuggestion
  const [acceptedTiers, setAcceptedTiers] = useState<Record<string, TierSuggestion>>({});

  // Missing items section
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [categorySuggestions, setCategorySuggestions] = useState<TierSuggestion[] | null>(null);
  const [isLoadingCategory, setIsLoadingCategory] = useState(false);
  const [customRequest, setCustomRequest] = useState("");

  // Accumulate tier saves without clobbering concurrent Supabase writes
  const pendingTiersRef = useRef<Record<string, StoredItemTier>>({});

  // ── Bootstrap ──────────────────────────────────────────────────────────────

  useEffect(() => {
    bootstrap();
  }, [roomSlug]);

  async function bootstrap() {
    setIsLoading(true);
    setItems([]);
    setAcceptedTiers({});
    setActiveCategory(null);
    setCategorySuggestions(null);

    const sess = await loadSession();
    setSession(sess);

    if (!sess?.claim_items?.length) {
      setIsLoading(false);
      return;
    }

    if (sess.item_tiers) {
      pendingTiersRef.current = { ...sess.item_tiers };
    }

    const rooms =
      sess.room_summary?.map((r) => r.room) ??
      [...new Set(sess.claim_items.map((i) => i.room))];
    setAllRooms(rooms);

    const name = rooms.find((r) => slugify(r) === roomSlug) ?? "";
    setRoomName(name);

    if (!name) {
      setIsLoading(false);
      return;
    }

    const roomClaimItems = sess.claim_items.filter((i) => i.room === name);
    setItems(roomClaimItems);

    // Restore previously accepted tiers
    const accepted: Record<string, TierSuggestion> = {};
    for (const item of roomClaimItems) {
      const id = generateItemId(item);
      const stored = sess.item_tiers?.[id];
      if (stored && stored.selected_tier !== "keep" && stored.tiers?.length) {
        const tier = stored.tiers.find((t) => t.tier === stored.selected_tier);
        if (tier) accepted[id] = tier;
      }
    }
    setAcceptedTiers(accepted);
    setIsLoading(false);
  }

  // ── Accept / revert handlers ───────────────────────────────────────────────

  async function handleAccept(item: ClaimItem, tier: TierSuggestion) {
    const id = generateItemId(item);
    setAcceptedTiers((prev) => ({ ...prev, [id]: tier }));

    pendingTiersRef.current[id] = {
      tiers: [tier],
      selected_tier: tier.tier,
    };
    await saveSession({ item_tiers: { ...pendingTiersRef.current } });
  }

  async function handleRevert(item: ClaimItem) {
    const id = generateItemId(item);
    setAcceptedTiers((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });

    if (pendingTiersRef.current[id]) {
      pendingTiersRef.current[id] = {
        tiers: pendingTiersRef.current[id].tiers,
        selected_tier: "keep",
      };
      await saveSession({ item_tiers: { ...pendingTiersRef.current } });
    }
  }

  // ── Missing items / add items ──────────────────────────────────────────────

  async function handleCategoryClick(category: string) {
    if (activeCategory === category) {
      setActiveCategory(null);
      setCategorySuggestions(null);
      return;
    }
    setActiveCategory(category);
    setCategorySuggestions(null);
    setIsLoadingCategory(true);

    try {
      const roomTotal = items.reduce((s, item) => {
        const id = generateItemId(item);
        const accepted = acceptedTiers[id];
        return s + (accepted?.unit_cost ?? item.unit_cost) * item.qty;
      }, 0);

      const roomContext =
        session?.lifestyle_profile?.room_context?.[roomName] ?? null;

      const res = await fetch("/api/suggest-additions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: roomName,
          room_budget: session?.room_budgets?.[roomName] ?? 0,
          current_room_total: roomTotal,
          existing_items: items,
          lifestyle_profile: session?.lifestyle_profile ?? null,
          room_context: roomContext,
          category,
          custom_request: "",
        }),
      });
      if (!res.ok) throw new Error("Suggestions failed");
      setCategorySuggestions((await res.json()) as TierSuggestion[]);
    } catch {
      setCategorySuggestions([]);
    } finally {
      setIsLoadingCategory(false);
    }
  }

  async function handleCustomRequest() {
    if (!customRequest.trim()) return;
    setActiveCategory("custom");
    setCategorySuggestions(null);
    setIsLoadingCategory(true);

    try {
      const roomTotal = items.reduce((s, item) => {
        const id = generateItemId(item);
        const accepted = acceptedTiers[id];
        return s + (accepted?.unit_cost ?? item.unit_cost) * item.qty;
      }, 0);

      const res = await fetch("/api/suggest-additions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room: roomName,
          room_budget: session?.room_budgets?.[roomName] ?? 0,
          current_room_total: roomTotal,
          existing_items: items,
          lifestyle_profile: session?.lifestyle_profile ?? null,
          room_context: session?.lifestyle_profile?.room_context?.[roomName] ?? null,
          category: "custom",
          custom_request: customRequest,
        }),
      });
      if (!res.ok) throw new Error("Suggestions failed");
      setCategorySuggestions((await res.json()) as TierSuggestion[]);
    } catch {
      setCategorySuggestions([]);
    } finally {
      setIsLoadingCategory(false);
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

    setItems((prev) => [...prev, newItem]);
    setAcceptedTiers((prev) => ({ ...prev, [id]: s }));

    const updatedClaimItems = [...(session?.claim_items ?? []), newItem];
    pendingTiersRef.current[id] = { tiers: [s], selected_tier: s.tier };

    await saveSession({
      claim_items: updatedClaimItems,
      item_tiers: { ...pendingTiersRef.current },
    });
    setSession((prev) => (prev ? { ...prev, claim_items: updatedClaimItems } : prev));
  }

  // ── Derived values ─────────────────────────────────────────────────────────

  const roomBudget = session?.room_budgets?.[roomName] ?? 0;
  const roomTotal = items.reduce((s, item) => {
    const id = generateItemId(item);
    const accepted = acceptedTiers[id];
    return s + (accepted?.unit_cost ?? item.unit_cost) * item.qty;
  }, 0);
  const budgetPct = roomBudget > 0 ? Math.min(100, (roomTotal / roomBudget) * 100) : 0;

  const plausibilityCounts = items.reduce(
    (acc, item) => {
      const id = generateItemId(item);
      const accepted = acceptedTiers[id];
      if (accepted) {
        acc[accepted.plausibility]++;
      } else {
        acc.green++;
      }
      return acc;
    },
    { green: 0, yellow: 0, red: 0 }
  );

  const roomIdx = allRooms.indexOf(roomName);
  const prevRoom = roomIdx > 0 ? allRooms[roomIdx - 1] : null;
  const nextRoom = roomIdx < allRooms.length - 1 ? allRooms[roomIdx + 1] : null;

  const missingCategories = getMissingItems(roomName);
  const profile = session?.lifestyle_profile ?? null;
  const roomContext: RoomContext | undefined =
    session?.lifestyle_profile?.room_context?.[roomName];

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen">
      {/* ── Page header ────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Link href="/review" className="text-xs text-gray-400 hover:text-gray-600">
                ← All Rooms
              </Link>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-semibold text-gray-900">{roomName}</h1>
              {roomBudget > 0 && (
                <span className="text-sm tabular-nums text-gray-500">
                  {formatCurrency(roomTotal)}{" "}
                  <span className="text-gray-400">/ {formatCurrency(roomBudget)}</span>
                </span>
              )}
              {roomContext && (
                <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-500">
                  {roomContext.occupant}
                </span>
              )}
            </div>
          </div>

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

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <main className="flex-1 px-6 py-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-lg border border-gray-200 bg-white p-5"
              >
                <div className="flex gap-2 mb-3">
                  <div className="h-5 w-20 rounded-full bg-gray-100" />
                  <div className="h-5 w-16 rounded-full bg-gray-100" />
                </div>
                <div className="h-4 w-56 rounded bg-gray-200 mb-2" />
                <div className="h-3 w-32 rounded bg-gray-100" />
              </div>
            ))}
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
            {items.map((item, idx) => {
              const id = generateItemId(item);
              return (
                <ItemCard
                  key={`${id}-${idx}`}
                  item={item}
                  accepted={acceptedTiers[id]}
                  profile={profile}
                  roomContext={roomContext}
                  roomBudget={roomBudget}
                  onAccept={(tier) => handleAccept(item, tier)}
                  onRevert={() => handleRevert(item)}
                />
              );
            })}
          </div>
        )}

        {/* ── Items commonly found in this room ───────────────────────────── */}
        {!isLoading && (
          <div className="mt-10">
            <div className="mb-4 border-t border-gray-100 pt-6">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Items Commonly Found in This Room
              </h2>
              <p className="mt-1 text-xs text-gray-400">
                Add missing items to strengthen the claim.
              </p>
            </div>

            {/* Hard-coded missing item chips */}
            <div className="flex flex-wrap gap-2 mb-4">
              {missingCategories.map((cat) => (
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

            {isLoadingCategory && (
              <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
                <Spinner size="md" /> Generating suggestions…
              </div>
            )}

            {categorySuggestions && categorySuggestions.length > 0 && (
              <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                {categorySuggestions.map((s, i) => (
                  <SuggestionCard key={i} s={s} onAdd={handleAddSuggestion} />
                ))}
              </div>
            )}

            {categorySuggestions && categorySuggestions.length === 0 && (
              <p className="mb-4 text-sm text-gray-400">
                No suggestions found. Try a custom request below.
              </p>
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
                disabled={isLoadingCategory || !customRequest.trim()}
                className="rounded-md bg-[#2563EB] px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                Get Suggestions →
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ── Sticky bottom bar ───────────────────────────────────────────────── */}
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
                      budgetPct >= 100
                        ? "bg-green-500"
                        : budgetPct >= 80
                        ? "bg-amber-500"
                        : "bg-[#2563EB]"
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
