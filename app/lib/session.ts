"use server";

import { supabase } from "./supabase";
import { ClaimItem, LifestyleProfile, StoredItemTier } from "./types";

export interface RoomSummary {
  room: string;
  item_count: number;
  subtotal: number;
}

export interface SessionData {
  room_summary: RoomSummary[] | null;
  claim_items: ClaimItem[] | null;
  target_value: number | null;
  current_total: number | null;
  status: string | null;
  lifestyle_profile: LifestyleProfile | null;
  room_budgets: Record<string, number> | null;
  item_tiers: Record<string, StoredItemTier> | null;
  strategy: "upgrades_only" | "upgrades_additions" | null;
}

export async function saveSession(data: Partial<SessionData>): Promise<void> {
  const { error } = await supabase
    .from("claim_session")
    .upsert(
      { id: "trial", ...data, updated_at: new Date().toISOString() },
      { onConflict: "id" }
    );

  if (error) {
    console.error("Failed to save session:", error);
    throw new Error("Failed to save session: " + error.message);
  }
}

export async function loadSession(): Promise<SessionData | null> {
  const { data, error } = await supabase
    .from("claim_session")
    .select("*")
    .eq("id", "trial")
    .single();

  if (error || !data) return null;

  if (
    !data.room_summary &&
    !data.claim_items &&
    data.target_value == null &&
    data.current_total == null &&
    !data.status
  ) {
    return null;
  }

  return {
    room_summary: data.room_summary ?? null,
    claim_items: data.claim_items ?? null,
    target_value: data.target_value ?? null,
    current_total: data.current_total ?? null,
    status: data.status ?? null,
    lifestyle_profile: data.lifestyle_profile ?? null,
    room_budgets: data.room_budgets ?? null,
    item_tiers: data.item_tiers ?? null,
    strategy: data.strategy ?? null,
  };
}
