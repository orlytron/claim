"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BUNDLES_DATA, Bundle, BundleItem } from "../lib/bundles-data";
import { loadSession, saveSession } from "../lib/session";
import { ClaimItem } from "../lib/types";
import { supabase } from "../lib/supabase";
import { formatCurrency } from "../lib/utils";
import { useClaimMode } from "../lib/useClaimMode";

// Part 5 — verify local bundle data is loaded
console.log("Bundles loaded:", BUNDLES_DATA.length);

// ── Constants ─────────────────────────────────────────────────────────────────

const TARGET = 1_600_000;
const MAX_ROOM_ALLOC = 400_000;
const LS_DECISIONS = "bundle_decisions_v1";

const ROOMS: { name: string; slug: string; display?: string }[] = [
  { name: "Living Room", slug: "living-room" },
  { name: "Kitchen", slug: "kitchen" },
  { name: "David Office / Guest Room", slug: "david-office-guest-room", display: "David Office" },
  { name: "Bedroom Orly", slug: "bedroom-orly" },
  { name: "Bedroom Rafe", slug: "bedroom-rafe" },
  { name: "Patio", slug: "patio" },
  { name: "Garage", slug: "garage" },
  { name: "Bathroom Master", slug: "bathroom-master" },
  { name: "Bathroom White", slug: "bathroom-white" },
];

// ── localStorage helpers ──────────────────────────────────────────────────────

function getLocalDecisions(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try { return JSON.parse(localStorage.getItem(LS_DECISIONS) ?? "{}"); } catch { return {}; }
}
function setLocalDecision(code: string, action: string) {
  const d = getLocalDecisions(); d[code] = action;
  localStorage.setItem(LS_DECISIONS, JSON.stringify(d));
}

// ── Basic helpers ─────────────────────────────────────────────────────────────

function compact(v: number) {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
}

function itemPlaus(unit_cost: number) {
  if (unit_cost > 15000) return { label: "Review", dot: "bg-red-500" };
  if (unit_cost > 5000) return { label: "Medium", dot: "bg-amber-500" };
  return { label: "Easy", dot: "bg-green-500" };
}

function getClosestBundle(bundles: Bundle[], allocation: number): Bundle | null {
  if (!bundles.length || allocation <= 0) return null;
  return bundles.reduce((best, b) =>
    Math.abs(b.total_value - allocation) < Math.abs(best.total_value - allocation) ? b : best
  );
}

// ── Part 1 — Blended item helpers ─────────────────────────────────────────────

interface BlendedItem {
  conceptKey: string;
  item: BundleItem;
  bundleValue: number;
  category: string;
}

/** Maps an item description to a canonical "concept" so the same slot upgrades gracefully. */
function getConceptKey(description: string): string {
  const d = description.toLowerCase();
  if (d.includes("piano")) return "piano";
  if (d.includes("area rug") || d.includes("carpet") || /rug\s+\d+x\d+/.test(d) || /\d+x\d+\s+rug/.test(d)) return "rug";
  if (d.includes("floor lamp") || (d.includes("arc") && d.includes("lamp"))) return "floor_lamp";
  if (d.includes("table lamp") || (d.includes("lamp") && !d.includes("floor"))) return "table_lamp";
  if (d.includes("pendant") || d.includes("chandelier")) return "pendant_light";
  if (d.includes("drapes") || d.includes("shades") || d.includes("curtain") || d.includes("panels")) return "window_treatment";
  if (d.includes("throw") && !d.includes("pillow")) return "throw_blanket";
  if (d.includes("pillow")) return "pillows";
  if (d.includes("sofa") || d.includes("couch")) return "sofa";
  if (d.includes("coffee table")) return "coffee_table";
  if (d.includes("espresso") || d.includes("coffee machine")) return "espresso_machine";
  if (d.includes("wine") && (d.includes("refrigerator") || d.includes("storage") || d.includes("cellar"))) return "wine_storage";
  if ((d.includes("refrigerator") || d.includes("fridge")) && !d.includes("wine")) return "refrigerator";
  if (d.includes("mattress")) return "mattress";
  if (d.includes("bed frame") || (d.includes("bed") && !d.includes("mattress"))) return "bed_frame";
  if (d.includes("electric bike") || d.includes("e-bike") || d.includes("ebike")) return "electric_bike";
  if (d.includes("surfboard")) return "surfboard";
  if (d.includes("console table")) return "console_table";
  if (d.includes("credenza") || d.includes("sideboard")) return "sideboard";
  // Unique item — use truncated description as key
  return `u::${description.slice(0, 32)}`;
}

/** Computes the "blended" item list: for each concept, show the highest-tier version within the current allocation. */
function computeBlendedItems(bundles: Bundle[], allocation: number): BlendedItem[] {
  if (!bundles.length) return [];
  const sorted = [...bundles].sort((a, b) => a.total_value - b.total_value);
  const conceptMap = new Map<string, BlendedItem>();

  if (allocation <= 0) {
    // No allocation yet — show nothing
    return [];
  }

  for (const bundle of sorted) {
    if (bundle.total_value > allocation) break;
    for (const item of bundle.items) {
      const conceptKey = getConceptKey(item.description);
      conceptMap.set(conceptKey, { conceptKey, item, bundleValue: bundle.total_value, category: item.category });
    }
  }

  // If allocation is below even the first bundle, show the first bundle's items faintly
  if (conceptMap.size === 0 && sorted.length > 0) {
    for (const item of sorted[0].items) {
      const conceptKey = getConceptKey(item.description);
      conceptMap.set(conceptKey, { conceptKey, item, bundleValue: sorted[0].total_value, category: item.category });
    }
  }

  return Array.from(conceptMap.values());
}

// ── Part 2 — Singleton duplicate detection ────────────────────────────────────

