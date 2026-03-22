import type { ClaimItem } from "./types";

/** Xact export + preview sort order (matches product spec). */
export const EXPORT_ROOM_ORDER = [
  "Living Room",
  "Kitchen",
  "David Office / Guest Room",
  "Bedroom Orly",
  "Bedroom Rafe",
  "Patio",
  "Garage",
  "Bathroom Master",
  "Bathroom White",
  "Art Collection",
  "Art",
];

export function exportRoomSortKey(room: string): number {
  const r = room.trim() || "Uncategorized";
  const normalized = r === "Art" ? "Art Collection" : r;
  const i = EXPORT_ROOM_ORDER.indexOf(normalized);
  if (i !== -1) return i;
  const j = EXPORT_ROOM_ORDER.indexOf(r);
  return j === -1 ? 999 : j;
}

/** Excel / PDF-style room label (legacy "Art" → Art Collection). */
export function displayRoomForExport(room: string): string {
  const r = (room || "").trim();
  if (r === "Art") return "Art Collection";
  return r || "Uncategorized";
}

/**
 * Sort: room order, then unit_cost DESC (art collection = value DESC per line).
 */
export function sortClaimItemsForExport(items: ClaimItem[]): ClaimItem[] {
  return [...items].sort((a, b) => {
    const ai = exportRoomSortKey(a.room);
    const bi = exportRoomSortKey(b.room);
    if (ai !== bi) return ai - bi;
    return b.unit_cost - a.unit_cost;
  });
}

export function groupItemsByExportRoom(sorted: ClaimItem[]): Map<string, ClaimItem[]> {
  const m = new Map<string, ClaimItem[]>();
  for (const it of sorted) {
    const key = displayRoomForExport(it.room);
    m.set(key, [...(m.get(key) ?? []), it]);
  }
  return m;
}
