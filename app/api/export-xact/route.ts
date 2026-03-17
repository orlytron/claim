import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { loadSession } from "../../lib/session";
import { supabase } from "../../lib/supabase";
import { ClaimItem } from "../../lib/types";

interface BundleDecisionRow {
  room: string;
  items: Array<{
    description: string;
    brand: string;
    qty: number;
    unit_cost: number;
    total: number;
    category: string;
  }>;
}

export async function GET() {
  const session = await loadSession();

  if (!session?.claim_items?.length) {
    return NextResponse.json({ error: "No claim items found" }, { status: 404 });
  }

  // Load accepted bundle decisions
  const { data: decisions } = await supabase
    .from("bundle_decisions")
    .select("room, items")
    .eq("action", "accepted");

  // Merge original claim_items + bundle items, deduplicating by description+room
  const seen = new Set<string>();
  const allItems: ClaimItem[] = [];

  for (const item of session.claim_items) {
    const key = `${item.room}::${item.description}`;
    if (!seen.has(key)) {
      seen.add(key);
      allItems.push(item);
    }
  }

  for (const decision of (decisions as BundleDecisionRow[]) ?? []) {
    for (const bi of decision.items ?? []) {
      const key = `${decision.room}::${bi.description}`;
      if (!seen.has(key)) {
        seen.add(key);
        allItems.push({
          room: decision.room,
          description: bi.description,
          brand: bi.brand ?? "",
          model: "",
          qty: bi.qty,
          age_years: 0,
          age_months: 0,
          condition: "New",
          unit_cost: bi.unit_cost,
          category: bi.category ?? "",
        });
      }
    }
  }

  const grandTotal = allItems.reduce((sum, item) => sum + item.qty * item.unit_cost, 0);

  // ── Build worksheet rows ───────────────────────────────────────────────────

  const rows: unknown[][] = [
    ["Template Version: 4.3", "Average", "Below Avg.", "Above Avg.", "New", "", "", "", "", "", "", "", "", ""],
    ["Insured:", "ISRAEL, DAVID", "", "", "", "", "Claim Number:", "7579B726D", "", "", "", "State/Prov:", "CA", ""],
    ["Adjuster:", "", "", "", "", "", "Policy Number:", "71XS54220", "", "", "", "", "", ""],
    ["Important Information:", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["Total Estimated Replacement Cost = ", "", "", "", "", "", "", "", "", "", grandTotal, "", "", ""],
    [
      "Item #", "Room", "Brand or Manufacturer", "Model#", "Item Description",
      "Original Vendor", "Quantity Lost", "Item Age (Years)", "Item Age (Months)",
      "Condition", "Cost to Replace Pre-Tax (each)", "Total Cost", "CAT", "SEL",
    ],
  ];

  allItems.forEach((item, index) => {
    rows.push([
      index + 1,
      item.room,
      item.brand || "",
      item.model || "",
      item.description,
      "",
      item.qty,
      item.age_years || 0,
      item.age_months || 0,
      item.condition || "Average",
      item.unit_cost,
      item.qty * item.unit_cost,
      item.category || "",
      "",
    ]);
  });

  // ── Create workbook ────────────────────────────────────────────────────────

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");

  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xls" });

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.ms-excel",
      "Content-Disposition": 'attachment; filename="Israel_7579B726D_claim.xls"',
    },
  });
}
