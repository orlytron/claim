import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabase-admin";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/**
 * GET: full list (legacy) — { keys: string[] }
 * GET ?desc=a&desc=b or ?descriptions=csv — { cached: string[] } descriptions that exist in cache (case-insensitive)
 * ?room= is accepted for logging / future use
 */
export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get("room");
  const descParams = req.nextUrl.searchParams.getAll("desc");
  const csv = req.nextUrl.searchParams.get("descriptions");

  const { data, error } = await supabaseAdmin.from("upgrades_cache").select("item_description");
  if (error) {
    console.warn("upgrade-cache-status:", error.message);
    return NextResponse.json({ keys: [] as string[], cached: [] as string[] });
  }

  const cacheLower = new Set(
    (data ?? []).map((r) => norm(String(r.item_description ?? ""))).filter(Boolean)
  );

  const toCheck: string[] = [...descParams];
  if (csv) {
    toCheck.push(...csv.split("|||").map((s) => s.trim()).filter(Boolean));
  }

  if (toCheck.length === 0) {
    const keys = Array.from(cacheLower);
    return NextResponse.json({ keys, room: room ?? undefined });
  }

  const cached = toCheck.filter((d) => cacheLower.has(norm(d)));
  if (room) {
    console.log("upgrade-cache-status room:", room, "checked:", toCheck.length, "hits:", cached.length);
  }

  return NextResponse.json({
    keys: Array.from(cacheLower),
    cached,
    room: room ?? undefined,
  });
}
