import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { loadSession } from "../../lib/session";

export async function GET() {
  const session = await loadSession();

  if (!session?.claim_items?.length) {
    return NextResponse.json({ error: "No claim items found" }, { status: 404 });
  }

  const items = session.claim_items;
  const grandTotal = items.reduce((sum, item) => sum + item.qty * item.unit_cost, 0);

  // ── Build worksheet rows ───────────────────────────────────────────────────

  const rows: unknown[][] = [
    // Row 1 — template version / condition scale
    ["Template Version: 4.3", "Average", "Below Avg.", "Above Avg.", "New", "", "", "", "", "", "", "", "", ""],
    // Row 2 — insured / claim number
    ["Insured:", "ISRAEL, DAVID", "", "", "", "", "Claim Number:", "7579B726D", "", "", "", "State/Prov:", "CA", ""],
    // Row 3 — adjuster / policy number
    ["Adjuster:", "", "", "", "", "", "Policy Number:", "71XS54220", "", "", "", "", "", ""],
    // Row 4 — important information
    ["Important Information:", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    // Row 5-6 — blank spacers
    ["", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    // Row 7 — total (column K, index 10, will be updated below)
    ["Total Estimated Replacement Cost = ", "", "", "", "", "", "", "", "", "", grandTotal, "", "", ""],
    // Row 8 — column headers
    [
      "Item #",
      "Room",
      "Brand or Manufacturer",
      "Model#",
      "Item Description",
      "Original Vendor",
      "Quantity Lost",
      "Item Age (Years)",
      "Item Age (Months)",
      "Condition",
      "Cost to Replace Pre-Tax (each)",
      "Total Cost",
      "CAT",
      "SEL",
    ],
  ];

  // ── Item rows ──────────────────────────────────────────────────────────────

  items.forEach((item, index) => {
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
