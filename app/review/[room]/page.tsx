"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { loadSession, saveSession, SessionData } from "../../lib/session";
import { ClaimItem } from "../../lib/types";
import { generateItemId, slugify, formatCurrency } from "../../lib/utils";
interface UpgradeProduct {
  title: string;
  brand: string;
  model: string;
  price: number;
  retailer: string;
  url: string;
  thumbnail?: string;
}

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

// ── Part 3 — Item Card with 4-position toggle + custom form ──────────────────

interface UpgradeOption {
  label: string;
  price: number;
  title: string;
  brand: string;
  model: string;
  retailer: string;
  url: string;
}

const TOTAL_POSITIONS = 4; // 0=Original, 1=Mid, 2=Premium, 3=Custom

function ItemCard({
  item,
  onUpgrade,
}: {
  item: ClaimItem;
  onUpgrade: (item: ClaimItem, option: UpgradeOption) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeResult, setUpgradeResult] = useState<{ mid: UpgradeProduct; premium: UpgradeProduct } | null>(null);
  const [upgradeError, setUpgradeError] = useState(false);
  const [pos, setPos] = useState(0);
  const [applying, setApplying] = useState(false);

  // Custom form state (position 3)
  const [customDesc, setCustomDesc] = useState("");
  const [customBrand, setCustomBrand] = useState("");
  const [customPrice, setCustomPrice] = useState("");

  const isCustomPos = pos === 3;
  const customValid = customDesc.trim().length > 0 && parseFloat(customPrice) > 0;

  // Open panel, jump to position 1, and fire API immediately
  function handleOpen() {
    console.log("Upgrade requested for:", item.description, item.unit_cost);
    setOpen(true);
    setPos(1);
    fetchUpgrades();
  }

  function handleClose() {
    setOpen(false);
    setPos(0);
  }

  async function fetchUpgrades() {
    if (upgradeResult || upgradeLoading) return;
    console.log("Fetching upgrades for:", item.description);
    setUpgradeLoading(true);
    setUpgradeError(false);
    try {
      const res = await fetch("/api/search-upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_description: item.description,
          brand: item.brand || "",
          current_price: item.unit_cost,
          category: item.category || "",
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { mid: UpgradeProduct; premium: UpgradeProduct };
      console.log("Upgrade result for:", item.description, data);
      setUpgradeResult(data);
    } catch (err) {
      console.error("Upgrade search failed for:", item.description, err);
      setUpgradeError(true);
    } finally {
      setUpgradeLoading(false);
    }
  }

  function handlePositionChange(newPos: number) {
    setPos(newPos);
    // Also fire if somehow we arrive at 1/2 without a result yet
    if ((newPos === 1 || newPos === 2) && !upgradeResult && !upgradeLoading) {
      fetchUpgrades();
    }
  }

  // Build the 4-option list (mid/premium slots may be loading placeholders)
  function getOptionContent(): { label: string; node: React.ReactNode; canApply: boolean; applyFn: () => Promise<void> } {
    if (pos === 0) {
      return {
        label: "Original",
        canApply: false,
        applyFn: async () => {},
        node: (
          <div className="text-center py-2">
            <p className="text-base font-semibold text-gray-900 leading-snug mb-1">{item.description}</p>
            {item.brand && <p className="text-sm text-gray-500 mb-1">{item.brand}</p>}
            <p className="text-sm text-gray-400 mb-1">Qty: {item.qty} · {formatCurrency(item.unit_cost)}</p>
            <p className="text-2xl font-bold tabular-nums text-gray-900 mt-2">{formatCurrency(item.unit_cost * item.qty)}</p>
          </div>
        ),
      };
    }

    if (pos === 1 || pos === 2) {
      const isMid = pos === 1;
      const label = isMid ? "Mid Upgrade" : "Premium";

      if (upgradeLoading) {
        return {
          label,
          canApply: false,
          applyFn: async () => {},
          node: (
            <div className="flex flex-col items-center gap-3 py-6 text-gray-400">
              <SmallSpinner />
              <span className="text-sm">Finding upgrades…</span>
            </div>
          ),
        };
      }

      if (upgradeError || !upgradeResult) {
        return {
          label,
          canApply: false,
          applyFn: async () => {},
          node: (
            <div className="py-4 text-center">
              <p className="text-sm font-medium text-gray-600 mb-1">No standard upgrade found</p>
              <p className="text-xs text-gray-400 mb-3">Add a custom item below ↓</p>
              {upgradeError && (
                <button
                  onClick={() => { setUpgradeResult(null); setUpgradeError(false); fetchUpgrades(); }}
                  className="text-xs text-[#2563EB] hover:underline"
                >Try again</button>
              )}
            </div>
          ),
        };
      }

      const prod = isMid ? upgradeResult.mid : upgradeResult.premium;
      const option: UpgradeOption = {
        label,
        price: prod.price,
        title: prod.title,
        brand: prod.brand,
        model: prod.model,
        retailer: prod.retailer,
        url: prod.url,
      };

      return {
        label,
        canApply: true,
        applyFn: async () => {
          setApplying(true);
          await onUpgrade(item, option);
          setApplying(false);
          setOpen(false);
        },
        node: (
          <div className="text-center">
            {prod.thumbnail && (
              <img
                src={prod.thumbnail}
                alt={prod.title}
                className="mx-auto mb-3 h-[60px] w-[60px] rounded-lg object-contain border border-gray-100"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <p className="text-base font-semibold text-gray-900 leading-snug mb-1 line-clamp-2">{prod.title}</p>
            {prod.brand && prod.brand !== prod.retailer && (
              <p className="text-sm text-gray-500 mb-0.5">{prod.brand}</p>
            )}
            {prod.retailer && (
              <p className="text-sm text-gray-500 mb-0.5">{prod.retailer}</p>
            )}
            <p className="text-2xl font-bold tabular-nums text-gray-900 my-2">{formatCurrency(prod.price)}</p>
            {item.qty > 1 && (
              <p className="text-sm text-gray-400 mb-2">× {item.qty} = {formatCurrency(prod.price * item.qty)}</p>
            )}
            <p className="text-xs text-gray-400 mb-2">Available as of 2024</p>
            <a
              href={prod.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-sm font-medium text-blue-600 underline hover:text-blue-800"
            >
              View at {prod.retailer || "retailer"} ↗
            </a>
          </div>
        ),
      };
    }

    // pos === 3 — Custom
    const customOption: UpgradeOption = {
      label: "Custom",
      price: parseFloat(customPrice) || 0,
      title: customDesc.trim(),
      brand: customBrand.trim(),
      model: "",
      retailer: "",
      url: "",
    };

    return {
      label: "Custom Item",
      canApply: customValid,
      applyFn: async () => {
        if (!customValid) return;
        setApplying(true);
        await onUpgrade(item, customOption);
        setApplying(false);
        setOpen(false);
      },
      node: (
        <div className="space-y-3 text-left">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Description <span className="text-red-400">*</span></label>
            <input
              type="text" value={customDesc} onChange={(e) => setCustomDesc(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="e.g. Wilson Pro Staff tennis racquet"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Brand <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              type="text" value={customBrand} onChange={(e) => setCustomBrand(e.target.value)}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="e.g. Wilson"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Price <span className="text-red-400">*</span></label>
            <div className="flex items-center gap-1">
              <span className="text-gray-400 font-medium">$</span>
              <input
                type="number" value={customPrice} onChange={(e) => setCustomPrice(e.target.value)}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="0" min="0" step="any"
              />
            </div>
          </div>
        </div>
      ),
    };
  }

  const content = open ? getOptionContent() : null;

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-4">
        <div className="flex-1 min-w-0">
          <p className="text-base font-medium text-gray-900 leading-snug">{item.description}</p>
          {item.brand && <p className="text-sm text-gray-400 mt-0.5">{item.brand}</p>}
          <p className="text-sm text-gray-400 mt-0.5">Qty: {item.qty} · {formatCurrency(item.unit_cost)}</p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <p className="tabular-nums text-base font-bold text-gray-900 hidden sm:block">{formatCurrency(item.unit_cost * item.qty)}</p>
          {(item.unit_cost >= 100 || !!item.brand) && (
            <button
              onClick={open ? handleClose : handleOpen}
              className={`min-h-[40px] rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                open ? "border-green-300 bg-green-50 text-green-700" : "border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              {open ? "✓ Close" : "↕"}
            </button>
          )}
        </div>
      </div>

      {/* 4-position toggle panel */}
      {open && content && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-5">
          {/* Position nav */}
          <div className="flex items-stretch gap-2 mb-4">
            <button
              onClick={() => handlePositionChange(Math.max(0, pos - 1))}
              disabled={pos === 0}
              className="text-2xl text-gray-300 disabled:opacity-20 hover:text-gray-600 px-1 self-center"
            >◀</button>

            <div className="flex-1 rounded-xl border-2 border-[#2563EB] bg-white p-4 min-h-[120px] flex flex-col justify-center">
              <p className="text-xs font-bold uppercase tracking-wider text-[#2563EB] mb-3 text-center">
                {content.label}
              </p>
              {content.node}
            </div>

            <button
              onClick={() => handlePositionChange(Math.min(TOTAL_POSITIONS - 1, pos + 1))}
              disabled={pos === TOTAL_POSITIONS - 1}
              className="text-2xl text-gray-300 disabled:opacity-20 hover:text-gray-600 px-1 self-center"
            >▶</button>
          </div>

          {/* Position dots with labels */}
          <div className="flex justify-center gap-3 mb-4">
            {(["Original", "Mid", "Premium", "+"] as const).map((lbl, i) => (
              <button
                key={i}
                onClick={() => handlePositionChange(i)}
                className="flex flex-col items-center gap-1"
              >
                <span className={`h-2.5 w-2.5 rounded-full transition-colors ${i === pos ? "bg-[#2563EB]" : "bg-gray-200"}`} />
                <span className={`text-xs ${i === pos ? "font-bold text-[#2563EB]" : "text-gray-300"}`}>{lbl}</span>
              </button>
            ))}
          </div>

          {/* Apply / hint */}
          {content.canApply ? (
            <button
              onClick={content.applyFn}
              disabled={applying}
              className="flex w-full min-h-[48px] items-center justify-center gap-2 rounded-xl bg-[#16A34A] text-base font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              {applying ? <SmallSpinner /> : null}
              {applying ? "Saving…" : isCustomPos ? "Save Custom Item" : "Apply"}
            </button>
          ) : pos === 0 ? (
            <p className="text-center text-sm text-gray-400">◀ ▶ to see upgrade options</p>
          ) : isCustomPos ? (
            <p className="text-center text-sm text-gray-400">Fill in description and price to save</p>
          ) : null}
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

  useEffect(() => { bootstrap(); }, [roomSlug]);

  async function bootstrap() {
    setIsLoading(true);
    setItems([]);
    setAppliedBundles(new Set());

    const sess = await loadSession();
    setSession(sess);
    if (!sess?.claim_items?.length) { setIsLoading(false); return; }

    const rooms = sess.room_summary?.map((r) => r.room) ?? [...new Set(sess.claim_items.map((i) => i.room))];
    setAllRooms(rooms);

    const name = SLUG_TO_ROOM[roomSlug] ?? rooms.find((r) => slugify(r) === roomSlug) ?? "";
    setRoomName(name);
    if (!name) { setIsLoading(false); return; }

    setItems(sess.claim_items.filter((i) => i.room === name));
    setIsLoading(false);
  }

  // ── Upgrade: replace item with selected option ────────────────────────────

  async function handleUpgrade(item: ClaimItem, option: UpgradeOption) {
    if (!session?.claim_items) return;
    setIsSaving(true);

    const updated = session.claim_items.map((ci) => {
      if (ci.room === item.room && ci.description === item.description && ci.unit_cost === item.unit_cost) {
        return {
          ...ci,
          description: option.title,
          brand: option.brand,
          model: option.model,
          unit_cost: option.price,
          age_years: 0,
          age_months: 0,
          condition: "New" as const,
          vendor_url: option.url,
          vendor_name: option.retailer,
        };
      }
      return ci;
    });

    await saveSession({ claim_items: updated });
    setSession((prev) => prev ? { ...prev, claim_items: updated } : prev);
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
      room: roomName, description: bundle.name, brand: bundle.brand,
      model: "", qty: 1, age_years: 0, age_months: 0,
      condition: "New", unit_cost: bundle.upgrade_value, category: "Category Upgrade",
    };

    const updated = [...filtered, bundleItem];
    await saveSession({ claim_items: updated });
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen flex-col">
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
            <CategoryUpgradesSection
              roomName={roomName}
              items={items}
              appliedBundles={appliedBundles}
              onApply={handleApplyCategoryBundle}
            />
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

      <footer className="sticky bottom-0 z-10 border-t border-gray-200 bg-white/95 px-6 py-4 backdrop-blur">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-6">
          <div className="flex-1">
            {roomBudget > 0 ? (
              <>
                <div className="mb-1 flex items-center justify-between text-base">
                  <span className="font-bold text-gray-900">Room Total: {formatCurrency(roomTotal)}</span>
                  <span className="tabular-nums text-gray-500">{formatCurrency(roomBudget - roomTotal)} remaining</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                  <div
                    className={`h-full rounded-full transition-all ${budgetPct >= 100 ? "bg-green-500" : budgetPct >= 80 ? "bg-amber-500" : "bg-[#2563EB]"}`}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              </>
            ) : (
              <span className="text-base font-bold text-gray-900">Room Total: {formatCurrency(roomTotal)}</span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {prevRoom ? (
              <Link href={`/review/${slugify(prevRoom)}`} className="min-h-[44px] flex items-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                ← {prevRoom}
              </Link>
            ) : (
              <Link href="/review" className="min-h-[44px] flex items-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
                ← All Rooms
              </Link>
            )}
            {nextRoom && (
              <Link href={`/review/${slugify(nextRoom)}`} className="min-h-[44px] flex items-center rounded-xl bg-[#2563EB] px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700">
                {nextRoom} →
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
