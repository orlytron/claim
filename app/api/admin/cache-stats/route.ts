import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-admin";

type CacheRow = {
  id: string;
  options: unknown;
  mid: unknown;
  premium?: unknown;
};

function countOptions(opts: unknown): number {
  return Array.isArray(opts) ? opts.length : 0;
}

function optionVerified(o: unknown): boolean {
  if (!o || typeof o !== "object") return false;
  return Boolean((o as { verified?: boolean }).verified);
}

function rowHasVerifiedOption(row: CacheRow): boolean {
  const opts = row.options;
  if (Array.isArray(opts) && opts.some(optionVerified)) return true;
  for (const k of ["mid", "premium"] as const) {
    const v = row[k];
    if (v && typeof v === "object" && optionVerified(v)) return true;
  }
  return false;
}

export async function GET() {
  const { data, error } = await supabaseAdmin.from("upgrades_cache").select("id, options, mid, premium");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data ?? []) as CacheRow[];
  const total = rows.length;
  let verifiedSerp = 0;
  let threePlus = 0;

  for (const r of rows) {
    const n = countOptions(r.options);
    if (n >= 3) threePlus++;
    if (rowHasVerifiedOption(r)) verifiedSerp++;
  }

  return NextResponse.json({
    total_cached: total,
    verified_serpapi: verifiedSerp,
    items_three_plus_options: threePlus,
  });
}
