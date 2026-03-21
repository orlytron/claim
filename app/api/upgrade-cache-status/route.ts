import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabase-admin";

/** Returns lowercase trimmed cache keys for client-side "has cached upgrade?" checks. */
export async function GET() {
  const { data, error } = await supabaseAdmin.from("upgrades_cache").select("item_description");
  if (error) {
    console.warn("upgrade-cache-status:", error.message);
    return NextResponse.json({ keys: [] as string[] });
  }
  const keys = (data ?? []).map((r) => String(r.item_description ?? "").trim().toLowerCase()).filter(Boolean);
  return NextResponse.json({ keys });
}
