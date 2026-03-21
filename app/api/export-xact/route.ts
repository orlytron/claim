import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { loadSession } from "../../lib/session";
import { ClaimItem } from "../../lib/types";

function vendorFromUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    // Strip .com / .net / .co.uk etc and capitalise
    const name = hostname.split(".")[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return "";
  }
}

export async function GET() {
  const session = await loadSession();

  if (!session?.claim_items?.length) {
    return NextResponse.json({ error: "No claim items found" }, { status: 404 });
  }

  // Deduplicate by description + room
  const seen = new Set<string>();
  const allItems: ClaimItem[] = [];

  for (const item of session.claim_items) {
    const key = `${item.room}::${item.description}`;
    if (!seen.has(key)) {
      seen.add(key);
      allItems.push(item);
    }
  }

  const grandTotal = allItems.reduce((sum, item) => sum + item.qty * item.unit_cost, 0);

  // ── Header rows ────────────────────────────────────────────────────────────

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

  // ── Item rows ──────────────────────────────────────────────────────────────

  allItems.forEach((item, index) => {
    // Vendor: prefer vendor_name, then parse from vendor_url, then blank
    const vendor = item.vendor_name || vendorFromUrl(item.vendor_url) || "";

    rows.push([
      index + 1,                          // Item #
      item.room,                          // Room
      item.brand || "",                   // Brand or Manufacturer
      item.model || "",                   // Model#
      item.description,                   // Item Description
      vendor,                             // Original Vendor
      item.qty,                           // Quantity Lost
      item.age_years ?? 0,               // Item Age (Years)
      item.age_months ?? 0,              // Item Age (Months)
      item.condition || "Average",        // Condition
      item.unit_cost,                     // Cost to Replace Pre-Tax (each)
      item.qty * item.unit_cost,         // Total Cost
      item.category || "",               // CAT
      "",                                 // SEL
    ]);
  });

  // ── Workbook ───────────────────────────────────────────────────────────────

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  // Column widths for readability
  worksheet["!cols"] = [
    { wch: 6 },   // Item #
    { wch: 22 },  // Room
    { wch: 22 },  // Brand
    { wch: 16 },  // Model#
    { wch: 42 },  // Description
    { wch: 20 },  // Vendor
    { wch: 8 },   // Qty
    { wch: 10 },  // Age (Y)
    { wch: 10 },  // Age (M)
    { wch: 12 },  // Condition
    { wch: 18 },  // Unit cost
    { wch: 14 },  // Total
    { wch: 14 },  // CAT
    { wch: 6 },   // SEL
  ];

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
