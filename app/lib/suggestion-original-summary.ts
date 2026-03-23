/**
 * Compare scripted suggestions against ORIGINAL_CLAIM_ITEMS (pre-seed claim) for informational UI.
 */
import { ORIGINAL_CLAIM_ITEMS, type OriginalClaimItem } from "./original-claim-data";
import type { SuggestedUpgrade } from "./suggested-upgrades";
import { formatCurrency } from "./utils";

function norm(d: string): string {
  return d.trim().toLowerCase();
}

export function findOriginalInRoom(room: string, matchDescription: string): OriginalClaimItem | undefined {
  const m = norm(matchDescription);
  const rr = norm(room);
  return ORIGINAL_CLAIM_ITEMS.find((i) => norm(i.room) === rr && norm(i.description) === m);
}

function findOriginalAnywhere(matchDescription: string): OriginalClaimItem | undefined {
  const m = norm(matchDescription);
  return ORIGINAL_CLAIM_ITEMS.find((i) => norm(i.description) === m);
}

/** Dollar delta vs original claim (same semantics as getSuggestionDelta, but ORIGINAL_CLAIM_ITEMS baseline). */
export function getSuggestionDeltaVsOriginal(s: SuggestedUpgrade, roomName: string): number {
  switch (s.type) {
    case "RENAME":
    case "MOVE":
      return 0;
    case "PRICE": {
      const orig = findOriginalInRoom(roomName, s.match_description);
      if (!orig) return 0;
      const newCost = s.new_unit_cost ?? orig.unit_cost;
      const newQty = s.new_qty ?? orig.qty;
      return newQty * newCost - orig.qty * orig.unit_cost;
    }
    case "QTY": {
      const orig = findOriginalInRoom(roomName, s.match_description);
      if (!orig) return 0;
      const newQty = s.new_qty ?? orig.qty;
      const newCost = s.new_unit_cost ?? orig.unit_cost;
      return newQty * newCost - orig.qty * orig.unit_cost;
    }
    case "ADD": {
      const addDesc = (s.item?.description ?? "").trim().toLowerCase();
      if (!addDesc) return 0;
      const exists = ORIGINAL_CLAIM_ITEMS.some((i) => norm(i.description) === addDesc);
      if (exists) return 0;
      return (s.item?.unit_cost ?? 0) * (s.item?.qty ?? 1);
    }
    case "SPLIT": {
      const orig = findOriginalInRoom(roomName, s.match_description);
      if (!orig) return 0;
      const newTotal =
        s.item_a.unit_cost * s.item_a.qty + s.item_b.unit_cost * s.item_b.qty;
      return newTotal - orig.qty * orig.unit_cost;
    }
    case "REMOVE": {
      const orig = findOriginalInRoom(roomName, s.match_description);
      if (!orig) return 0;
      return -(orig.unit_cost * orig.qty);
    }
    default:
      return 0;
  }
}

export type SplitSummaryDetail = {
  matchLabel: string;
  originalLine: string;
  partLines: { label: string; lineTotal: number }[];
  netDelta: number;
};

export type RoomSuggestionMainRow =
  | { kind: "simple"; text: string; delta: number }
  | { kind: "split"; detail: SplitSummaryDetail; delta: number };

export type RoomSuggestionMetaRow = { kind: "meta"; text: string };

function simpleRowForSuggestion(s: SuggestedUpgrade, roomName: string, delta: number): string | null {
  switch (s.type) {
    case "PRICE": {
      const orig = findOriginalInRoom(roomName, s.match_description);
      if (!orig) return null;
      const label = s.new_description?.trim() || s.match_description;
      const newCost = s.new_unit_cost ?? orig.unit_cost;
      const newQty = s.new_qty ?? orig.qty;
      const oldEach = orig.unit_cost;
      if (orig.qty > 1 || newQty > 1) {
        return `${label} ×${newQty}    ${formatCurrency(oldEach)} → ${formatCurrency(newCost)} ea`;
      }
      return `${label}    ${formatCurrency(oldEach)} → ${formatCurrency(newCost)}`;
    }
    case "QTY": {
      const orig = findOriginalInRoom(roomName, s.match_description);
      if (!orig) return null;
      const sign = delta >= 0 ? "+" : "";
      return `${s.match_description} ${orig.qty} → ${s.new_qty}    ${sign}${formatCurrency(delta)}`;
    }
    case "ADD": {
      const it = s.item;
      const x = it.qty > 1 ? ` ×${it.qty}` : "";
      return `Added: ${it.description}${x}    +${formatCurrency(delta)}`;
    }
    case "REMOVE": {
      return `Removed: ${s.match_description}    ${formatCurrency(delta)}`;
    }
    default:
      return null;
  }
}

function splitDetail(s: Extract<SuggestedUpgrade, { type: "SPLIT" }>, roomName: string): SplitSummaryDetail | null {
  const orig = findOriginalInRoom(roomName, s.match_description);
  if (!orig) return null;
  const origTotal = orig.qty * orig.unit_cost;
  const originalLine = `${orig.qty} × ${orig.description} @ ${formatCurrency(orig.unit_cost)} = ${formatCurrency(origTotal)}`;
  const partLines = [
    {
      label: `${s.item_a.description} ${s.item_a.qty} × ${formatCurrency(s.item_a.unit_cost)}`,
      lineTotal: s.item_a.qty * s.item_a.unit_cost,
    },
    {
      label: `${s.item_b.description} ${s.item_b.qty} × ${formatCurrency(s.item_b.unit_cost)}`,
      lineTotal: s.item_b.qty * s.item_b.unit_cost,
    },
  ];
  const netDelta = partLines.reduce((a, p) => a + p.lineTotal, 0) - origTotal;
  return {
    matchLabel: s.match_description,
    originalLine,
    partLines,
    netDelta,
  };
}

export function buildRoomSuggestionSummary(roomName: string, list: SuggestedUpgrade[]) {
  const main: RoomSuggestionMainRow[] = [];
  const meta: RoomSuggestionMetaRow[] = [];

  for (const s of list) {
    if (s.type === "RENAME") {
      meta.push({ kind: "meta", text: `${s.match_description} → ${s.new_description}` });
      continue;
    }
    if (s.type === "MOVE") {
      meta.push({ kind: "meta", text: `${s.match_description} → ${s.new_room}` });
      continue;
    }
    if (s.type === "SPLIT") {
      const d = getSuggestionDeltaVsOriginal(s, roomName);
      if (Math.abs(d) < 0.005) continue;
      const detail = splitDetail(s, roomName);
      if (!detail) continue;
      main.push({ kind: "split", detail, delta: d });
      continue;
    }

    const d = getSuggestionDeltaVsOriginal(s, roomName);
    if (Math.abs(d) < 0.005) continue;
    const text = simpleRowForSuggestion(s, roomName, d);
    if (!text) continue;
    main.push({ kind: "simple", text, delta: d });
  }

  const totalDelta = Math.round(main.reduce((sum, r) => sum + r.delta, 0) * 100) / 100;

  return { main, meta, totalDelta };
}
