import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local before anything else
dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";

import {
  ORIGINAL_CLAIM_ITEMS,
  computeOriginalRoomSummary,
  ORIGINAL_TOTAL,
} from "../app/lib/original-claim-data";

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌  Missing env vars: NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    console.error("   Make sure .env.local exists at the project root.");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const roomSummary = computeOriginalRoomSummary();
  const computedTotal = ORIGINAL_TOTAL;

  console.log(`\nSeeding ${ORIGINAL_CLAIM_ITEMS.length} items across ${roomSummary.length} rooms…`);
  console.log(`Computed total: $${computedTotal.toFixed(2)}`);

  for (const r of roomSummary) {
    console.log(`  ${r.room}: ${r.item_count} items · $${r.subtotal.toFixed(2)}`);
  }

  const { error } = await supabase
    .from("claim_session")
    .upsert(
      {
        id: "trial",
        status: "complete",
        current_total: ORIGINAL_TOTAL,
        claim_items: ORIGINAL_CLAIM_ITEMS,
        room_summary: roomSummary,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) {
    console.error("\n❌  Supabase upsert failed:", error.message);
    process.exit(1);
  }

  console.log(`\n✅  Done. Seeded claim_session id='trial'`);
  console.log(`   ${ORIGINAL_CLAIM_ITEMS.length} items · $${ORIGINAL_TOTAL.toFixed(2)} · status=complete`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
