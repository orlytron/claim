import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabase-admin";

const SOURCES = new Set(["similar", "upgrade", "manual"]);

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      item_description?: string;
      room?: string;
      claimed_price?: number;
      replacement_price?: number;
      brand?: string;
      model?: string;
      retailer_url?: string;
      source?: string;
    };

    const item_description = typeof body.item_description === "string" ? body.item_description.trim() : "";
    const room = typeof body.room === "string" ? body.room.trim() : "";
    const claimed_price =
      typeof body.claimed_price === "number" && Number.isFinite(body.claimed_price) ? body.claimed_price : NaN;
    const replacement_price =
      typeof body.replacement_price === "number" && Number.isFinite(body.replacement_price)
        ? body.replacement_price
        : NaN;
    const source = typeof body.source === "string" ? body.source.trim() : "";

    if (!item_description || !room || !SOURCES.has(source) || Number.isNaN(claimed_price) || Number.isNaN(replacement_price)) {
      return NextResponse.json({ error: "Invalid body" }, { status: 400 });
    }

    const { error } = await supabaseAdmin.from("replacement_prices").insert({
      item_description,
      room,
      claimed_price,
      replacement_price: Math.round(replacement_price * 100) / 100,
      brand: typeof body.brand === "string" ? body.brand.trim() : null,
      model: typeof body.model === "string" ? body.model.trim() : null,
      retailer_url: typeof body.retailer_url === "string" ? body.retailer_url.trim() : null,
      source,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
