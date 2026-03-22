import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabase-admin";

function norm(s: string): string {
  return s.trim().toLowerCase();
}

type CacheRow = {
  item_description: string;
  options?: unknown;
  mid?: unknown;
};

function rowHasValidUpgradeData(row: CacheRow): boolean {
  const opts = row.options;
  const firstOpt =
    Array.isArray(opts) && opts.length > 0 && opts[0] && typeof opts[0] === "object"
      ? (opts[0] as Record<string, unknown>)
      : null;
  const hasOptions =
    !!firstOpt &&
    typeof firstOpt.price === "number" &&
    firstOpt.price > 0 &&
    !firstOpt.mid;

  const mid = row.mid && typeof row.mid === "object" ? (row.mid as Record<string, unknown>) : null;
  const hasMid = !!mid && typeof mid.price === "number" && mid.price > 0;

  return hasOptions || hasMid;
}

/**
 * GET: full list (legacy) — { keys: string[] } — only descriptions with real catalog data
 * GET ?desc=a&desc=b or ?descriptions=csv — { cached: string[] }
 * ?room= is accepted for logging / future use
 */
export async function GET(req: NextRequest) {
  const room = req.nextUrl.searchParams.get("room");
  const descParams = req.nextUrl.searchParams.getAll("desc");
  const csv = req.nextUrl.searchParams.get("descriptions");

  const { data, error } = await supabaseAdmin
    .from("upgrades_cache")
    .select("item_description, options, mid");
  if (error) {
    console.warn("upgrade-cache-status:", error.message);
    return NextResponse.json({ keys: [] as string[], cached: [] as string[] });
  }

  const rows = (data ?? []) as CacheRow[];
  const validKeys =
    rows
      .filter(rowHasValidUpgradeData)
      .map((row) => norm(String(row.item_description ?? "")))
      .filter(Boolean) ?? [];

  const cacheLower = new Set(validKeys);

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
