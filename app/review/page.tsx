"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BUNDLES_DATA, Bundle, BundleItem } from "../lib/bundles-data";
import { loadSession, saveSession } from "../lib/session";
import { ClaimItem } from "../lib/types";
import { supabase } from "../lib/supabase";
import { formatCurrency } from "../lib/utils";

// ── Constants ─────────────────────────────────────────────────────────────────

const TARGET = 1_600_000;
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
  const d = getLocalDecisions();
  d[code] = action;
  localStorage.setItem(LS_DECISIONS, JSON.stringify(d));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function compact(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v)}`;
}

function plausText(p: "green" | "yellow" | "red") {
  if (p === "green") return { label: "Easy", dot: "bg-green-500", text: "text-green-700", bg: "bg-green-50 border-green-200" };
  if (p === "yellow") return { label: "Medium", dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50 border-amber-200" };
  return { label: "Review", dot: "bg-red-500", text: "text-red-700", bg: "bg-red-50 border-red-200" };
}

function itemPlaus(unit_cost: number) {
  if (unit_cost > 15000) return plausText("red");
  if (unit_cost > 5000) return plausText("yellow");
  return plausText("green");
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);
  return (
    <div className="fixed bottom-24 left-1/2 z-50 -translate-x-1/2 rounded-2xl bg-gray-900 px-6 py-4 text-base text-white shadow-2xl">
      <span className="text-green-400 mr-2">✓</span>{message}
    </div>
  );
}

// ── Item Picker ("Build Your Own") ────────────────────────────────────────────

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
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allItems = useMemo(() => {
    const seen = new Set<string>();
    const out: BundleItem[] = [];
    for (const b of bundles) {
      for (const item of b.items) {
        if (!seen.has(item.description)) {
          seen.add(item.description);
          out.push(item);
        }
      }
    }
    return out.sort((a, b) => a.unit_cost - b.unit_cost);
  }, [bundles]);

  const selectedTotal = allItems
    .filter((i) => selected.has(i.description))
    .reduce((s, i) => s + i.total, 0);

  return (
    <div className="border-t border-gray-100 pt-5">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-xl font-bold text-gray-900">Pick Items for {room}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg p-1">✕</button>
      </div>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {allItems.map((item, i) => {
          const p = itemPlaus(item.unit_cost);
          const isSel = selected.has(item.description);
          return (
            <label
              key={i}
              className={`flex items-center gap-4 rounded-xl border-2 p-4 cursor-pointer transition-colors ${
                isSel ? "border-[#2563EB] bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"
              }`}
            >
              <input
                type="checkbox"
                checked={isSel}
                onChange={() =>
                  setSelected((prev) => {
                    const n = new Set(prev);
                    n.has(item.description) ? n.delete(item.description) : n.add(item.description);
                    return n;
                  })
                }
                className="h-5 w-5 accent-[#2563EB] shrink-0"
              />
              <span className="flex-1 text-base text-gray-900 leading-snug">{item.description}</span>
              <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${p.dot}`} title={p.label} />
              <span className="shrink-0 text-base font-bold tabular-nums text-gray-900">
                {formatCurrency(item.unit_cost)}
              </span>
            </label>
          );
        })}
      </div>

      {selected.size > 0 && (
        <div className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-gray-50 p-4">
          <p className="text-base text-gray-600">
            Selected: <span className="text-2xl font-bold text-gray-900">{formatCurrency(selectedTotal)}</span>
          </p>
          <button
            onClick={() => onAdd(allItems.filter((i) => selected.has(i.description)))}
            className="min-h-[48px] rounded-xl bg-[#16A34A] px-6 py-3 text-base font-bold text-white transition-colors hover:bg-green-700"
          >
            Add Selected Items →
          </button>
        </div>
      )}
    </div>
  );
}

// ── Existing Items Tab ────────────────────────────────────────────────────────

