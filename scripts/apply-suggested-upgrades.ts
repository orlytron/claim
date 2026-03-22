/**
 * Applies SUGGESTED_UPGRADES to claim_session id=trial (Supabase).
 *
 * Run: npm run apply-suggestions
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import { createClient } from "@supabase/supabase-js";

import type { ClaimItem } from "../app/lib/types";
import { SUGGESTED_UPGRADES, type SuggestedAddItem, type SuggestedSplitPart, type SuggestedUpgrade } from "../app/lib/suggested-upgrades";

const SESSION_ID = "trial";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function norm(s: string): string {
  return s.trim().toLowerCase();
}

function stripRevert(i: ClaimItem): ClaimItem {
  const { suggestion_revert: _r, ...rest } = i;
  return { ...rest };
}

function findIndex(claim: ClaimItem[], room: string, matchDescription: string): number {
  const m = norm(matchDescription);
  return claim.findIndex((i) => i.room === room && norm(i.description) === m);
}

function fmtMoney(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

function computeRoomSummary(claim: ClaimItem[]) {
  const map: Record<string, { item_count: number; subtotal: number }> = {};
  for (const item of claim) {
    if (!map[item.room]) map[item.room] = { item_count: 0, subtotal: 0 };
    map[item.room].item_count += 1;
    map[item.room].subtotal += item.qty * item.unit_cost;
  }
  return Object.entries(map).map(([room, d]) => ({
    room,
    item_count: d.item_count,
    subtotal: Math.round(d.subtotal * 100) / 100,
  }));
}

function claimTotal(claim: ClaimItem[]): number {
  return Math.round(claim.reduce((s, i) => s + i.qty * i.unit_cost, 0) * 100) / 100;
}

function addItemFromSuggestion(p: SuggestedAddItem): ClaimItem {
  return {
    room: p.room,
    description: p.description,
    brand: p.brand ?? "",
    model: "",
    qty: p.qty,
    age_years: p.age_years,
    age_months: 0,
    condition: p.condition,
    unit_cost: p.unit_cost,
    category: p.category,
    source: "suggestion",
    suggestion_revert: { kind: "add" },
  };
}

function mergeSplitPart(orig: ClaimItem, part: SuggestedSplitPart, partner: SuggestedSplitPart): ClaimItem {
  return {
    ...orig,
    description: part.description,
    brand: part.brand ?? orig.brand,
    unit_cost: part.unit_cost,
    qty: part.qty,
    suggestion_revert: {
      kind: "split_part",
      original: JSON.parse(JSON.stringify(stripRevert(orig))) as ClaimItem,
      partner: {
        description: partner.description,
        unit_cost: partner.unit_cost,
        qty: partner.qty,
      },
    },
  };
}

function addAlreadyPresent(claim: ClaimItem[], p: SuggestedAddItem): boolean {
  return claim.some(
    (i) =>
      i.room === p.room &&
      norm(i.description) === norm(p.description) &&
      Math.abs(i.unit_cost - p.unit_cost) < 0.01 &&
      i.qty === p.qty
  );
}

function applyOne(claim: ClaimItem[], room: string, s: SuggestedUpgrade, stats: Record<string, number>): string | null {
  switch (s.type) {
    case "RENAME": {
      const idx = findIndex(claim, room, s.match_description);
      if (idx < 0) {
        const already = findIndex(claim, room, s.new_description);
        if (already >= 0) return null;
        return `⊘ RENAME skip (not found): ${s.match_description}`;
      }
      const cur = claim[idx]!;
      const prev = cur.description;
      claim[idx] = {
        ...cur,
        description: s.new_description,
        suggestion_revert: { kind: "rename", prevDescription: prev },
      };
      stats.renamed += 1;
      return `✓ RENAMED: ${prev} → ${s.new_description}`;
    }
    case "PRICE": {
      const idx = findIndex(claim, room, s.match_description);
      if (idx < 0) return `⊘ PRICE skip (not found): ${s.match_description}`;
      const cur = claim[idx]!;
      const prevCost = cur.unit_cost;
      const prevQty = cur.qty;
      const prevDesc = cur.description;
      const next: ClaimItem = {
        ...cur,
        unit_cost: s.new_unit_cost,
        suggestion_revert: {
          kind: "price",
          prevUnitCost: prevCost,
          prevQty: s.new_qty !== undefined ? prevQty : undefined,
          prevDescription: s.new_description !== undefined ? prevDesc : undefined,
        },
      };
      if (s.new_description !== undefined) next.description = s.new_description;
      if (s.new_qty !== undefined) next.qty = s.new_qty;
      claim[idx] = next;
      stats.repriced += 1;
      const qtyNote = s.new_qty !== undefined ? ` ×${s.new_qty}` : "";
      const descNote = s.new_description !== undefined ? ` → ${s.new_description}` : "";
      return `✓ PRICE: ${s.match_description} ${fmtMoney(prevCost)} → ${fmtMoney(s.new_unit_cost)}${qtyNote}${descNote}`;
    }
    case "QTY": {
      const idx = findIndex(claim, room, s.match_description);
      if (idx < 0) return `⊘ QTY skip (not found): ${s.match_description}`;
      const cur = claim[idx]!;
      const prevQty = cur.qty;
      const prevCost = cur.unit_cost;
      claim[idx] = {
        ...cur,
        qty: s.new_qty,
        unit_cost: s.new_unit_cost !== undefined ? s.new_unit_cost : cur.unit_cost,
        suggestion_revert: {
          kind: "qty",
          prevQty,
          prevUnitCost: s.new_unit_cost !== undefined ? prevCost : undefined,
        },
      };
      stats.qty += 1;
      const costPart = s.new_unit_cost !== undefined ? ` @ ${fmtMoney(s.new_unit_cost)}` : "";
      return `✓ QTY: ${s.match_description} ${prevQty} → ${s.new_qty}${costPart}`;
    }
    case "MOVE": {
      const idx = findIndex(claim, room, s.match_description);
      if (idx < 0) return `⊘ MOVE skip (not found): ${s.match_description}`;
      const cur = claim[idx]!;
      const prevRoom = cur.room;
      claim[idx] = {
        ...cur,
        room: s.new_room,
        suggestion_revert: { kind: "move", prevRoom },
      };
      stats.moved += 1;
      return `✓ MOVE: ${s.match_description} ${prevRoom} → ${s.new_room}`;
    }
    case "ADD": {
      if (addAlreadyPresent(claim, s.item)) {
        return `⊘ ADD skip (exists): ${s.item.description}`;
      }
      claim.push(addItemFromSuggestion(s.item));
      stats.added += 1;
      return `✓ ADD: ${s.item.description} ${fmtMoney(s.item.unit_cost)}${s.item.qty > 1 ? ` ×${s.item.qty}` : ""}`;
    }
    case "REMOVE": {
      const idx = findIndex(claim, room, s.match_description);
      if (idx < 0) return `⊘ REMOVE skip (not found): ${s.match_description}`;
      claim.splice(idx, 1);
      stats.removed += 1;
      return `✓ REMOVE: ${s.match_description}`;
    }
    case "SPLIT": {
      const idx = findIndex(claim, room, s.match_description);
      if (idx < 0) return `⊘ SPLIT skip (not found): ${s.match_description}`;
      const raw = claim[idx]!;
      const orig = JSON.parse(JSON.stringify(stripRevert(raw))) as ClaimItem;
      const a = mergeSplitPart(orig, s.item_a, s.item_b);
      const b = mergeSplitPart(orig, s.item_b, s.item_a);
      claim.splice(idx, 1, a, b);
      stats.split += 1;
      return `✓ SPLIT: ${s.match_description} → ${s.item_a.description} + ${s.item_b.description}`;
    }
    default:
      return null;
  }
}

async function main() {
  const stats = {
    renamed: 0,
    repriced: 0,
    qty: 0,
    added: 0,
    removed: 0,
    split: 0,
    moved: 0,
  };
  let logLines = 0;

  const { data: row, error: loadErr } = await supabaseAdmin.from("claim_session").select("*").eq("id", SESSION_ID).single();
  if (loadErr || !row) {
    console.error("Could not load claim_session:", loadErr?.message ?? "no row");
    process.exit(1);
  }

  const claim = [...((row.claim_items ?? []) as ClaimItem[])];

  for (const [room, list] of Object.entries(SUGGESTED_UPGRADES)) {
    for (const s of list) {
      const line = applyOne(claim, room, s, stats);
      if (line) {
        console.log(line);
        logLines += 1;
      }
    }
  }

  const totalChanges =
    stats.renamed + stats.repriced + stats.qty + stats.added + stats.removed + stats.split + stats.moved;
  const newTotal = claimTotal(claim);
  const roomSummary = computeRoomSummary(claim);

  const { error: upErr } = await supabaseAdmin
    .from("claim_session")
    .update({
      claim_items: claim,
      room_summary: roomSummary,
      current_total: newTotal,
      updated_at: new Date().toISOString(),
    })
    .eq("id", SESSION_ID);

  if (upErr) {
    console.error("Upsert failed:", upErr.message);
    process.exit(1);
  }

  console.log("\n──────── Summary ────────");
  console.log(`Log lines (incl. skips): ${logLines}`);
  console.log(`Total changes: ${totalChanges}`);
  console.log(`Items renamed: ${stats.renamed}`);
  console.log(`Items repriced: ${stats.repriced}`);
  console.log(`Qty updates: ${stats.qty}`);
  console.log(`Items added: ${stats.added}`);
  console.log(`Items removed: ${stats.removed}`);
  console.log(`Items split: ${stats.split}`);
  console.log(`Items moved: ${stats.moved}`);
  console.log(`New claim total: ${fmtMoney(newTotal)}`);
  console.log("Done.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
