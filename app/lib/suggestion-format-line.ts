import type { SuggestedUpgrade } from "./suggested-upgrades";
import { formatCurrency } from "./utils";

/** Human-readable suggestion row label (delta passed for future use / parity with spec). */
export function formatSuggestionLine(s: SuggestedUpgrade, _delta: number): string {
  switch (s.type) {
    case "ADD":
      return `Add: ${s.item?.description ?? ""}${
        s.item?.qty && s.item.qty > 1 ? ` ×${s.item.qty}` : ""
      }`;
    case "PRICE":
      return `Upgrade: ${s.match_description}`;
    case "QTY":
      return `More: ${s.match_description}${s.new_qty ? ` ×${s.new_qty}` : ""}`;
    case "SPLIT":
      return `Replace: ${s.match_description} → ${s.item_a?.description ?? ""} + ${s.item_b?.description ?? ""}`;
    case "RENAME":
      return `Rename: ${s.match_description} → ${s.new_description}`;
    case "MOVE":
      return `Reclassify: ${s.match_description} → ${s.new_room}`;
    case "REMOVE":
      return `Remove: ${s.match_description}`;
  }
}

/** Right column: money delta, or em dash for zero-dollar RENAME/MOVE. */
export function suggestionDeltaColumn(
  s: SuggestedUpgrade,
  d: number,
  tone: "banner" | "modal"
): { text: string; className: string } {
  const green = tone === "banner" ? "text-green-700" : "text-[#16A34A]";
  const muted = tone === "banner" ? "text-amber-800/70" : "text-[#6B7280]";
  if ((s.type === "RENAME" || s.type === "MOVE") && d === 0) {
    return { text: "—", className: muted };
  }
  if (d > 0) {
    return { text: `+${formatCurrency(d)}`, className: green };
  }
  if (d < 0) {
    const cls = s.type === "PRICE" || s.type === "SPLIT" ? "text-red-600" : "text-red-600";
    return { text: formatCurrency(d), className: cls };
  }
  return { text: formatCurrency(0), className: muted };
}
