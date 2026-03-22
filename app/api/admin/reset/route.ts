import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { ORIGINAL_CLAIM_ITEMS, ORIGINAL_TOTAL, computeOriginalRoomSummary } from "../../../lib/original-claim-data";

export async function POST(req: NextRequest) {
  // Optional: which session to reset (defaults to 'trial')
  let sessionId = "trial";
  try {
    const body = await req.json();
    if (body.sessionId === "test" || body.sessionId === "trial") sessionId = body.sessionId;
  } catch { /* ignore — body is optional */ }

  const roomSummary = computeOriginalRoomSummary();

  // 1. Delete all bundle decisions
  const { error: bdErr } = await supabaseAdmin
    .from("bundle_decisions")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000"); // delete all rows

  if (bdErr) console.warn("bundle_decisions delete warning:", bdErr.message);

  // 2. Reset claim_session to original data (upgrades_cache & client_suggestions unchanged)
  const { error: sessErr } = await supabaseAdmin
    .from("claim_session")
    .upsert(
      {
        id: sessionId,
        status: "complete",
        current_total: ORIGINAL_TOTAL,
        claim_items: ORIGINAL_CLAIM_ITEMS,
        room_summary: roomSummary,
        room_budgets: null,
        item_tiers: null,
        lifestyle_profile: null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (sessErr) {
    return NextResponse.json({ error: sessErr.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    sessionId,
    items: ORIGINAL_CLAIM_ITEMS.length,
    total: ORIGINAL_TOTAL,
    message: `Claim reset. ${ORIGINAL_CLAIM_ITEMS.length} items, $${ORIGINAL_TOTAL.toFixed(2)}`,
  });
}
