import type { ClaimItem, ClaimItemSource } from "./types";

/**
 * Merge incoming items into current claim_items.
 * Match: same room + case-insensitive description.
 * - No match → append
 * - Match & new unit_cost > existing → replace row
 * - Match & new unit_cost <= existing → skip (duplicate / not an upgrade)
 */
export function mergeClaimIncoming(
  current: ClaimItem[],
  incoming: ClaimItem[],
  incomingSource: ClaimItemSource
): ClaimItem[] {
  const tagged = incoming.map((i) => ({
    ...i,
    source: (i.source ?? incomingSource) as ClaimItemSource,
  }));

  let merged = [...current];
  for (const newItem of tagged) {
    const existing = merged.find(
      (i) =>
        i.room === newItem.room &&
        i.description.trim().toLowerCase() === newItem.description.trim().toLowerCase()
    );
    if (!existing) {
      merged.push(newItem);
    } else if (newItem.unit_cost > existing.unit_cost) {
      merged = merged.map((i) =>
        i === existing ? { ...newItem, source: newItem.source ?? incomingSource } : i
      );
    }
  }
  return merged;
}