function getSingletonKey(description: string): string | null {
  const d = description.toLowerCase();
  if (d.includes("sofa") || d.includes("couch")) return "sofa";
  if (d.includes("dining table")) return "dining_table";
  if (d.includes("coffee table")) return "coffee_table";
  if (d.includes("piano")) return "piano";
  if ((d.includes("refrigerator") || d.includes("fridge")) && !d.includes("wine")) return "refrigerator";
  if (d.includes("area rug") || /rug\s+\d+x\d+/.test(d) || /\d+x\d+\s+rug/.test(d)) return "rug";
  if (d.includes("espresso")) return "espresso_machine";
  if (d.includes("chandelier") || (d.includes("pendant") && d.includes("custom"))) return "chandelier";
  if (d.includes("wine") && d.includes("refrigerator")) return "wine_fridge";
  return null;
}

// ── UI atoms ──────────────────────────────────────────────────────────────────

function SmallSpinner() {
  return (
    <svg className="h-5 w-5 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => { const t = setTimeout(onDismiss, 4000); return () => clearTimeout(t); }, [onDismiss]);
  return (
    <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-gray-900 px-6 py-4 text-base text-white shadow-2xl whitespace-nowrap">
      <span className="text-green-400 mr-2">✓</span>{message}
    </div>
  );
}

// ── Part 2 + FIX 4 — Accordion Item Picker with inline singleton detection ─────

function ItemPicker({
  room,
  bundles,
  onAdd,
  onClose,
}: {
  room: string;
  bundles: Bundle[];
  onAdd: (items: BundleItem[]) => void;
  onClose: () => void;
}) {
  const sweetCode = bundles.find((b) => b.sweet_spot)?.bundle_code ?? bundles[0]?.bundle_code ?? null;
  const [openCode, setOpenCode] = useState<string | null>(sweetCode);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // Map from item description → conflicting item description (inline, per-row)
  const [inlineConflicts, setInlineConflicts] = useState<Map<string, string>>(new Map());

  const allItemsFlat = useMemo(() => {
    const seen = new Set<string>();
    const out: BundleItem[] = [];
    for (const b of bundles) {
      for (const item of b.items) {
        if (!seen.has(item.description)) { seen.add(item.description); out.push(item); }
      }
    }
    return out;
  }, [bundles]);

  const selectedTotal = allItemsFlat
    .filter((i) => selected.has(i.description))
    .reduce((s, i) => s + i.total, 0);

  function toggle(item: BundleItem) {
    const desc = item.description;
    if (selected.has(desc)) {
      setSelected((prev) => { const n = new Set(prev); n.delete(desc); return n; });
      setInlineConflicts((prev) => { const n = new Map(prev); n.delete(desc); return n; });
      return;
    }
    const sKey = getSingletonKey(desc);
    if (sKey) {
      const conflicting = allItemsFlat.find(
        (other) => other.description !== desc && selected.has(other.description) && getSingletonKey(other.description) === sKey
      );
      if (conflicting) {
        // Show inline conflict on this row — don't add yet
        setInlineConflicts((prev) => new Map(prev).set(desc, conflicting.description));
        return;
      }
    }
    setSelected((prev) => { const n = new Set(prev); n.add(desc); return n; });
  }

  function resolveInlineConflict(newDesc: string, existingDesc: string, replace: boolean) {
    setSelected((prev) => {
      const n = new Set(prev);
      if (replace) n.delete(existingDesc);
      n.add(newDesc);
      return n;
    });
    setInlineConflicts((prev) => { const n = new Map(prev); n.delete(newDesc); return n; });
  }

  function dismissConflict(desc: string) {
    setInlineConflicts((prev) => { const n = new Map(prev); n.delete(desc); return n; });
  }

  function selectAll(bundle: Bundle) {
    setSelected((prev) => { const n = new Set(prev); bundle.items.forEach((i) => n.add(i.description)); return n; });
  }

  return (
    <div className="border-t border-gray-100 pt-5 mt-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900">Pick Items for {room}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg p-1">✕</button>
      </div>
      <p className="text-sm text-gray-400 mb-4">Tap a package to expand it. Check the items you want.</p>

      <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
        {bundles.map((bundle) => {
          const isOpen = openCode === bundle.bundle_code;
          const selectedCount = bundle.items.filter((i) => selected.has(i.description)).length;
          return (
            <div key={bundle.bundle_code} className={`rounded-xl border-2 overflow-hidden transition-colors ${isOpen ? "border-[#2563EB]" : "border-gray-200"}`}>
              <button
                onClick={() => setOpenCode(isOpen ? null : bundle.bundle_code)}
                className="flex w-full items-center gap-2 px-4 py-3 text-left bg-white hover:bg-gray-50"
              >
                <span className="text-gray-400 text-sm">{isOpen ? "▼" : "▶"}</span>
                <span className="flex-1 text-base font-bold text-gray-900">{bundle.name}</span>
                {bundle.sweet_spot && <span className="text-sm">⭐</span>}
                {selectedCount > 0 && (
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">{selectedCount} selected</span>
                )}
                <span className="shrink-0 tabular-nums text-base font-bold text-gray-500">{compact(bundle.total_value)}</span>
              </button>

              {isOpen && (
                <div className="border-t border-gray-100 bg-gray-50 px-4 pb-3 pt-2">
                  <button onClick={() => selectAll(bundle)} className="mb-2 text-sm font-semibold text-[#2563EB] hover:underline">
                    Select All in Bundle
                  </button>
                  <div className="space-y-1">
                    {bundle.items.map((item, i) => {
                      const p = itemPlaus(item.unit_cost);
                      const isSel = selected.has(item.description);
                      const hasConflict = inlineConflicts.has(item.description);
                      const conflictingDesc = inlineConflicts.get(item.description);
                      const sKey = getSingletonKey(item.description);
                      const silentConflict = !isSel && !hasConflict && sKey !== null && allItemsFlat.some(
                        (other) => other.description !== item.description && selected.has(other.description) && getSingletonKey(other.description) === sKey
                      );
                      return (
                        <div key={i}>
                          <label className={`flex items-center gap-3 rounded-lg border-2 p-3 cursor-pointer transition-colors ${isSel ? "border-[#2563EB] bg-blue-50" : hasConflict ? "border-amber-300 bg-amber-50" : "border-transparent bg-white hover:border-gray-200"}`}>
                            <input
                              type="checkbox"
                              checked={isSel}
                              onChange={() => toggle(item)}
                              className="h-5 w-5 accent-[#2563EB] shrink-0"
                            />
                            <span className="flex-1 text-base text-gray-900 leading-snug">
                              {item.brand ? `${item.brand} ` : ""}{item.description}
                            </span>
                            {silentConflict && !hasConflict && (
                              <span className="text-xs text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 shrink-0">Already have one</span>
                            )}
                            <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${p.dot}`} title={p.label} />
                            <span className="shrink-0 text-base font-bold tabular-nums text-gray-900">{formatCurrency(item.unit_cost)}</span>
                          </label>
                          {/* FIX 4: Inline singleton conflict — no modal */}
                          {hasConflict && conflictingDesc && (
                            <div className="mx-3 mb-1 rounded-b-lg border-x border-b border-amber-300 bg-amber-50 px-3 py-2.5">
                              <p className="text-sm font-semibold text-amber-800 mb-1">
                                You already have a <strong>{sKey?.replace(/_/g, " ")}</strong> selected — checking this will replace it
                              </p>
                              <p className="text-xs text-amber-700 mb-2 truncate">Replacing: {conflictingDesc}</p>
                              <div className="flex gap-2">
                                <button onClick={() => resolveInlineConflict(item.description, conflictingDesc, true)}
                                  className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-800">
                                  ✓ Replace
                                </button>
                                <button onClick={() => resolveInlineConflict(item.description, conflictingDesc, false)}
                                  className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100">
                                  Keep Both
                                </button>
                                <button onClick={() => dismissConflict(item.description)}
                                  className="px-2 text-xs text-gray-400 hover:text-gray-600">
                                  Cancel
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selected.size > 0 && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-gray-50 p-4 border border-gray-200">
          <div>
            <p className="text-sm text-gray-500">Selected: {selected.size} items</p>
            <p className="text-2xl font-bold tabular-nums text-gray-900">{formatCurrency(selectedTotal)}</p>
          </div>
          <button
            onClick={() => onAdd(allItemsFlat.filter((i) => selected.has(i.description)))}
            className="min-h-[48px] rounded-xl bg-[#16A34A] px-6 py-3 text-base font-bold text-white hover:bg-green-700 shrink-0"
          >
            Add These Items →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Items Tab ─────────────────────────────────────────────────────────────────

function ItemsTab({ items, onUpdate }: { items: ClaimItem[]; onUpdate: (item: ClaimItem, newPrice: number) => void }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [positions, setPositions] = useState<Record<number, number>>({});

  if (!items.length) return <p className="py-8 text-center text-base text-gray-400">No items recorded for this room.</p>;

  return (
    <div className="space-y-1.5">
      {items.map((item, idx) => {
        const mid = Math.round((item.unit_cost * 1.8) / 100) * 100;
        const high = Math.round((item.unit_cost * 3) / 100) * 100;
        const opts = [
          { label: "Original", price: item.unit_cost },
          { label: "Upgrade 1", price: mid },
          { label: "Upgrade 2", price: high },
        ];
        const pos = positions[idx] ?? 0;
        const isExpanded = expandedIdx === idx;
        return (
          <div key={idx} className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium text-gray-900 leading-snug truncate">{item.description}</p>
                {item.brand && <p className="text-sm text-gray-400 mt-0.5">{item.brand}</p>}
              </div>
              <p className="shrink-0 tabular-nums text-base font-bold text-gray-900">{formatCurrency(item.unit_cost * item.qty)}</p>
              <button
                onClick={() => { setExpandedIdx(isExpanded ? null : idx); setPositions((p) => ({ ...p, [idx]: 0 })); }}
                className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1 text-sm text-gray-400 hover:border-gray-300"
              >↕</button>
            </div>
            {isExpanded && (
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                <div className="flex items-center gap-3 justify-between">
                  <button onClick={() => setPositions((p) => ({ ...p, [idx]: Math.max(0, pos - 1) }))} disabled={pos === 0} className="text-2xl text-gray-300 disabled:opacity-20 hover:text-gray-600 px-2">◀</button>
                  <div className="flex-1 text-center">
                    <p className="text-sm font-medium text-gray-500 mb-1">{opts[pos].label}</p>
                    <p className="text-2xl font-bold tabular-nums text-gray-900">{formatCurrency(opts[pos].price)}</p>
                    {item.qty > 1 && <p className="text-sm text-gray-400 mt-0.5">× {item.qty} = {formatCurrency(opts[pos].price * item.qty)}</p>}
                  </div>
                  <button onClick={() => setPositions((p) => ({ ...p, [idx]: Math.min(opts.length - 1, pos + 1) }))} disabled={pos === opts.length - 1} className="text-2xl text-gray-300 disabled:opacity-20 hover:text-gray-600 px-2">▶</button>
                </div>
                {pos !== 0 && (
                  <button onClick={() => { onUpdate(item, opts[pos].price); setExpandedIdx(null); }} className="mt-4 w-full min-h-[48px] rounded-xl bg-[#2563EB] py-3 text-base font-bold text-white hover:bg-blue-700">Apply</button>
                )}
                <button onClick={() => setExpandedIdx(null)} className="mt-2 w-full py-2 text-sm text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Part 4 — Zone calculation ─────────────────────────────────────────────────

interface ZoneInfo {
  greenPct: number;
  yellowPct: number;
  zone: "green" | "yellow" | "red" | null;
  label: string;
  dot: string;
  textColor: string;
  bgColor: string;
}

function calcZone(bundles: Bundle[], allocation: number, maxVal: number): ZoneInfo {
  const sweetBundle = bundles.find((b) => b.sweet_spot);
  const sweetVal = sweetBundle?.total_value ?? maxVal * 0.4;
  const greenPct = Math.min(100, (sweetVal / maxVal) * 100);
  const yellowPct = Math.min(100, ((sweetVal * 2) / maxVal) * 100);

  let zone: "green" | "yellow" | "red" | null = null;
  let label = "";
  let dot = "";
  let textColor = "";
  let bgColor = "";

  if (allocation > 0) {
    if (allocation <= sweetVal) {
      zone = "green"; dot = "🟢"; label = "Easy to justify"; textColor = "text-green-700"; bgColor = "bg-green-50 border-green-200";
    } else if (allocation <= sweetVal * 2) {
      zone = "yellow"; dot = "🟡"; label = "Will need some explanation"; textColor = "text-amber-700"; bgColor = "bg-amber-50 border-amber-200";
    } else {
      zone = "red"; dot = "🔴"; label = "Will need strong documentation"; textColor = "text-red-700"; bgColor = "bg-red-50 border-red-200";
    }
  }

  return { greenPct, yellowPct, zone, label, dot, textColor, bgColor };
}

// ── Parts 1 + 4 — Bundles Tab ─────────────────────────────────────────────────

function BundlesTab({
  room,
  bundles,
  allocation,
  onAllocationChange,
  acceptedCodes,
  saving,
  onAccept,
  isPoolFull,
  onCheckedItemsAdd,
}: {
  room: { name: string; slug: string; display?: string };
  bundles: Bundle[];
  allocation: number;
  onAllocationChange: (v: number) => void;
  acceptedCodes: Set<string>;
  saving: boolean;
  onAccept: (bundle: Bundle) => void;
  isPoolFull: boolean;
  onCheckedItemsAdd: (items: BundleItem[]) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const [plausOpen, setPlausOpen] = useState(false);

  // FIX 3: locked item state — maps conceptKey → BlendedItem version that was checked
  const [lockedVersions, setLockedVersions] = useState<Map<string, BlendedItem>>(new Map());
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(new Set());
  // FIX 4: per-concept inline conflict state — maps conceptKey → conflicting item description
  const [inlineConflicts, setInlineConflicts] = useState<Map<string, string>>(new Map());

  const maxVal = Math.min(MAX_ROOM_ALLOC, bundles.length ? bundles[bundles.length - 1].total_value + 20_000 : MAX_ROOM_ALLOC);
  const closest = getClosestBundle(bundles, allocation);
  const isAccepted = closest ? acceptedCodes.has(closest.bundle_code) : false;

  // FIX 3: slider-driven blended items with fallback
  const sliderItems = useMemo(() => {
    const result = computeBlendedItems(bundles, allocation);
    // Fallback: if blendedItems empty (concept-key match failure), show closest bundle directly
    if (result.length === 0 && allocation > 0 && bundles.length > 0) {
      const fallback = getClosestBundle(bundles, allocation);
      if (fallback) {
        console.log("Blended items empty — using fallback bundle:", fallback.name, "items:", fallback.items.length);
        return fallback.items.map((item) => ({
          conceptKey: getConceptKey(item.description),
          item,
          bundleValue: fallback.total_value,
          category: item.category,
        }));
      }
    }
    console.log("Blended items for allocation", allocation, ":", result.length);
    return result;
  }, [bundles, allocation]);

  // Merge locked versions — checked items stay at their locked version regardless of slider
  const blendedItems = useMemo(() => {
    return sliderItems.map((bi) => {
      const locked = lockedVersions.get(bi.conceptKey);
      return (locked && checkedKeys.has(bi.conceptKey)) ? locked : bi;
    });
  }, [sliderItems, lockedVersions, checkedKeys]);

  // Part 4: zone info
  const zone = calcZone(bundles, allocation, maxVal);

  // Group blended items by category for display
  const groupedItems = useMemo(() => {
    const groups = new Map<string, BlendedItem[]>();
    for (const bi of blendedItems) {
      const cat = bi.category || "Other";
      if (!groups.has(cat)) groups.set(cat, []);
      groups.get(cat)!.push(bi);
    }
    return Array.from(groups.entries());
  }, [blendedItems]);

  // FIX 3: running total of checked items
  const checkedItems = blendedItems.filter((bi) => checkedKeys.has(bi.conceptKey));
  const checkedTotal = checkedItems.reduce((s, bi) => s + bi.item.total, 0);

  // FIX 3 + FIX 4: checkbox toggle with inline singleton conflict
  function toggleCheck(bi: BlendedItem) {
    const key = bi.conceptKey;
    if (checkedKeys.has(key)) {
      // Uncheck
      setCheckedKeys((prev) => { const n = new Set(prev); n.delete(key); return n; });
      setLockedVersions((prev) => { const n = new Map(prev); n.delete(key); return n; });
      setInlineConflicts((prev) => { const n = new Map(prev); n.delete(key); return n; });
      return;
    }
    // FIX 4: singleton check
    const sKey = getSingletonKey(bi.item.description);
    if (sKey) {
      const conflicting = blendedItems.find(
        (other) => other.conceptKey !== key && checkedKeys.has(other.conceptKey) && getSingletonKey(other.item.description) === sKey
      );
      if (conflicting) {
        setInlineConflicts((prev) => new Map(prev).set(key, conflicting.item.description));
        return;
      }
    }
    setCheckedKeys((prev) => new Set([...prev, key]));
    setLockedVersions((prev) => new Map(prev).set(key, bi));
  }

  function resolveCheckConflict(biKey: string, conflictingDesc: string, replace: boolean) {
    if (replace) {
      // Find and uncheck the conflicting item
      const conflictingBi = blendedItems.find((b) => b.item.description === conflictingDesc);
      if (conflictingBi) {
        setCheckedKeys((prev) => { const n = new Set(prev); n.delete(conflictingBi.conceptKey); return n; });
        setLockedVersions((prev) => { const n = new Map(prev); n.delete(conflictingBi.conceptKey); return n; });
      }
    }
    // Find the item being checked and lock it
    const bi = blendedItems.find((b) => b.conceptKey === biKey);
    if (bi) {
      setCheckedKeys((prev) => new Set([...prev, biKey]));
      setLockedVersions((prev) => new Map(prev).set(biKey, bi));
    }
    setInlineConflicts((prev) => { const n = new Map(prev); n.delete(biKey); return n; });
  }

  const plausMsg = !closest ? null
    : closest.plausibility === "green" ? null
    : closest.plausibility === "yellow"
    ? "Some items are higher-end replacements. A brief note about your household's lifestyle makes these straightforward to approve."
    : "This package contains premium items that will need supporting documentation.";

  if (!bundles.length) {
    return <p className="py-8 text-center text-base text-gray-400">No packages available yet.</p>;
  }

  // Part 4: gradient track style
  const trackStyle: React.CSSProperties = {
    background: `linear-gradient(to right, #16A34A 0%, #16A34A ${zone.greenPct}%, #D97706 ${zone.greenPct}%, #D97706 ${zone.yellowPct}%, #DC2626 ${zone.yellowPct}%, #DC2626 100%)`,
  };

  return (
    <div>
      {/* Part 4 — Zone gradient slider */}
      <div className="mb-6">
        <p className="text-base font-semibold text-gray-600 mb-3">How much would you like to add?</p>
        <div className="relative my-1">
          {/* Colored track */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-full rounded-full pointer-events-none"
            style={{ height: "8px", ...trackStyle }}
          />
          <input
            type="range"
            min={0} max={maxVal} step={5000}
            value={allocation}
            onChange={(e) => { onAllocationChange(Number(e.target.value)); setPlausOpen(false); }}
            className="zone-slider w-full"
            disabled={isPoolFull && allocation === 0}
          />
        </div>

        {/* Value + bounds */}
        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm text-gray-400">$0</span>
          <p className="text-2xl font-bold tabular-nums text-gray-900">
            {allocation > 0 ? formatCurrency(allocation) : "Slide to allocate →"}
          </p>
          <span className="text-sm text-gray-400">{compact(maxVal)}</span>
        </div>

        {/* Bundle name ticks */}
        <div className="mt-1.5 flex justify-between px-0.5">
          {bundles.map((b, i) => (
            <button
              key={i}
              onClick={() => onAllocationChange(b.total_value)}
              className={`text-xs tabular-nums transition-colors ${closest?.bundle_code === b.bundle_code && allocation > 0 ? "font-bold text-[#2563EB]" : "text-gray-300 hover:text-gray-500"}`}
              title={b.name}
            >
              {compact(b.total_value)}
            </button>
          ))}
        </div>

        {/* Part 4: Zone label */}
        {zone.zone && (
          <div className={`mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${zone.bgColor} ${zone.textColor}`}>
            <span>{zone.dot}</span>
            <span>{zone.label}</span>
          </div>
        )}

        {isPoolFull && allocation === 0 && (
          <p className="mt-2 text-sm text-amber-600 font-medium">
            Budget fully placed — adjust another room to free up funds
          </p>
        )}
      </div>

      {/* Part 1 + 4: Blended bundle card */}
      {allocation > 0 && blendedItems.length > 0 && (
        <div className={`rounded-2xl border-2 p-6 mb-4 transition-colors ${isAccepted ? "border-green-400 bg-green-50" : "border-gray-200 bg-white"}`}>
          {/* Header: closest named bundle */}
          {closest && (
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                {closest.sweet_spot && <span className="mb-1 block text-sm font-semibold text-amber-600">⭐ Best match</span>}
                <p className="text-sm text-gray-400 mb-0.5">Package at this level:</p>
                <h3 className="text-2xl font-bold text-gray-900">{closest.name}</h3>
                {closest.description && <p className="mt-1 text-base text-gray-500">{closest.description}</p>}
              </div>
              <div className="shrink-0 text-right">
                <p className="text-2xl font-bold tabular-nums text-gray-900">{formatCurrency(closest.total_value)}</p>
                {isAccepted && <span className="mt-1 block rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-700">✓ Added</span>}
              </div>
            </div>
          )}

          {/* FIX 3: Category-grouped blended items with checkboxes + lock state */}
          <div className="mb-4 space-y-4">
            {groupedItems.map(([cat, catItems]) => (
              <div key={cat}>
                <p className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">{cat}</p>
                <ul className="space-y-1.5">
                  {catItems.map((bi) => {
                    const isChecked = checkedKeys.has(bi.conceptKey);
                    const hasConflict = inlineConflicts.has(bi.conceptKey);
                    const conflictingDesc = inlineConflicts.get(bi.conceptKey);
                    const p = itemPlaus(bi.item.unit_cost);
                    const sKey = getSingletonKey(bi.item.description);
                    return (
                      <li key={`${bi.conceptKey}::${bi.bundleValue}`}>
                        <label className={`item-fade-in flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 cursor-pointer transition-colors ${
                          isChecked ? "border-[#2563EB] bg-blue-50" : hasConflict ? "border-amber-300 bg-amber-50" : "border-transparent bg-white hover:border-gray-200"
                        }`}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCheck(bi)}
                            className="h-5 w-5 accent-[#2563EB] shrink-0"
                          />
                          <span className="flex-1 text-base text-gray-800 leading-snug">
                            {bi.item.brand ? <span className="font-medium">{bi.item.brand} </span> : null}
                            {bi.item.description}
                          </span>
                          {isChecked && <span className="text-sm shrink-0" title="Locked in — stays fixed while slider moves">🔒</span>}
                          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${p.dot}`} title={p.label} />
                          <span className="shrink-0 tabular-nums font-semibold text-gray-900">{formatCurrency(bi.item.total)}</span>
                        </label>
                        {/* FIX 4: Inline singleton conflict — on the row */}
                        {hasConflict && conflictingDesc && (
                          <div className="mx-1 mb-1 rounded-b-lg border-x border-b border-amber-300 bg-amber-50 px-3 py-2.5">
                            <p className="text-sm font-semibold text-amber-800 mb-1">
                              You already have a <strong>{sKey?.replace(/_/g, " ")}</strong> selected — checking this will replace it
                            </p>
                            <p className="text-xs text-amber-700 mb-2 truncate">Replacing: {conflictingDesc}</p>
                            <div className="flex gap-2">
                              <button onClick={() => resolveCheckConflict(bi.conceptKey, conflictingDesc, true)}
                                className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-800">
                                ✓ Replace
                              </button>
                              <button onClick={() => resolveCheckConflict(bi.conceptKey, conflictingDesc, false)}
                                className="rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100">
                                Keep Both
                              </button>
                              <button onClick={() => setInlineConflicts((prev) => { const n = new Map(prev); n.delete(bi.conceptKey); return n; })}
                                className="px-2 text-xs text-gray-400 hover:text-gray-600">
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>

          {/* FIX 3: Running total for checked items */}
          {checkedKeys.size > 0 && (
            <div className="mb-5 flex items-center justify-between gap-4 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3">
              <div>
                <p className="text-sm text-blue-700">Selected: {checkedKeys.size} item{checkedKeys.size !== 1 ? "s" : ""}</p>
                <p className="text-xl font-bold tabular-nums text-blue-900">{formatCurrency(checkedTotal)}</p>
              </div>
              <button
                onClick={() => {
                  onCheckedItemsAdd(checkedItems.map((bi) => bi.item));
                  setCheckedKeys(new Set());
                  setLockedVersions(new Map());
                  setInlineConflicts(new Map());
                }}
                className="min-h-[44px] rounded-xl bg-[#2563EB] px-5 py-2 text-sm font-bold text-white hover:bg-blue-700 shrink-0"
              >
                Add Checked Items →
              </button>
            </div>
          )}

          {/* Plausibility disclosure */}
          {plausMsg && (
            <div className="mb-5">
              <button onClick={() => setPlausOpen((v) => !v)} className="flex items-center gap-2 text-base text-gray-500 hover:text-gray-700">
                <span className="text-sm">{plausOpen ? "▼" : "▶"}</span>
                Why this might need explanation
              </button>
              {plausOpen && (
                <div className={`mt-2 rounded-xl border p-4 text-base ${closest?.plausibility === "yellow" ? "bg-amber-50 border-amber-200 text-amber-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                  {plausMsg}
                </div>
              )}
            </div>
          )}

          {isAccepted ? (
            <p className="text-center text-base font-semibold text-green-700 py-2">✓ This package has been added to your claim</p>
          ) : closest ? (
            <button
              onClick={() => onAccept(closest)}
              disabled={saving}
              className="flex w-full min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-[#16A34A] text-base font-bold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <SmallSpinner /> : "✓ Add This Bundle"}
            </button>
          ) : null}
        </div>
      )}

      {/* Picker links */}
      <div className="flex flex-wrap items-center gap-4 text-base">
        <button onClick={() => setShowPicker((v) => !v)} className="text-[#2563EB] hover:underline">
          {showPicker ? "Hide item picker" : "Or pick individual items from any bundle →"}
        </button>
        <Link href={`/review/bundles/${room.slug}`} className="text-gray-400 hover:text-gray-600">
          See all {bundles.length} packages
        </Link>
      </div>

      {showPicker && (
        <ItemPicker
          room={room.display ?? room.name}
          bundles={bundles}
          onAdd={(items) => {
            onAccept({
              bundle_code: `PICK-${room.name}`,
              room: room.name,
              name: "Custom Selection",
              description: "",
              tier: "custom",
              total_value: items.reduce((s, i) => s + i.total, 0),
              sweet_spot: false,
              plausibility: "green",
              items,
            } as Bundle);
            setShowPicker(false);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  );
}

// ── Room Row ──────────────────────────────────────────────────────────────────

function RoomRow({
  room,
  roomTotal,
  allocation,
  sessionItems,
  acceptedCodes,
  saving,
  isPoolFull,
  addedThisSession,
  onAccept,
  onItemUpdate,
  onAllocationChange,
  onCheckedItemsAdd,
}: {
  room: { name: string; slug: string; display?: string };
  roomTotal: number;
  allocation: number;
  sessionItems: ClaimItem[];
  acceptedCodes: Set<string>;
  saving: boolean;
  isPoolFull: boolean;
  addedThisSession: number;
  onAccept: (bundle: Bundle) => void;
  onItemUpdate: (item: ClaimItem, newPrice: number) => void;
  onAllocationChange: (roomName: string, v: number) => void;
  onCheckedItemsAdd: (roomName: string, items: BundleItem[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"bundles" | "items">("bundles");

  const bundles = useMemo(
    () => BUNDLES_DATA.filter((b) => b.room === room.name).sort((a, b) => a.total_value - b.total_value),
    [room.name]
  );
  const roomItems = useMemo(() => sessionItems.filter((i) => i.room === room.name), [sessionItems, room.name]);
  const displayName = room.display ?? room.name;
  const closest = getClosestBundle(bundles, allocation);

  return (
    <div className={`rounded-2xl border-2 transition-all ${open ? "border-gray-300 shadow-md" : "border-gray-200"}`}>
      <div className="flex items-center gap-3 px-5 py-4 min-h-[80px]">
        <button onClick={() => setOpen((v) => !v)} className="flex-1 text-left min-w-0">
          <p className="text-xl font-bold text-gray-900 leading-tight">{displayName}</p>
          <p className="text-sm text-gray-400 mt-0.5">
            {formatCurrency(roomTotal)} existing · {roomItems.length} items
          </p>
        </button>

        {/* Mini allocation bar */}
        <div className="hidden sm:block w-40 shrink-0">
          {allocation > 0 ? (
            <div>
              <p className="text-xs text-gray-400 tabular-nums mb-1">
                {closest ? closest.name : ""} · {formatCurrency(allocation)}
              </p>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-[#2563EB]" style={{ width: `${Math.min(100, (allocation / MAX_ROOM_ALLOC) * 100)}%` }} />
              </div>
            </div>
          ) : (
            <p className="text-xs text-gray-400">No allocation yet</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {addedThisSession > 0 && (
            <span className="text-sm font-semibold text-green-600 tabular-nums">✓ +{formatCurrency(addedThisSession)}</span>
          )}
          <Link
            href={`/review/bundles/${room.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded-xl border-2 border-[#2563EB] px-3 py-1.5 text-sm font-bold text-[#2563EB] hover:bg-blue-50"
          >
            + Add
          </Link>
          <button onClick={() => setOpen((v) => !v)} className={`text-gray-300 transition-transform duration-200 text-sm ${open ? "rotate-90" : ""}`}>▶</button>
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 px-5 py-5">
          <div className="flex gap-1 mb-6 rounded-xl bg-gray-100 p-1">
            {(["bundles", "items"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg py-2.5 text-base font-bold transition-colors ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-400 hover:text-gray-600"}`}
              >
                {t === "bundles" ? "Packages" : "Existing Items"}
              </button>
            ))}
          </div>

          {tab === "bundles" ? (
            <BundlesTab
              room={room}
              bundles={bundles}
              allocation={allocation}
              onAllocationChange={(v) => onAllocationChange(room.name, v)}
              acceptedCodes={acceptedCodes}
              saving={saving}
              onAccept={onAccept}
              isPoolFull={isPoolFull}
              onCheckedItemsAdd={(items) => onCheckedItemsAdd(room.name, items)}
            />
          ) : (
            <ItemsTab items={roomItems} onUpdate={onItemUpdate} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Art Row ───────────────────────────────────────────────────────────────────

function ArtRow({ artAdded, onAdd }: { artAdded: boolean; onAdd: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`rounded-2xl border-2 transition-all ${open ? "border-gray-300 shadow-md" : "border-gray-200"}`}>
      <button onClick={() => setOpen((v) => !v)} className="flex w-full min-h-[80px] items-center gap-3 px-5 py-4 text-left">
        <div className="flex-1">
          <p className="text-xl font-bold text-gray-900">🎨 Art Collection</p>
          <p className="text-sm text-gray-400 mt-0.5">{artAdded ? "✓ $300,000 placeholder added" : "Pending advisor PDF"}</p>
        </div>
        <span className="text-2xl font-bold tabular-nums text-gray-400">{artAdded ? formatCurrency(300_000) : "$0"}</span>
        <span className={`text-sm text-gray-300 transition-transform duration-200 ${open ? "rotate-90" : ""}`}>▶</span>
      </button>
      {open && (
        <div className="border-t border-gray-100 px-5 py-6">
          <p className="text-base text-gray-600 mb-1">Your art collection is being inventoried by the advisor.</p>
          <p className="text-base text-gray-600 mb-6">You can add a $300,000 placeholder now and update it when the full inventory is ready.</p>
          {artAdded ? (
            <p className="text-base font-bold text-green-700">✓ $300,000 placeholder has been added</p>
          ) : (
            <button onClick={onAdd} className="min-h-[56px] w-full rounded-2xl bg-[#16A34A] text-base font-bold text-white hover:bg-green-700">
              ✓ Add $300,000 Placeholder
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export default function ReviewDashboard() {
  const router = useRouter();
  const { mode, setMode, sessionId } = useClaimMode();

  const [isLoading, setIsLoading] = useState(true);
  const [sessionItems, setSessionItems] = useState<ClaimItem[]>([]);
  const [roomAllocations, setRoomAllocations] = useState<Record<string, number>>({});
  const [acceptedCodes, setAcceptedCodes] = useState<Set<string>>(new Set());
  const [addedByRoom, setAddedByRoom] = useState<Record<string, number>>({});
  const [savingRoom, setSavingRoom] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [artAdded, setArtAdded] = useState(false);

  useEffect(() => { loadData(); }, [sessionId]);

  // FIX 1: debug log whenever items change
  useEffect(() => {
    if (sessionItems.length > 0) {
      const total = sessionItems.reduce((s, i) => s + i.unit_cost * i.qty, 0);
      console.log("Total from items:", total);
      console.log("Item count:", sessionItems.length);
    }
  }, [sessionItems]);

  async function loadData() {
    const session = await loadSession(sessionId);
    if (!session?.claim_items?.length) { router.replace("/"); return; }

    setSessionItems(session.claim_items);
    setRoomAllocations(session.room_budgets ?? {});

    const local = getLocalDecisions();
    const accepted = new Set<string>(
      Object.entries(local).filter(([, v]) => v === "accepted" || v === "regenerated").map(([k]) => k)
    );
    try {
      const { data } = await supabase.from("bundle_decisions").select("bundle_code, action");
      for (const d of (data ?? []) as { bundle_code: string; action: string }[]) {
        if (d.action === "accepted" || d.action === "regenerated") { accepted.add(d.bundle_code); local[d.bundle_code] = d.action; }
      }
      localStorage.setItem(LS_DECISIONS, JSON.stringify(local));
    } catch { /* localStorage fallback */ }

    setAcceptedCodes(accepted);
    setIsLoading(false);
  }

  // ── Derived ──────────────────────────────────────────────────────────────

  const roomTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const item of sessionItems) t[item.room] = (t[item.room] ?? 0) + item.unit_cost * item.qty;
    return t;
  }, [sessionItems]);

  const baseTotal = useMemo(
    () => Object.values(roomTotals).reduce((s, v) => s + v, 0) + (artAdded ? 300_000 : 0),
    [roomTotals, artAdded]
  );

  // FIX 1: grandTotal is ONLY from claim_items — never add bundle allocations on top
  // (bundle items are already IN claim_items when accepted, so distributed would double-count)
  const grandTotal = baseTotal;

  const toDistribute = Math.max(0, TARGET - grandTotal);
  const distributed = Object.values(roomAllocations).reduce((s, v) => s + v, 0);
  const stillToPlace = Math.max(0, toDistribute - distributed);
  const isPoolFull = stillToPlace <= 0 && distributed > 0;
  const poolPct = toDistribute > 0 ? Math.min(100, (distributed / toDistribute) * 100) : 0;

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleAccept(roomName: string, bundle: Bundle) {
    setSavingRoom(roomName);
    try {
      setLocalDecision(bundle.bundle_code, "accepted");
      try {
        await supabase.from("bundle_decisions").upsert(
          { bundle_code: bundle.bundle_code, room: bundle.room, bundle_name: bundle.name, action: "accepted", items: bundle.items, total_value: bundle.total_value },
          { onConflict: "bundle_code" }
        );
      } catch { /* localStorage fallback */ }

      const existingKeys = new Set(sessionItems.map((i) => `${i.room}::${i.description}`));
      const newItems: ClaimItem[] = bundle.items
        .filter((bi) => !existingKeys.has(`${bundle.room}::${bi.description}`))
        .map((bi) => ({ room: bundle.room, description: bi.description, brand: bi.brand, model: "", qty: bi.qty, age_years: 0, age_months: 0, condition: "New", unit_cost: bi.unit_cost, category: bi.category }));

      if (newItems.length > 0) {
        const updated = [...sessionItems, ...newItems];
        await saveSession({ claim_items: updated }, sessionId);
        setSessionItems(updated);
      }

      const newAllocs = { ...roomAllocations, [roomName]: bundle.total_value };
      setRoomAllocations(newAllocs);
      await saveSession({ room_budgets: newAllocs }, sessionId);

      setAcceptedCodes((prev) => new Set([...prev, bundle.bundle_code]));
      setAddedByRoom((prev) => ({ ...prev, [roomName]: (prev[roomName] ?? 0) + bundle.total_value }));
      setToast(`${bundle.name} added — ${formatCurrency(bundle.total_value)}`);
    } finally {
      setSavingRoom(null);
    }
  }

  async function handleItemUpdate(item: ClaimItem, newPrice: number) {
    const updated = sessionItems.map((ci) =>
      ci.room === item.room && ci.description === item.description && ci.unit_cost === item.unit_cost
        ? { ...ci, unit_cost: newPrice }
        : ci
    );
    await saveSession({ claim_items: updated }, sessionId);
    setSessionItems(updated);
    setToast("Value updated");
  }

  function handleAllocationChange(roomName: string, value: number) {
    setRoomAllocations((prev) => ({ ...prev, [roomName]: value }));
  }

  async function handleCheckedItemsAdd(roomName: string, items: BundleItem[]) {
    const existingKeys = new Set(sessionItems.map((i) => `${i.room}::${i.description}`));
    const newItems: ClaimItem[] = items
      .filter((bi) => !existingKeys.has(`${roomName}::${bi.description}`))
      .map((bi) => ({
        room: roomName, description: bi.description, brand: bi.brand,
        model: "", qty: bi.qty, age_years: 0, age_months: 0,
        condition: "New", unit_cost: bi.unit_cost, category: bi.category,
      }));
    if (!newItems.length) { setToast("All selected items already in claim"); return; }
    const updated = [...sessionItems, ...newItems];
    await saveSession({ claim_items: updated }, sessionId);
    setSessionItems(updated);
    setToast(`${newItems.length} item${newItems.length !== 1 ? "s" : ""} added — ${formatCurrency(newItems.reduce((s, i) => s + i.unit_cost * i.qty, 0))}`);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[720px] px-4 pb-36 pt-8">
        {/* FIX 7: Test mode banner */}
        {mode === "test" && (
          <div className="mb-4 rounded-xl bg-orange-100 border border-orange-300 px-4 py-3 flex items-center justify-between gap-4">
            <p className="text-sm font-bold text-orange-700">🧪 TEST MODE — safe to experiment. Changes go to test session only.</p>
            <button onClick={() => setMode("live")} className="text-xs font-bold text-orange-700 border border-orange-400 rounded px-2 py-1 hover:bg-orange-200">
              Switch to Live
            </button>
          </div>
        )}

        <header className="mb-8">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold uppercase tracking-widest text-gray-400">ClaimBuilder</p>
            {/* FIX 7: Mode toggle */}
            <div className="flex items-center gap-1 rounded-full bg-gray-100 p-1">
              {(["live", "test"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`rounded-full px-3 py-1 text-xs font-bold transition-colors capitalize ${mode === m ? (m === "test" ? "bg-orange-500 text-white" : "bg-[#2563EB] text-white") : "text-gray-400 hover:text-gray-600"}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Israel Claim · #7579B726D</h1>

          {/* Budget Pool */}
          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-5">
            <h2 className="text-base font-bold uppercase tracking-wider text-gray-400 mb-4">Budget Pool</h2>
            <div className="grid grid-cols-2 gap-y-4 gap-x-6 mb-5">
              <div>
                <p className="text-sm text-gray-500">Total goal</p>
                <p className="text-2xl font-bold tabular-nums text-gray-900">{formatCurrency(TARGET)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Already have</p>
                <p className="text-2xl font-bold tabular-nums text-gray-900">{formatCurrency(baseTotal)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">To distribute</p>
                <p className="text-2xl font-bold tabular-nums text-[#2563EB]">{formatCurrency(toDistribute)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Distributed</p>
                <p className="text-2xl font-bold tabular-nums text-gray-900">{formatCurrency(distributed)}</p>
              </div>
            </div>
            <div className="flex items-baseline justify-between mb-2">
              <span className="text-base font-semibold text-gray-600">Still to place:</span>
              <span className="text-2xl font-bold tabular-nums text-gray-900">{formatCurrency(stillToPlace)}</span>
            </div>
            <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full rounded-full transition-all duration-500 ${isPoolFull ? "bg-green-500" : "bg-[#2563EB]"}`}
                style={{ width: `${poolPct}%` }}
              />
            </div>
            <p className="mt-1.5 text-right text-sm text-gray-400">{poolPct.toFixed(0)}% distributed</p>
          </div>
        </header>

        {isLoading ? (
          <div className="space-y-3">
            {[...Array(9)].map((_, i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {ROOMS.map((room) => (
              <RoomRow
                key={room.name}
                room={room}
                roomTotal={roomTotals[room.name] ?? 0}
                allocation={roomAllocations[room.name] ?? 0}
                sessionItems={sessionItems}
                acceptedCodes={acceptedCodes}
                saving={savingRoom === room.name}
                isPoolFull={isPoolFull}
                addedThisSession={addedByRoom[room.name] ?? 0}
                onAccept={(bundle) => handleAccept(room.name, bundle)}
                onItemUpdate={handleItemUpdate}
                onAllocationChange={handleAllocationChange}
                onCheckedItemsAdd={handleCheckedItemsAdd}
              />
            ))}
            <ArtRow artAdded={artAdded} onAdd={() => { setArtAdded(true); setToast("Art collection placeholder added — $300,000"); }} />
          </div>
        )}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-gray-200 bg-white">
        <div className="mx-auto max-w-[720px] px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="text-base">
              <span className="text-gray-500">Total: </span>
              <span className="text-xl font-bold tabular-nums text-gray-900">{formatCurrency(grandTotal)}</span>
              <span className="text-gray-400 text-sm ml-1">/ {formatCurrency(TARGET)}</span>
            </div>
            <a
              href="/api/export-xact"
              className="min-h-[48px] flex items-center rounded-xl px-5 py-2.5 text-base font-bold bg-[#16A34A] text-white hover:bg-green-700 transition-colors"
            >
              Download Claim
            </a>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
