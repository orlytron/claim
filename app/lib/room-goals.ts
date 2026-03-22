/** Persisted per-session room targets (aligned with room review pages). */
export const LS_ROOM_GOALS = "claimbuilder_room_targets_v1";

export function readRoomGoals(): Record<string, Record<string, number>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_ROOM_GOALS);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function writeRoomGoal(sessionId: string, room: string, value: number) {
  const all = readRoomGoals();
  all[sessionId] = { ...all[sessionId], [room]: value };
  localStorage.setItem(LS_ROOM_GOALS, JSON.stringify(all));
}

export function readRoomGoal(sessionId: string, room: string): number | null {
  const v = readRoomGoals()[sessionId]?.[room];
  return typeof v === "number" && v >= 0 ? v : null;
}
