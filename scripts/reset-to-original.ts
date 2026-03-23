/**
 * Reset trial session claim to ORIGINAL_CLAIM_ITEMS and clear bundle_decisions.
 * Run from repo root: npm run reset-to-original
 */
import * as path from "path";

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import {
  ORIGINAL_CLAIM_ITEMS,
  ORIGINAL_TOTAL,
  computeOriginalRoomSummary,
} from "../app/lib/original-claim-data";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function reset() {
  console.log("Resetting to original", ORIGINAL_CLAIM_ITEMS.length, "items...");

  const roomSummary = computeOriginalRoomSummary();

  const { error: bdErr } = await supabase
    .from("bundle_decisions")
    .delete()
    .neq("id", "00000000-0000-0000-0000-000000000000");

  if (bdErr) {
    console.warn("bundle_decisions:", bdErr.message);
  }

  const { error } = await supabase
    .from("claim_session")
    .update({
      claim_items: ORIGINAL_CLAIM_ITEMS,
      current_total: ORIGINAL_TOTAL,
      room_summary: roomSummary,
      updated_at: new Date().toISOString(),
    })
    .eq("id", "trial");

  if (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }

  console.log("✓ Reset complete");
  console.log(
    "Original total:",
    ORIGINAL_TOTAL.toLocaleString("en-US", { style: "currency", currency: "USD" })
  );
}

reset().catch((e) => {
  console.error(e);
  process.exit(1);
});
