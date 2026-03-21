"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { loadSession, saveSession, SessionData } from "../../lib/session";
import { ClaimItem } from "../../lib/types";
import { generateItemId, slugify, formatCurrency } from "../../lib/utils";

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

// ── Hard-coded upgrade map ────────────────────────────────────────────────────

interface UpgradeEntry {
  description: string;
  brand: string;
  unit_cost: number;
  note: string;
}

const UPGRADE_MAP: Record<string, UpgradeEntry> = {
  "8ft RH Maxwell Sofa": {
    description: "Tufty-Time modular sofa bouclé fabric",
    brand: "B&B Italia",
    unit_cost: 24000,
    note: "Like-kind upgrade — Italian luxury seating matching demonstrated aesthetic",
  },
  "George Smith Scroll Armchair": {
    description: "Blenheim Chair hand-built English wool",
    brand: "George Smith",
    unit_cost: 9500,
    note: "Same brand, premium model",
  },
  "Wooden Dining Table": {
    description: "Van Dyck dining table solid walnut",
    brand: "Minotti",
    unit_cost: 22000,
    note: "Like-kind upgrade — Italian modern matching Glas Italia coffee table",
  },
  "Dining Chairs": {
    description: "Monarch dining chair solid walnut + leather",
    brand: "de la Espada",
    unit_cost: 3200,
    note: "Like-kind upgrade — per chair price reflecting quality tier",
  },
  "ABC Carpet & Home Area Rug": {
    description: "Hand-knotted wool/silk rug 10x14",
    brand: "Stark Carpet",
    unit_cost: 14500,
    note: "Like-kind upgrade — custom hand-knotted vs machine made",
  },
  "Standup piano": {
    description: "U3 upright piano polished ebony",
    brand: "Yamaha",
    unit_cost: 9500,
    note: "Like-kind upgrade — professional grade upright",
  },
  "Glas Italia Coffee Table": {
    description: "Butterfly crystal glass coffee table",
    brand: "Glas Italia",
    unit_cost: 9500,
    note: "Same brand, premium model",
  },
  "Refrigerator": {
    description: "36in French door refrigerator",
    brand: "Sub-Zero",
    unit_cost: 14500,
    note: "Like-kind upgrade — professional grade refrigerator",
  },
  "Kitchen Island": {
    description: "Custom waterfall island Calacatta marble",
    brand: "",
    unit_cost: 28000,
    note: "Like-kind upgrade — premium custom fabrication",
  },
  "Pendant Lights": {
    description: "Circuit pendant light",
    brand: "Apparatus Studio",
    unit_cost: 8400,
    note: "Like-kind upgrade — designer lighting matching profile",
  },
  "Casper Twin Mattress": {
    description: "Wave Hybrid twin mattress",
    brand: "Casper",
    unit_cost: 2400,
    note: "Same brand, premium model",
  },
  "Nectar mattress": {
    description: "Saatva Classic queen mattress",
    brand: "Saatva",
    unit_cost: 2800,
    note: "Like-kind upgrade — premium sleep brand",
  },
  "Electric bicycle": {
    description: "Turbo Vado SL electric bike",
    brand: "Specialized",
    unit_cost: 4800,
    note: "Like-kind upgrade — premium e-bike brand",
  },
  "Epson 1080 projector": {
    description: "Sony VPL-XW7000ES 4K laser projector",
    brand: "Sony",
    unit_cost: 5000,
    note: "Like-kind upgrade — cinema grade projection",
  },
  "Sony a6600 camera": {
    description: "FX3 Cinema Line camera",
    brand: "Sony",
    unit_cost: 3800,
    note: "Same brand, cinema line upgrade",
  },
  "Wooden desk": {
    description: "Custom walnut desk",
    brand: "",
    unit_cost: 6500,
    note: "Like-kind upgrade — custom fabrication",
  },
  "Womb Chair and Ottoman": {
    description: "Womb Chair reupholstered Knoll wool",
    brand: "Knoll",
    unit_cost: 7500,
    note: "Same piece, premium reupholstery",
  },
};

