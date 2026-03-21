"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { loadSession, saveSession, SessionData } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { ClaimItem } from "../../lib/types";
import { useClaimMode } from "../../lib/useClaimMode";
import { generateItemId, slugify, formatCurrency } from "../../lib/utils";
import { RoomUpgradeRow, type UpgradeOption } from "./upgrade-row";

// ── Slug → room name ──────────────────────────────────────────────────────────

const SLUG_TO_ROOM: Record<string, string> = {
  "living-room": "Living Room",
  "kitchen": "Kitchen",
  "bedroom-rafe": "Bedroom Rafe",
  "bedroom-orly": "Bedroom Orly",
  "patio": "Patio",
  "garage": "Garage",
  "bathroom-white": "Bathroom White",
  "bathroom-master": "Bathroom Master",
  "david-office-guest-room": "David Office / Guest Room",
  "art": "Art",
};

// ── Category bundles (hard-coded) ─────────────────────────────────────────────

interface CategoryBundle {
  name: string;
  description: string;
  items_affected: string[];
  upgrade_value: number;
  original_value: number;
  brand: string;
  note: string;
}

const CATEGORY_UPGRADES: Record<string, CategoryBundle[]> = {
  "Living Room": [
    {
      name: "Tea & Ceramic Collection",
      description: "Upgrade all ceramic and decorative items as a set",
      items_affected: ["Bowl with food", "Matcha tea container", "Ceramic tea pot", "Tea bowls", "Black Vase", "Heath Ceramics Vase", "Beige Vase", "Rose Quartz", "Decorative Bowl with spheres", "Vase"],
      upgrade_value: 4200, original_value: 1307,
      brand: "Heath Ceramics + Dinosaur Designs + Jicon",
      note: "Coherent upgrade of all ceramic and decorative objects as a curated collection",
    },
    {
      name: "Seating Upgrade",
      description: "Upgrade sofa and armchair as a set",
      items_affected: ["8ft RH Maxwell Sofa", "George Smith Scroll Armchair"],
      upgrade_value: 33500, original_value: 13100,
      brand: "B&B Italia + George Smith",
      note: "Complete seating upgrade to Italian/British luxury tier",
    },
    {
      name: "Dining Room Set",
      description: "Upgrade table and chairs together",
      items_affected: ["Wooden Dining Table", "Dining Chairs", "Pearl inlaid wood side table"],
      upgrade_value: 47800, original_value: 8300,
      brand: "Minotti + de la Espada",
      note: "Complete dining room upgrade",
    },
    {
      name: "Art Books Collection",
      description: "Upgrade to Assouline luxury editions",
      items_affected: ["Art books"],
      upgrade_value: 15000, original_value: 9000,
      brand: "Assouline",
      note: "Upgrade to premium art book publisher",
    },
    {
      name: "Piano Upgrade",
      description: "Standup to quality upright",
      items_affected: ["Standup piano"],
      upgrade_value: 9500, original_value: 3000,
      brand: "Yamaha",
      note: "Like-kind upgrade to professional grade",
    },
  ],
  "Kitchen": [
    {
      name: "Matcha Ritual Set",
      description: "Complete matcha preparation upgrade",
      items_affected: ["Matcha tea container", "matcha whisk", "ceramic teapot", "Ceramic Teapot"],
      upgrade_value: 2800, original_value: 685,
      brand: "Jicon + Ippodo",
      note: "Coherent upgrade of matcha ritual items",
    },
    {
      name: "Kitchen Essentials",
      description: "Cookware, knives, and small appliances",
      items_affected: ["Air Fryer", "Nugget Ice Machine"],
      upgrade_value: 12500, original_value: 500,
      brand: "All-Clad + Breville + Vitamix",
      note: "Complete kitchen cooking essentials",
    },
    {
      name: "Table Setting Collection",
      description: "Dinnerware, placemats, and serving pieces",
      items_affected: ["East Fork salad bowls", "Chilewich placemats", "Ceramic Bowl"],
      upgrade_value: 4800, original_value: 879,
      brand: "Mud Australia + Chilewich",
      note: "Coherent table setting upgrade",
    },
  ],
  "Bedroom Orly": [
    {
      name: "Sony Camera System",
      description: "Complete Sony lens and accessory kit",
      items_affected: ["Sony a6100 camera", "Sony a6600 camera", "Sony a6000 camera", "Sony A7sii batteries"],
      upgrade_value: 18500, original_value: 2660,
      brand: "Sony",
      note: "Complete Sony ecosystem upgrade with lenses and accessories",
    },
    {
      name: "Audio Production Kit",
      description: "Upgrade microphones and audio gear",
      items_affected: ["Sennheiser shotgun mic", "Sennheiser directional mic"],
      upgrade_value: 3800, original_value: 1400,
      brand: "Sennheiser + Rode",
      note: "Professional audio production upgrade",
    },
  ],
  "Bedroom Rafe": [
    {
      name: "Sports Memorabilia Display",
      description: "Museum-quality display for all memorabilia",
      items_affected: ["Carmelo Anthony Signed Game-Worn Nuggets Jersey", "Autographed Sports Memorabilia", "Jerseys"],
      upgrade_value: 12000, original_value: 7675,
      brand: "Custom museum framing",
      note: "Professional display upgrade for entire memorabilia collection",
    },
    {
      name: "Baseball Card Collection",
      description: "1994 complete DeBasel print run",
      items_affected: [],
      upgrade_value: 14000, original_value: 0,
      brand: "DeBasel",
      note: "Addition — 1994 MLB complete print run all major sets",
    },
  ],
  "Garage": [
    {
      name: "Surf Kit Upgrade",
      description: "Boards, wetsuits, and storage",
      items_affected: ["Surf boards", "Surf board wax", "wet suits", "flippers", "Snorkel"],
      upgrade_value: 8500, original_value: 1357,
      brand: "Channel Islands + O'Neill",
      note: "Complete surf kit upgrade",
    },
    {
      name: "Tennis Collection",
      description: "Racquets, bag, and accessories",
      items_affected: ["Tennis racquets", "tennis racquet strings", "tennis balls", "Wilson tennis racquet bag"],
      upgrade_value: 2800, original_value: 807,
      brand: "Wilson",
      note: "Complete tennis kit upgrade",
    },
    {
      name: "Cycling Kit",
      description: "E-bikes, helmets, locks, and bags",
      items_affected: ["Electric bicycle", "Bike helmet", "bicycle bag", "Litelok bike lock"],
      upgrade_value: 16000, original_value: 7791,
      brand: "Specialized + Litelok",
      note: "Complete cycling kit upgrade",
    },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function SmallSpinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Category Upgrades section ─────────────────────────────────────────────────

function CategoryUpgradesSection({
  roomName,
  items,
  appliedBundles,
  onApply,
}: {
  roomName: string;
  items: ClaimItem[];
  appliedBundles: Set<string>;
  onApply: (bundle: CategoryBundle) => void;
}) {
  const bundles = CATEGORY_UPGRADES[roomName];
  const [openBundle, setOpenBundle] = useState<string | null>(null);

  if (!bundles?.length) return null;

  return (
    <div className="mb-6 rounded-2xl border border-gray-200 bg-gray-50 p-4">
      <p className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-400">
        Category Upgrades
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        {bundles.map((b) => {
          const uplift = b.upgrade_value - b.original_value;
          const applied = appliedBundles.has(b.name);
          const active = openBundle === b.name;
          return (
            <button
              key={b.name}
              onClick={() => setOpenBundle(active ? null : b.name)}
              className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                applied
                  ? "border-green-300 bg-green-50 text-green-700"
                  : active
                  ? "border-[#2563EB] bg-blue-50 text-[#2563EB]"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              {applied ? "✓ " : ""}{b.name}{" "}
              <span className={applied ? "text-green-500" : "text-gray-400"}>
                +{formatCurrency(uplift)}
              </span>
            </button>
          );
        })}
      </div>

      {openBundle && (() => {
        const bundle = bundles.find((b) => b.name === openBundle)!;
        const uplift = bundle.upgrade_value - bundle.original_value;
        const applied = appliedBundles.has(bundle.name);
        const affectedItems = items.filter((item) =>
          bundle.items_affected.some(
            (a) => item.description.toLowerCase().includes(a.toLowerCase()) || a.toLowerCase().includes(item.description.toLowerCase())
          )
        );
        return (
          <div className="rounded-xl border border-blue-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="text-base font-bold text-gray-900">{bundle.name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{bundle.description}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xl font-bold tabular-nums text-gray-900">+{formatCurrency(uplift)}</p>
                <p className="text-xs text-gray-400">{formatCurrency(bundle.original_value)} → {formatCurrency(bundle.upgrade_value)}</p>
              </div>
            </div>
            {bundle.brand && (
              <p className="text-sm text-gray-500 mb-3"><span className="font-medium">Brand: </span>{bundle.brand}</p>
            )}
            {affectedItems.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-400 mb-1.5">Items affected:</p>
                <ul className="space-y-1">
                  {affectedItems.map((item, i) => (
                    <li key={i} className="flex items-center justify-between text-sm text-gray-600">
                      <span className="truncate mr-2">{item.description}</span>
                      <span className="shrink-0 tabular-nums text-gray-400">{formatCurrency(item.unit_cost * item.qty)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {bundle.items_affected.length === 0 && (
              <p className="mb-3 text-sm text-gray-500 italic">This is a new addition — no existing items affected.</p>
            )}
            <p className="mb-4 text-sm italic text-gray-500">&ldquo;{bundle.note}&rdquo;</p>
            <div className="flex items-center gap-3">
              {applied ? (
                <span className="text-sm font-medium text-green-600">✓ Applied</span>
              ) : (
                <button
                  onClick={() => { onApply(bundle); setOpenBundle(null); }}
                  className="min-h-[44px] rounded-xl bg-[#16A34A] px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-green-700"
                >
                  ✓ Apply Category Upgrade
                </button>
              )}
              <button onClick={() => setOpenBundle(null)} className="text-sm text-gray-400 hover:text-gray-600">
                ✗ Cancel
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function RoomReviewPage() {
  const params = useParams<{ room: string }>();
  const roomSlug = params.room;

  const [session, setSession] = useState<SessionData | null>(null);
  const [roomName, setRoomName] = useState("");
  const [items, setItems] = useState<ClaimItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [allRooms, setAllRooms] = useState<string[]>([]);
  const [appliedBundles, setAppliedBundles] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [cacheKeySet, setCacheKeySet] = useState<Set<string>>(new Set());
  const [addSectionOpen, setAddSectionOpen] = useState(false);

  const { sessionId, hydrated } = useClaimMode();

  useEffect(() => {
    if (!hydrated) return;
    void bootstrap();
  }, [roomSlug, hydrated, sessionId]);

  async function bootstrap() {
    setIsLoading(true);
    setItems([]);
    setAppliedBundles(new Set());

    const sess = await loadSession(sessionId);
    setSession(sess);
    if (!sess?.claim_items?.length) {
      setIsLoading(false);
      return;
    }

    const rooms = sess.room_summary?.map((r) => r.room) ?? [...new Set(sess.claim_items.map((i) => i.room))];
    setAllRooms(rooms);

    const name = SLUG_TO_ROOM[roomSlug] ?? rooms.find((r) => slugify(r) === roomSlug) ?? "";
    setRoomName(name);
    if (!name) {
      setIsLoading(false);
      return;
    }

    setItems(sess.claim_items.filter((i) => i.room === name));

    try {
      const r = await fetch("/api/upgrade-cache-status");
      const j = (await r.json()) as { keys?: string[] };
      setCacheKeySet(new Set(j.keys ?? []));
    } catch {
      setCacheKeySet(new Set());
    }

    setIsLoading(false);
  }

  // ── Upgrade: replace item with selected option ────────────────────────────

  async function handleUpgrade(item: ClaimItem, option: UpgradeOption) {
    if (!session?.claim_items) return;
    setIsSaving(true);

    const stableCode = `upgrade:${roomName}:${item.description}:${item.unit_cost}`.slice(0, 180);

    const updated = session.claim_items.map((ci) => {
      if (ci.room === item.room && ci.description === item.description && ci.unit_cost === item.unit_cost) {
        return {
          ...ci,
          description: option.title,
          brand: option.brand,
          model: option.model,
          unit_cost: option.price,
          previous_unit_cost: item.unit_cost,
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

    await saveSession({ claim_items: updated }, sessionId);

    try {
      const { error: bdErr } = await supabase.from("bundle_decisions").upsert(
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
      if (bdErr) console.warn("bundle_decisions upgrade_applied:", bdErr.message);
    } catch (e) {
      console.warn("bundle_decisions upgrade network:", e);
    }

    setSession((prev) => (prev ? { ...prev, claim_items: updated } : prev));
    setItems(updated.filter((i) => i.room === roomName));
    setIsSaving(false);
    setToast(`Upgraded to ${option.title} — ${formatCurrency(option.price)}`);
  }

  // ── Category upgrade ──────────────────────────────────────────────────────

  async function handleApplyCategoryBundle(bundle: CategoryBundle) {
    if (!session?.claim_items) return;
    setIsSaving(true);

    const affectedLower = bundle.items_affected.map((a) => a.toLowerCase());
    const filtered = session.claim_items.filter((ci) => {
      if (ci.room !== roomName) return true;
      const dl = ci.description.toLowerCase();
      return !affectedLower.some((a) => dl.includes(a) || a.includes(dl));
    });

    const bundleItem: ClaimItem = {
      room: roomName,
      description: bundle.name,
      brand: bundle.brand,
      model: "",
      qty: 1,
      age_years: 0,
      age_months: 0,
      condition: "New",
      unit_cost: bundle.upgrade_value,
      category: "Category Upgrade",
      source: "bundle",
    };

    const updated = [...filtered, bundleItem];
    await saveSession({ claim_items: updated }, sessionId);
    setSession((prev) => prev ? { ...prev, claim_items: updated } : prev);
    setItems(updated.filter((i) => i.room === roomName));
    setAppliedBundles((prev) => new Set([...prev, bundle.name]));
    setIsSaving(false);
    setToast(`${bundle.name} applied`);
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const roomBudget = session?.room_budgets?.[roomName] ?? 0;
  const roomTotal = items.reduce((s, i) => s + i.unit_cost * i.qty, 0);
  const budgetPct = roomBudget > 0 ? Math.min(100, (roomTotal / roomBudget) * 100) : 0;
  const roomIdx = allRooms.indexOf(roomName);
  const prevRoom = roomIdx > 0 ? allRooms[roomIdx - 1] : null;
  const nextRoom = roomIdx < allRooms.length - 1 ? allRooms[roomIdx + 1] : null;

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => b.unit_cost - a.unit_cost),
    [items]
  );

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

  // ── Render ────────────────────────────────────────────────────────────────

  if (!hydrated) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-gray-500">
        <SmallSpinner />
        <span>Loading…</span>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col pb-44">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/review" className="mb-1 block text-sm text-gray-400 hover:text-gray-600">
              ← All Rooms
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-gray-900">{roomName}</h1>
              <span className="tabular-nums text-base text-gray-500">
                {formatCurrency(roomTotal)}
                {roomBudget > 0 && <span className="text-gray-400"> / {formatCurrency(roomBudget)}</span>}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isSaving && <SmallSpinner />}
            <Link
              href={`/review/bundles/${roomSlug}`}
              className="min-h-[44px] flex items-center rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
            >
              Browse Packages →
            </Link>
          </div>
        </div>
        {roomBudget > 0 && (
          <div className="mt-3">
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all ${budgetPct >= 100 ? "bg-green-500" : budgetPct >= 80 ? "bg-amber-500" : "bg-[#2563EB]"}`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
            <p className="mt-0.5 text-sm text-gray-400">{budgetPct.toFixed(0)}% of budget</p>
          </div>
        )}
      </header>

      <main className="flex-1 px-6 py-6 max-w-3xl mx-auto w-full">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-gray-200 bg-white p-4">
                <div className="h-5 w-48 rounded bg-gray-200 mb-2" />
                <div className="h-4 w-32 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-lg text-gray-500">No items found for this room.</p>
            <Link href="/review" className="mt-3 text-base text-[#2563EB] hover:underline">← Back to all rooms</Link>
          </div>
        ) : (
          <>
            <section className="mb-8">
              <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">
                Upgrade existing items
              </h2>
              <div className="space-y-3">
                {sortedItems.map((item, idx) => (
                  <RoomUpgradeRow
                    key={`${generateItemId(item)}-${idx}`}
                    item={item}
                    cacheHas={cacheKeySet.has(item.description.trim().toLowerCase())}
                    onUpgrade={handleUpgrade}
                  />
                ))}
              </div>
            </section>

            <section className="mb-8">
              <button
                type="button"
                onClick={() => setAddSectionOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-bold text-gray-700 hover:bg-gray-100"
              >
                <span>+ ADD NEW ITEMS TO {roomName.toUpperCase()}</span>
                <span className="text-gray-400">{addSectionOpen ? "▼" : "▶"}</span>
              </button>
              {addSectionOpen && (
                <div className="mt-4 space-y-4">
                  <CategoryUpgradesSection
                    roomName={roomName}
                    items={items}
                    appliedBundles={appliedBundles}
                    onApply={handleApplyCategoryBundle}
                  />
                  <Link
                    href={`/review/bundles/${roomSlug}`}
                    className="inline-flex min-h-[44px] items-center rounded-xl bg-[#2563EB] px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700"
                  >
                    Open bundle browser →
                  </Link>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-gray-200 bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.08)]">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Room: {roomName}</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm tabular-nums mb-2">
            <span className="text-gray-600">Original</span>
            <span className="text-right font-semibold text-gray-900">{formatCurrency(originalSub)}</span>
            <span className="text-gray-600">Upgraded</span>
            <span className="text-right font-semibold text-green-700">+{formatCurrency(upgradedSub)}</span>
            <span className="text-gray-600">Added</span>
            <span className="text-right font-semibold text-blue-700">+{formatCurrency(addedSub)}</span>
          </div>
          <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-sm">
            <span className="font-bold text-gray-900 tabular-nums">
              Total: {formatCurrency(roomTotal)}
              {roomBudget > 0 && (
                <span className="text-gray-400 font-normal"> / {formatCurrency(roomBudget)} goal</span>
              )}
            </span>
          </div>
          {roomBudget > 0 && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all ${budgetPct >= 100 ? "bg-green-500" : budgetPct >= 80 ? "bg-amber-500" : "bg-[#2563EB]"}`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
          )}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {prevRoom ? (
              <Link
                href={`/review/${slugify(prevRoom)}`}
                className="min-h-[44px] flex items-center rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ← Back to Rooms
              </Link>
            ) : (
              <Link
                href="/review"
                className="min-h-[44px] flex items-center rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ← Back to Rooms
              </Link>
            )}
            {nextRoom ? (
              <Link
                href={`/review/${slugify(nextRoom)}`}
                className="min-h-[44px] flex items-center rounded-xl bg-[#2563EB] px-4 py-2 text-sm font-bold text-white hover:bg-blue-700"
              >
                Next Room →
              </Link>
            ) : (
              <Link
                href="/review"
                className="min-h-[44px] flex items-center rounded-xl bg-gray-100 px-4 py-2 text-sm font-medium text-gray-600"
              >
                Done
              </Link>
            )}
          </div>
        </div>
      </footer>

      {toast && (
        <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-gray-900 px-6 py-4 text-base text-white shadow-2xl">
          <span className="text-green-400 mr-2">✓</span>{toast}
        </div>
      )}
    </div>
  );
}