function ItemsTab({
  items,
  onUpdate,
}: {
  items: ClaimItem[];
  onUpdate: (item: ClaimItem, newUnitCost: number) => void;
}) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [positions, setPositions] = useState<Record<number, number>>({});

  if (items.length === 0) {
    return <p className="py-8 text-center text-base text-gray-400">No items recorded for this room.</p>;
  }

  return (
    <div className="space-y-1.5">
      {items.map((item, idx) => {
        const mid = Math.round((item.unit_cost * 1.8) / 100) * 100;
        const high = Math.round(item.unit_cost * 3 / 100) * 100;
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
                <p className="text-base font-medium text-gray-900 leading-snug truncate">
                  {item.description}
                </p>
                {item.brand && (
                  <p className="text-sm text-gray-400 mt-0.5">{item.brand}</p>
                )}
              </div>
              <p className="shrink-0 tabular-nums text-base font-bold text-gray-900">
                {formatCurrency(item.unit_cost * item.qty)}
              </p>
              <button
                onClick={() => {
                  setExpandedIdx(isExpanded ? null : idx);
                  setPositions((p) => ({ ...p, [idx]: 0 }));
                }}
                className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1 text-sm text-gray-400 hover:border-gray-300 hover:text-gray-600"
                title="Adjust value"
              >
                ↕
              </button>
            </div>

            {isExpanded && (
              <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
                <div className="flex items-center gap-3 justify-between">
                  <button
                    onClick={() => setPositions((p) => ({ ...p, [idx]: Math.max(0, pos - 1) }))}
                    disabled={pos === 0}
                    className="text-2xl text-gray-400 disabled:opacity-20 hover:text-gray-700 px-2"
                  >
                    ◀
                  </button>
                  <div className="flex-1 text-center">
                    <p className="text-sm font-medium text-gray-500 mb-1">{opts[pos].label}</p>
                    <p className="text-2xl font-bold tabular-nums text-gray-900">
                      {formatCurrency(opts[pos].price)}
                    </p>
                    {item.qty > 1 && (
                      <p className="text-sm text-gray-400 mt-0.5">
                        × {item.qty} = {formatCurrency(opts[pos].price * item.qty)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setPositions((p) => ({ ...p, [idx]: Math.min(opts.length - 1, pos + 1) }))}
                    disabled={pos === opts.length - 1}
                    className="text-2xl text-gray-400 disabled:opacity-20 hover:text-gray-700 px-2"
                  >
                    ▶
                  </button>
                </div>
                {pos !== 0 && (
                  <button
                    onClick={() => {
                      onUpdate(item, opts[pos].price);
                      setExpandedIdx(null);
                    }}
                    className="mt-4 w-full min-h-[48px] rounded-xl bg-[#2563EB] py-3 text-base font-bold text-white transition-colors hover:bg-blue-700"
                  >
                    Apply
                  </button>
                )}
                <button
                  onClick={() => setExpandedIdx(null)}
                  className="mt-2 w-full py-2 text-sm text-gray-400 hover:text-gray-600"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Bundles Tab ───────────────────────────────────────────────────────────────

function BundlesTab({
  room,
  bundles,
  acceptedCodes,
  saving,
  onAccept,
}: {
  room: { name: string; slug: string; display?: string };
  bundles: Bundle[];
  acceptedCodes: Set<string>;
  saving: boolean;
  onAccept: (bundle: Bundle) => void;
}) {
  const sweetIdx = bundles.findIndex((b) => b.sweet_spot);
  const [idx, setIdx] = useState(sweetIdx >= 0 ? sweetIdx : 0);
  const [showPicker, setShowPicker] = useState(false);
  const [plausOpen, setPlausOpen] = useState(false);
  const [pickerItems, setPickerItems] = useState<BundleItem[] | null>(null);
  const [pickerSaving, setPickerSaving] = useState(false);

  const bundle = bundles[idx];
  const isAccepted = bundle ? acceptedCodes.has(bundle.bundle_code) : false;

  const plaus = bundle ? plausText(bundle.plausibility) : null;
  const plausMsg = bundle?.plausibility === "green"
    ? null
    : bundle?.plausibility === "yellow"
    ? "Some items in this package are higher-end replacements. A brief note about your household's lifestyle makes these straightforward to approve."
    : "This package contains premium items that will need supporting documentation about your home and lifestyle.";

  if (bundles.length === 0) {
    return (
      <div className="py-12 text-center">
        <p className="text-base text-gray-400 mb-3">No packages available for this room yet.</p>
        <Link href={`/review/${room.slug}`} className="text-[#2563EB] hover:underline text-base">
          View existing items →
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Slider */}
      <div className="mb-6">
        <p className="text-base font-semibold text-gray-500 mb-3">
          How much would you like to add?
        </p>
        <input
          type="range"
          min={0}
          max={bundles.length - 1}
          step={1}
          value={idx}
          onChange={(e) => { setIdx(Number(e.target.value)); setPlausOpen(false); }}
          className="w-full cursor-pointer accent-[#2563EB]"
          style={{ height: "8px" }}
        />
        <div className="mt-2 flex justify-between px-0.5">
          {bundles.map((b, i) => (
            <button
              key={i}
              onClick={() => setIdx(i)}
              className={`text-sm tabular-nums transition-colors ${
                i === idx ? "font-bold text-[#2563EB]" : "text-gray-300 hover:text-gray-400"
              }`}
            >
              {compact(b.total_value)}
            </button>
          ))}
        </div>
        <p className="mt-3 text-2xl font-bold tabular-nums text-gray-900">
          {bundle ? formatCurrency(bundle.total_value) : "—"}
        </p>
      </div>

      {/* Bundle card */}
      {bundle && (
        <div className={`rounded-2xl border-2 p-6 transition-colors ${
          isAccepted ? "border-green-400 bg-green-50" : "border-gray-200 bg-white"
        }`}>
          {/* Header */}
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              {bundle.sweet_spot && (
                <span className="mb-1 block text-sm font-semibold text-amber-600">⭐ Best match</span>
              )}
              <h3 className="text-2xl font-bold text-gray-900">{bundle.name}</h3>
              {bundle.description && (
                <p className="mt-1 text-base text-gray-500">{bundle.description}</p>
              )}
            </div>
            {isAccepted && (
              <span className="shrink-0 rounded-full bg-green-100 px-3 py-1 text-sm font-bold text-green-700">
                ✓ Added
              </span>
            )}
          </div>

          {/* Items list */}
          <ul className="mb-5 space-y-2">
            {bundle.items.slice(0, 7).map((item, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-base">
                <span className="text-gray-700 leading-snug">
                  {item.brand ? `${item.brand} ` : ""}{item.description}
                </span>
                <span className="shrink-0 tabular-nums font-semibold text-gray-900">
                  {formatCurrency(item.total)}
                </span>
              </li>
            ))}
            {bundle.items.length > 7 && (
              <li className="text-sm text-gray-400">+ {bundle.items.length - 7} more items</li>
            )}
          </ul>

          {/* Plausibility disclosure */}
          {plausMsg && (
            <div className="mb-5">
              <button
                onClick={() => setPlausOpen((v) => !v)}
                className="flex items-center gap-2 text-base text-gray-500 hover:text-gray-700"
              >
                <span className="text-sm">{plausOpen ? "▼" : "▶"}</span>
                Why this might need explanation
              </button>
              {plausOpen && (
                <div className={`mt-2 rounded-xl border p-4 text-base ${plaus!.bg} ${plaus!.text}`}>
                  {plausMsg}
                </div>
              )}
            </div>
          )}

          {/* Accept button */}
          {isAccepted ? (
            <p className="text-center text-base font-semibold text-green-700 py-2">
              ✓ This package has been added to your claim
            </p>
          ) : (
            <button
              onClick={() => onAccept(bundle)}
              disabled={saving}
              className="flex w-full min-h-[56px] items-center justify-center gap-2 rounded-2xl bg-[#16A34A] text-base font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              {saving ? <Spinner /> : "✓ Add This Bundle"}
            </button>
          )}
        </div>
      )}

      {/* Item picker link / view all */}
      <div className="mt-5 flex flex-wrap items-center gap-4 text-base">
        <button
          onClick={() => setShowPicker((v) => !v)}
          className="text-[#2563EB] hover:underline"
        >
          {showPicker ? "Hide item picker" : "Or pick individual items from any bundle →"}
        </button>
        <Link href={`/review/bundles/${room.slug}`} className="text-gray-400 hover:text-gray-600">
          See all {bundles.length} packages
        </Link>
      </div>

      {/* Item picker */}
      {showPicker && (
        <ItemPicker
          room={room.display ?? room.name}
          bundles={bundles}
          onAdd={(items) => {
            setPickerItems(items);
            setPickerSaving(true);
          }}
          onClose={() => setShowPicker(false)}
        />
      )}

      {/* Picker saving indicator */}
      {pickerSaving && pickerItems && (
        <div className="mt-3 flex items-center gap-2 text-base text-green-600">
          <Spinner />
          <span>Saving {pickerItems.length} items…</span>
        </div>
      )}
    </div>
  );
}

// ── Room Row ──────────────────────────────────────────────────────────────────

function RoomRow({
  room,
  roomTotal,
  roomTarget,
  sessionItems,
  acceptedCodes,
  saving,
  onAccept,
  onItemUpdate,
  onTargetChange,
  addedThisSession,
}: {
  room: { name: string; slug: string; display?: string };
  roomTotal: number;
  roomTarget: number;
  sessionItems: ClaimItem[];
  acceptedCodes: Set<string>;
  saving: boolean;
  onAccept: (bundle: Bundle) => void;
  onItemUpdate: (item: ClaimItem, newUnitCost: number) => void;
  onTargetChange: (roomName: string, newTarget: number) => void;
  addedThisSession: number;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"bundles" | "items">("bundles");
  const [editTarget, setEditTarget] = useState(false);
  const [targetInput, setTargetInput] = useState(String(roomTarget || ""));

  const bundles = useMemo(
    () => BUNDLES_DATA.filter((b) => b.room === room.name),
    [room.name]
  );
  const roomItems = useMemo(
    () => sessionItems.filter((i) => i.room === room.name),
    [sessionItems, room.name]
  );

  const pct = roomTarget > 0 ? Math.min(100, (roomTotal / roomTarget) * 100) : 0;
  const displayName = room.display ?? room.name;

  return (
    <div className={`rounded-2xl border-2 transition-all ${
      open ? "border-gray-300 shadow-md" : "border-gray-200"
    }`}>
      {/* Row header */}
      <div className="flex items-center gap-3 px-5 py-4 min-h-[80px]">
        {/* Left: name + count */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-1 text-left min-w-0"
        >
          <p className="text-xl font-bold text-gray-900 leading-tight">{displayName}</p>
          <p className="text-sm text-gray-400 mt-0.5">{roomItems.length} items</p>
        </button>

        {/* Middle: mini progress */}
        <div className="hidden sm:block flex-1 max-w-[200px]">
          {roomTarget > 0 ? (
            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    pct >= 100 ? "bg-green-500" : "bg-[#2563EB]"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-1 flex items-center gap-1">
                {editTarget ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-gray-400">$</span>
                    <input
                      type="number"
                      value={targetInput}
                      onChange={(e) => setTargetInput(e.target.value)}
                      onBlur={() => {
                        const v = parseFloat(targetInput);
                        if (!isNaN(v) && v > 0) onTargetChange(room.name, v);
                        setEditTarget(false);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          const v = parseFloat(targetInput);
                          if (!isNaN(v) && v > 0) onTargetChange(room.name, v);
                          setEditTarget(false);
                        }
                      }}
                      autoFocus
                      className="w-24 rounded border border-gray-200 px-1 py-0.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 tabular-nums">
                    {formatCurrency(roomTotal)} of {formatCurrency(roomTarget)}
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditTarget(true); setTargetInput(String(roomTarget)); }}
                      className="ml-1 text-gray-300 hover:text-gray-500"
                      title="Edit target"
                    >
                      ✏️
                    </button>
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm tabular-nums text-gray-500 font-semibold">
              {formatCurrency(roomTotal)}
            </p>
          )}
        </div>

        {/* Right: add button + chevron */}
        <div className="flex items-center gap-2 shrink-0">
          {addedThisSession > 0 && (
            <span className="text-sm font-semibold text-green-600 tabular-nums">
              ✓ +{formatCurrency(addedThisSession)}
            </span>
          )}
          <Link
            href={`/review/bundles/${room.slug}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded-xl border-2 border-[#2563EB] px-3 py-1.5 text-sm font-bold text-[#2563EB] transition-colors hover:bg-blue-50"
          >
            + Add
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            className={`text-gray-300 transition-transform duration-200 text-sm ${open ? "rotate-90" : ""}`}
          >
            ▶
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {open && (
        <div className="border-t border-gray-100 px-5 py-5">
          {/* Tabs */}
          <div className="flex gap-1 mb-6 rounded-xl bg-gray-100 p-1">
            {(["bundles", "items"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-lg py-2.5 text-base font-bold transition-colors ${
                  tab === t
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-400 hover:text-gray-600"
                }`}
              >
                {t === "bundles" ? "Packages" : "Existing Items"}
              </button>
            ))}
          </div>

          {tab === "bundles" ? (
            <BundlesTab
              room={room}
              bundles={bundles}
              acceptedCodes={acceptedCodes}
              saving={saving}
              onAccept={onAccept}
            />
          ) : (
            <ItemsTab items={roomItems} onUpdate={onItemUpdate} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Art Collection Row ────────────────────────────────────────────────────────

function ArtRow({
  artAdded,
  onAdd,
}: {
  artAdded: boolean;
  onAdd: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className={`rounded-2xl border-2 transition-all ${open ? "border-gray-300 shadow-md" : "border-gray-200"}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-h-[80px] items-center gap-3 px-5 py-4 text-left"
      >
        <div className="flex-1">
          <p className="text-xl font-bold text-gray-900">🎨 Art Collection</p>
          <p className="text-sm text-gray-400 mt-0.5">
            {artAdded ? "✓ $300,000 placeholder added" : "Pending advisor PDF"}
          </p>
        </div>
        <span className="text-2xl font-bold tabular-nums text-gray-400">
          {artAdded ? formatCurrency(300_000) : "$0"}
        </span>
        <span className={`text-sm text-gray-300 transition-transform duration-200 ${open ? "rotate-90" : ""}`}>
          ▶
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100 px-5 py-6">
          <p className="text-base text-gray-600 mb-1">Your art collection is being inventoried by the advisor.</p>
          <p className="text-base text-gray-600 mb-6">You can add a $300,000 placeholder now and update it when the full inventory is ready.</p>
          {artAdded ? (
            <p className="text-base font-bold text-green-700">✓ $300,000 placeholder has been added</p>
          ) : (
            <button
              onClick={onAdd}
              className="min-h-[56px] w-full rounded-2xl bg-[#16A34A] text-base font-bold text-white transition-colors hover:bg-green-700"
            >
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

  const [isLoading, setIsLoading] = useState(true);
  const [sessionItems, setSessionItems] = useState<ClaimItem[]>([]);
  const [roomTargets, setRoomTargets] = useState<Record<string, number>>({});
  const [acceptedCodes, setAcceptedCodes] = useState<Set<string>>(new Set());
  const [addedByRoom, setAddedByRoom] = useState<Record<string, number>>({});
  const [savingRoom, setSavingRoom] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [artAdded, setArtAdded] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const session = await loadSession();
    if (!session?.claim_items?.length) {
      router.replace("/");
      return;
    }

    setSessionItems(session.claim_items);
    setRoomTargets(session.room_budgets ?? {});

    // Load accepted bundle codes — localStorage first, then Supabase
    const local = getLocalDecisions();
    const accepted = new Set<string>(
      Object.entries(local)
        .filter(([, v]) => v === "accepted" || v === "regenerated")
        .map(([k]) => k)
    );

    try {
      const { data } = await supabase.from("bundle_decisions").select("bundle_code, action");
      for (const d of (data ?? []) as { bundle_code: string; action: string }[]) {
        if (d.action === "accepted" || d.action === "regenerated") {
          accepted.add(d.bundle_code);
          local[d.bundle_code] = d.action;
        }
      }
      localStorage.setItem(LS_DECISIONS, JSON.stringify(local));
    } catch {
      // localStorage fallback already loaded
    }

    setAcceptedCodes(accepted);
    setIsLoading(false);
  }

  // ── Computed ────────────────────────────────────────────────────────────────

  const roomTotals = useMemo(() => {
    const t: Record<string, number> = {};
    for (const item of sessionItems) {
      t[item.room] = (t[item.room] ?? 0) + item.unit_cost * item.qty;
    }
    return t;
  }, [sessionItems]);

  const grandTotal = Object.values(roomTotals).reduce((s, v) => s + v, 0) +
    (artAdded ? 300_000 : 0);
  const progress = Math.min(100, (grandTotal / TARGET) * 100);
  const isNearTarget = grandTotal >= TARGET * 0.9;

  // ── Accept bundle ───────────────────────────────────────────────────────────

  async function handleAccept(roomName: string, bundle: Bundle) {
    setSavingRoom(roomName);
    try {
      // Save decision
      setLocalDecision(bundle.bundle_code, "accepted");
      try {
        await supabase.from("bundle_decisions").upsert(
          { bundle_code: bundle.bundle_code, room: bundle.room, bundle_name: bundle.name, action: "accepted", items: bundle.items, total_value: bundle.total_value },
          { onConflict: "bundle_code" }
        );
      } catch { /* localStorage fallback already saved */ }

      // Add items to claim_items
      const existingKeys = new Set(sessionItems.map((i) => `${i.room}::${i.description}`));
      const newItems: ClaimItem[] = bundle.items
        .filter((bi) => !existingKeys.has(`${bundle.room}::${bi.description}`))
        .map((bi) => ({ room: bundle.room, description: bi.description, brand: bi.brand, model: "", qty: bi.qty, age_years: 0, age_months: 0, condition: "New", unit_cost: bi.unit_cost, category: bi.category }));

      const updated = newItems.length > 0 ? [...sessionItems, ...newItems] : sessionItems;
      if (newItems.length > 0) {
        await saveSession({ claim_items: updated });
        setSessionItems(updated);
      }

      setAcceptedCodes((prev) => new Set([...prev, bundle.bundle_code]));
      setAddedByRoom((prev) => ({ ...prev, [roomName]: (prev[roomName] ?? 0) + bundle.total_value }));
      setToast(`${bundle.name} added — ${formatCurrency(bundle.total_value)}`);
    } finally {
      setSavingRoom(null);
    }
  }

  // ── Item value update ───────────────────────────────────────────────────────

  async function handleItemUpdate(item: ClaimItem, newUnitCost: number) {
    const updated = sessionItems.map((ci) =>
      ci.room === item.room && ci.description === item.description && ci.unit_cost === item.unit_cost
        ? { ...ci, unit_cost: newUnitCost }
        : ci
    );
    await saveSession({ claim_items: updated });
    setSessionItems(updated);
    setToast("Value updated");
  }

  // ── Room target change ──────────────────────────────────────────────────────

  async function handleTargetChange(roomName: string, newTarget: number) {
    const otherRooms = ROOMS.filter((r) => r.name !== roomName);
    const otherTotal = otherRooms.reduce((s, r) => s + (roomTargets[r.name] ?? 0), 0);
    const remaining = TARGET - newTarget;

    const updated: Record<string, number> = { ...roomTargets, [roomName]: newTarget };
    if (otherTotal > 0) {
      for (const r of otherRooms) {
        const frac = (roomTargets[r.name] ?? 0) / otherTotal;
        updated[r.name] = Math.round((remaining * frac) / 100) * 100;
      }
    }

    setRoomTargets(updated);
    await saveSession({ room_budgets: updated });
    setToast("Targets updated across all rooms");
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-[720px] px-4 pb-36 pt-8">

        {/* Header */}
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-widest text-gray-400 mb-1">
            ClaimBuilder
          </p>
          <h1 className="text-2xl font-bold text-gray-900">Israel Claim · #7579B726D</h1>

          <div className="mt-6 rounded-2xl border border-gray-200 bg-gray-50 px-5 py-5">
            <div className="flex items-baseline justify-between mb-3">
              <div>
                <span className="text-sm text-gray-500">Your claim: </span>
                <span className="text-2xl font-bold tabular-nums text-gray-900">{formatCurrency(grandTotal)}</span>
              </div>
              <div className="text-right">
                <span className="text-sm text-gray-500">Goal: </span>
                <span className="text-2xl font-bold tabular-nums text-gray-900">{formatCurrency(TARGET)}</span>
              </div>
            </div>

            <div className="h-4 w-full overflow-hidden rounded-full bg-gray-200">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  isNearTarget ? "bg-green-500" : "bg-[#2563EB]"
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between">
              <p className="text-base font-semibold text-gray-500 tabular-nums">
                {progress.toFixed(0)}% of goal
              </p>
              <p className="text-base text-gray-500 tabular-nums">
                Still needed:{" "}
                <span className="font-bold text-gray-900">{formatCurrency(Math.max(0, TARGET - grandTotal))}</span>
              </p>
            </div>
          </div>
        </header>

        {/* Room list */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {ROOMS.map((room) => (
              <RoomRow
                key={room.name}
                room={room}
                roomTotal={roomTotals[room.name] ?? 0}
                roomTarget={roomTargets[room.name] ?? 0}
                sessionItems={sessionItems}
                acceptedCodes={acceptedCodes}
                saving={savingRoom === room.name}
                onAccept={(bundle) => handleAccept(room.name, bundle)}
                onItemUpdate={handleItemUpdate}
                onTargetChange={handleTargetChange}
                addedThisSession={addedByRoom[room.name] ?? 0}
              />
            ))}
            <ArtRow
              artAdded={artAdded}
              onAdd={() => {
                setArtAdded(true);
                setToast("Art collection placeholder added — $300,000");
              }}
            />
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
            <div className="flex items-center gap-3">
              <a
                href="/api/export-xact"
                className={`min-h-[48px] flex items-center rounded-xl px-5 py-2.5 text-base font-bold transition-colors ${
                  isNearTarget
                    ? "bg-[#16A34A] text-white hover:bg-green-700"
                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                }`}
                onClick={(e) => { if (!isNearTarget) e.preventDefault(); }}
                title={isNearTarget ? "Download claim" : `Reach ${formatCurrency(TARGET * 0.9)} to unlock`}
              >
                Download Claim
              </a>
            </div>
          </div>
          {!isNearTarget && (
            <p className="mt-1 text-xs text-gray-400 text-right">
              Download unlocks at {formatCurrency(TARGET * 0.9)}
            </p>
          )}
        </div>
      </div>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </div>
  );
}