// ── Category bundles ──────────────────────────────────────────────────────────

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
      items_affected: [
        "Bowl with food", "Matcha tea container", "Ceramic tea pot",
        "Tea bowls", "Black Vase", "Heath Ceramics Vase", "Beige Vase",
        "Rose Quartz", "Decorative Bowl with spheres", "Vase",
      ],
      upgrade_value: 4200,
      original_value: 1307,
      brand: "Heath Ceramics + Dinosaur Designs + Jicon",
      note: "Coherent upgrade of all ceramic and decorative objects as a curated collection",
    },
    {
      name: "Seating Upgrade",
      description: "Upgrade sofa and armchair as a set",
      items_affected: ["8ft RH Maxwell Sofa", "George Smith Scroll Armchair"],
      upgrade_value: 33500,
      original_value: 13100,
      brand: "B&B Italia + George Smith",
      note: "Complete seating upgrade to Italian/British luxury tier",
    },
    {
      name: "Dining Room Set",
      description: "Upgrade table and chairs together",
      items_affected: ["Wooden Dining Table", "Dining Chairs", "Pearl inlaid wood side table"],
      upgrade_value: 47800,
      original_value: 8300,
      brand: "Minotti + de la Espada",
      note: "Complete dining room upgrade",
    },
    {
      name: "Art Books Collection",
      description: "Upgrade to Assouline luxury editions",
      items_affected: ["Art books"],
      upgrade_value: 15000,
      original_value: 9000,
      brand: "Assouline",
      note: "Upgrade to premium art book publisher",
    },
    {
      name: "Piano Upgrade",
      description: "Standup to quality upright",
      items_affected: ["Standup piano"],
      upgrade_value: 9500,
      original_value: 3000,
      brand: "Yamaha",
      note: "Like-kind upgrade to professional grade",
    },
  ],
  "Kitchen": [
    {
      name: "Matcha Ritual Set",
      description: "Complete matcha preparation upgrade",
      items_affected: ["Matcha tea container", "matcha whisk", "ceramic teapot", "Ceramic Teapot"],
      upgrade_value: 2800,
      original_value: 685,
      brand: "Jicon + Ippodo",
      note: "Coherent upgrade of matcha ritual items",
    },
    {
      name: "Kitchen Essentials",
      description: "Cookware, knives, and small appliances",
      items_affected: ["Air Fryer", "Nugget Ice Machine"],
      upgrade_value: 12500,
      original_value: 500,
      brand: "All-Clad + Breville + Vitamix",
      note: "Complete kitchen cooking essentials",
    },
    {
      name: "Table Setting Collection",
      description: "Dinnerware, placemats, and serving pieces",
      items_affected: ["East Fork salad bowls", "Chilewich placemats", "Ceramic Bowl"],
      upgrade_value: 4800,
      original_value: 879,
      brand: "Mud Australia + Chilewich",
      note: "Coherent table setting upgrade",
    },
  ],
  "Bedroom Orly": [
    {
      name: "Sony Camera System",
      description: "Complete Sony lens and accessory kit",
      items_affected: [
        "Sony a6100 camera", "Sony a6600 camera",
        "Sony a6000 camera", "Sony A7sii batteries",
      ],
      upgrade_value: 18500,
      original_value: 2660,
      brand: "Sony",
      note: "Complete Sony ecosystem upgrade with lenses and accessories",
    },
    {
      name: "Audio Production Kit",
      description: "Upgrade microphones and audio gear",
      items_affected: ["Sennheiser shotgun mic", "Sennheiser directional mic"],
      upgrade_value: 3800,
      original_value: 1400,
      brand: "Sennheiser + Rode",
      note: "Professional audio production upgrade",
    },
  ],
  "Bedroom Rafe": [
    {
      name: "Sports Memorabilia Display",
      description: "Museum-quality display for all memorabilia",
      items_affected: [
        "Carmelo Anthony Signed Game-Worn Nuggets Jersey",
        "Autographed Sports Memorabilia", "Jerseys",
      ],
      upgrade_value: 12000,
      original_value: 7675,
      brand: "Custom museum framing",
      note: "Professional display upgrade for entire memorabilia collection",
    },
    {
      name: "Baseball Card Collection",
      description: "1994 complete DeBasel print run",
      items_affected: [],
      upgrade_value: 14000,
      original_value: 0,
      brand: "DeBasel",
      note: "Addition — 1994 MLB complete print run all major sets",
    },
  ],
  "Garage": [
    {
      name: "Surf Kit Upgrade",
      description: "Boards, wetsuits, and storage",
      items_affected: ["Surf boards", "Surf board wax", "wet suits", "flippers", "Snorkel"],
      upgrade_value: 8500,
      original_value: 1357,
      brand: "Channel Islands + O'Neill",
      note: "Complete surf kit upgrade",
    },
    {
      name: "Tennis Collection",
      description: "Racquets, bag, and accessories",
      items_affected: [
        "Tennis racquets", "tennis racquet strings",
        "tennis balls", "Wilson tennis racquet bag",
      ],
      upgrade_value: 2800,
      original_value: 807,
      brand: "Wilson",
      note: "Complete tennis kit upgrade",
    },
    {
      name: "Cycling Kit",
      description: "E-bikes, helmets, locks, and bags",
      items_affected: ["Electric bicycle", "Bike helmet", "bicycle bag", "Litelok bike lock"],
      upgrade_value: 16000,
      original_value: 7791,
      brand: "Specialized + Litelok",
      note: "Complete cycling kit upgrade",
    },
  ],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function findUpgrade(description: string): UpgradeEntry | null {
  if (UPGRADE_MAP[description]) return UPGRADE_MAP[description];
  const lower = description.toLowerCase();
  for (const [key, val] of Object.entries(UPGRADE_MAP)) {
    if (lower.includes(key.toLowerCase()) || key.toLowerCase().includes(lower)) {
      return val;
    }
  }
  return null;
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── ItemCard ──────────────────────────────────────────────────────────────────

function ItemCard({
  item,
  onUpgrade,
}: {
  item: ClaimItem;
  onUpgrade: (item: ClaimItem, upgrade: UpgradeEntry) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const upgrade = findUpgrade(item.description);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="font-medium text-gray-900 leading-snug">{item.description}</h3>
          {item.brand && (
            <p className="mt-0.5 text-xs text-gray-500">Brand: {item.brand}</p>
          )}
          <p className="mt-1 text-xs text-gray-400">
            Qty: {item.qty} · {formatCurrency(item.unit_cost)}
          </p>
        </div>

        {upgrade && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="shrink-0 text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Upgrade?
          </button>
        )}
      </div>

      {expanded && upgrade && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Suggested Upgrade
          </p>
          <div className="rounded-lg border border-blue-100 bg-[#EFF6FF] p-3">
            <p className="font-semibold text-gray-900">
              {upgrade.brand ? `${upgrade.brand} ` : ""}
              {upgrade.description}
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular-nums text-gray-900">
              {formatCurrency(upgrade.unit_cost)}
              {item.qty > 1 && (
                <span className="ml-1 text-xs font-normal text-gray-400">
                  × {item.qty} = {formatCurrency(upgrade.unit_cost * item.qty)}
                </span>
              )}
            </p>
            <p className="mt-1.5 text-xs italic text-gray-500">
              &ldquo;{upgrade.note}&rdquo;
            </p>
          </div>

          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => {
                onUpgrade(item, upgrade);
                setExpanded(false);
              }}
              className="rounded-md bg-[#16A34A] px-3.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700"
            >
              ✓ Accept Upgrade
            </button>
            <button
              onClick={() => setExpanded(false)}
              className="text-xs text-gray-400 transition-colors hover:text-gray-600"
            >
              ✗ Keep Original
            </button>
          </div>
        </div>
      )}
    </div>
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
    <div className="mb-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
        Category Upgrades
      </p>

      {/* Chips */}
      <div className="flex flex-wrap gap-2 mb-3">
        {bundles.map((b) => {
          const uplift = b.upgrade_value - b.original_value;
          const applied = appliedBundles.has(b.name);
          const active = openBundle === b.name;

          return (
            <button
              key={b.name}
              onClick={() => setOpenBundle(active ? null : b.name)}
              className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                applied
                  ? "border-green-300 bg-green-50 text-green-700"
                  : active
                  ? "border-[#2563EB] bg-blue-50 text-[#2563EB]"
                  : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
              }`}
            >
              {applied ? "✓ " : ""}
              {b.name}{" "}
              <span className={applied ? "text-green-500" : "text-gray-400"}>
                +{formatCurrency(uplift)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Expanded card */}
      {openBundle && (() => {
        const bundle = bundles.find((b) => b.name === openBundle)!;
        const uplift = bundle.upgrade_value - bundle.original_value;
        const applied = appliedBundles.has(bundle.name);
        const affectedItems = items.filter((item) =>
          bundle.items_affected.some(
            (a) =>
              item.description.toLowerCase().includes(a.toLowerCase()) ||
              a.toLowerCase().includes(item.description.toLowerCase())
          )
        );

        return (
          <div className="rounded-lg border border-blue-100 bg-white p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">{bundle.name}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{bundle.description}</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-lg font-bold tabular-nums text-gray-900">
                  +{formatCurrency(uplift)}
                </p>
                <p className="text-xs text-gray-400">
                  {formatCurrency(bundle.original_value)} → {formatCurrency(bundle.upgrade_value)}
                </p>
              </div>
            </div>

            {bundle.brand && (
              <p className="text-xs text-gray-500 mb-3">
                <span className="font-medium">Brand: </span>{bundle.brand}
              </p>
            )}

            {affectedItems.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-gray-400 mb-1.5">Items affected:</p>
                <ul className="space-y-1">
                  {affectedItems.map((item, i) => (
                    <li key={i} className="flex items-center justify-between text-xs text-gray-600">
                      <span className="truncate mr-2">{item.description}</span>
                      <span className="shrink-0 tabular-nums text-gray-400">
                        {formatCurrency(item.unit_cost * item.qty)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {bundle.items_affected.length === 0 && (
              <p className="mb-3 text-xs text-gray-500 italic">
                This is a new addition — no existing items affected.
              </p>
            )}

            <p className="mb-3 text-xs italic text-gray-500">&ldquo;{bundle.note}&rdquo;</p>

            <div className="flex items-center gap-3">
              {applied ? (
                <span className="text-xs font-medium text-green-600">✓ Applied</span>
              ) : (
                <button
                  onClick={() => {
                    onApply(bundle);
                    setOpenBundle(null);
                  }}
                  className="rounded-md bg-[#16A34A] px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700"
                >
                  ✓ Apply Category Upgrade
                </button>
              )}
              <button
                onClick={() => setOpenBundle(null)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                ✗ Cancel
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

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

  useEffect(() => {
    bootstrap();
  }, [roomSlug]);

  async function bootstrap() {
    setIsLoading(true);
    setItems([]);
    setAppliedBundles(new Set());

    const sess = await loadSession();
    setSession(sess);

    if (!sess?.claim_items?.length) {
      setIsLoading(false);
      return;
    }

    const rooms =
      sess.room_summary?.map((r) => r.room) ??
      [...new Set(sess.claim_items.map((i) => i.room))];
    setAllRooms(rooms);

    const name =
      SLUG_TO_ROOM[roomSlug] ??
      rooms.find((r) => slugify(r) === roomSlug) ??
      "";
    setRoomName(name);

    if (!name) {
      setIsLoading(false);
      return;
    }

    setItems(sess.claim_items.filter((i) => i.room === name));
    setIsLoading(false);
  }

  // ── Item upgrade: replace the item's data in claim_items ──────────────────

  async function handleUpgrade(item: ClaimItem, upgrade: UpgradeEntry) {
    if (!session?.claim_items) return;
    setIsSaving(true);

    const updatedClaimItems = session.claim_items.map((ci) => {
      if (
        ci.room === item.room &&
        ci.description === item.description &&
        ci.unit_cost === item.unit_cost
      ) {
        return {
          ...ci,
          description: upgrade.description,
          brand: upgrade.brand,
          unit_cost: upgrade.unit_cost,
        };
      }
      return ci;
    });

    await saveSession({ claim_items: updatedClaimItems });
    setSession((prev) => prev ? { ...prev, claim_items: updatedClaimItems } : prev);
    setItems(updatedClaimItems.filter((i) => i.room === roomName));
    setIsSaving(false);
  }

  // ── Category upgrade: remove affected items, add bundle item ──────────────

  async function handleApplyCategoryBundle(bundle: CategoryBundle) {
    if (!session?.claim_items) return;
    setIsSaving(true);

    const affectedLower = bundle.items_affected.map((a) => a.toLowerCase());

    const filtered = session.claim_items.filter((ci) => {
      if (ci.room !== roomName) return true;
      const dl = ci.description.toLowerCase();
      return !affectedLower.some(
        (a) => dl.includes(a) || a.includes(dl)
      );
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
    };

    const updated = [...filtered, bundleItem];
    await saveSession({ claim_items: updated });
    setSession((prev) => prev ? { ...prev, claim_items: updated } : prev);
    setItems(updated.filter((i) => i.room === roomName));
    setAppliedBundles((prev) => new Set([...prev, bundle.name]));
    setIsSaving(false);
  }

  // ── Derived ───────────────────────────────────────────────────────────────

  const roomBudget = session?.room_budgets?.[roomName] ?? 0;
  const roomTotal = items.reduce((s, i) => s + i.unit_cost * i.qty, 0);
  const budgetPct = roomBudget > 0 ? Math.min(100, (roomTotal / roomBudget) * 100) : 0;

  const roomIdx = allRooms.indexOf(roomName);
  const prevRoom = roomIdx > 0 ? allRooms[roomIdx - 1] : null;
  const nextRoom = roomIdx < allRooms.length - 1 ? allRooms[roomIdx + 1] : null;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link href="/review" className="mb-1 block text-xs text-gray-400 hover:text-gray-600">
              ← All Rooms
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">{roomName}</h1>
              <span className="tabular-nums text-sm text-gray-500">
                {formatCurrency(roomTotal)}
                {roomBudget > 0 && (
                  <span className="text-gray-400"> / {formatCurrency(roomBudget)}</span>
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isSaving && <Spinner />}
            <Link
              href={`/review/bundles/${roomSlug}`}
              className="rounded-md bg-[#2563EB] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
            >
              Browse Bundles →
            </Link>
          </div>
        </div>

        {roomBudget > 0 && (
          <div className="mt-3">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className={`h-full rounded-full transition-all ${
                  budgetPct >= 100 ? "bg-green-500" : budgetPct >= 80 ? "bg-amber-500" : "bg-[#2563EB]"
                }`}
                style={{ width: `${budgetPct}%` }}
              />
            </div>
            <p className="mt-0.5 text-xs text-gray-400">{budgetPct.toFixed(0)}% of budget</p>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="flex-1 px-6 py-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-lg border border-gray-200 bg-white p-4">
                <div className="h-4 w-48 rounded bg-gray-200 mb-2" />
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
          <>
            {/* Category Upgrades */}
            <CategoryUpgradesSection
              roomName={roomName}
              items={items}
              appliedBundles={appliedBundles}
              onApply={handleApplyCategoryBundle}
            />

            {/* Item list */}
            <div className="space-y-2">
              {items.map((item, idx) => (
                <ItemCard
                  key={`${generateItemId(item)}-${idx}`}
                  item={item}
                  onUpgrade={handleUpgrade}
                />
              ))}
            </div>
          </>
        )}
      </main>

      {/* Sticky footer */}
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
                href="/review"
                className="rounded-md border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                ← All Rooms
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
