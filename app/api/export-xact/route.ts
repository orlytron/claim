import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "../../lib/supabase-admin";
import {
  displayRoomForExport,
  sortClaimItemsForExport,
} from "../../lib/claim-export-shared";
import { cleanDescription } from "../../lib/clean-description";
import type { ClaimItem } from "../../lib/types";

function mapCondition(condition: string, ageYears: number): string {
  const c = (condition || "").toLowerCase();
  if (c.includes("new") || c.includes("like new") || ageYears <= 2) return "New";
  if (c.includes("above") || c.includes("excellent") || ageYears <= 4) return "Above Avg.";
  if (c.includes("below") || c.includes("fair") || c.includes("poor") || ageYears >= 7) return "Below Avg.";
  return "Average";
}

function vendorFromUrl(url: string | undefined): string {
  if (!url) return "";
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const name = hostname.split(".")[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return "";
  }
}

/** Original vendor column: retailer on upgraded line, else vendor_name / URL host. */
function originalVendorColumn(item: ClaimItem): string {
  const direct = (item.vendor_name || "").trim();
  if (direct) return direct;
  const fromUrl = vendorFromUrl(item.vendor_url);
  if (fromUrl) return fromUrl;
  if (item.source === "upgrade" && item.pre_upgrade_item) {
    return "";
  }
  return "";
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId") || "trial";

  const { data: sessionRow, error: sErr } = await supabaseAdmin
    .from("claim_session")
    .select("claim_items")
    .eq("id", sessionId)
    .single();

  if (sErr || !sessionRow) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Single source of truth: session claim_items includes originals, suggestions,
  // bundle/focused additions, upgrades (current unit_cost), and art lines.
  const raw = (sessionRow.claim_items ?? []) as ClaimItem[];
  const allItems = sortClaimItemsForExport(raw);

  const grandTotal = allItems.reduce((sum, item) => sum + item.qty * item.unit_cost, 0);

  const headerRows: unknown[][] = [
    ["Template Version: 4.3", "Average", "Below Avg.", "Above Avg.", "New", "", "", "", "", "", "", ""],
    ["Insured:", "ISRAEL, DAVID", "", "", "", "", "Claim Number:", "7579B726D", "", "", "State/Prov:", "CA"],
    ["Adjuster:", "", "", "", "", "", "Policy Number:", "71XS54220", "", "", "", ""],
    ["Important Information:", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "", ""],
    ["Total Estimated Replacement Cost = ", "", "", "", "", "", "", "", "", "", grandTotal, ""],
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
    ],
  ];

  const itemRows: unknown[][] = [];
  let itemNum = 0;
  let lastRoom: string | null = null;
  let roomRunSubtotal = 0;

  const flushRoomSubtotal = (roomName: string) => {
    itemRows.push([
      "",
      "",
      "",
      "",
      `--- ${roomName} SUBTOTAL ---`,
      "",
      "",
      "",
      "",
      "",
      "",
      roomRunSubtotal,
    ]);
    roomRunSubtotal = 0;
  };

  for (const item of allItems) {
    const displayRoom = displayRoomForExport(item.room);
    if (lastRoom !== null && displayRoom !== lastRoom) {
      flushRoomSubtotal(lastRoom);
    }
    lastRoom = displayRoom;
    itemNum += 1;
    const lineTotal = item.qty * item.unit_cost;
    roomRunSubtotal += lineTotal;

    const isNew = (item.condition || "").toLowerCase() === "new" || item.source === "bundle" || item.source === "suggestion";
    const ageYears = isNew ? 0 : item.age_years ?? 0;
    const ageMonths = isNew ? 0 : item.age_months ?? 0;

    itemRows.push([
      itemNum,
      displayRoom,
      item.brand || "",
      item.model || "",
      cleanDescription(item.description),
      originalVendorColumn(item),
      item.qty,
      ageYears,
      ageMonths,
      mapCondition(item.condition || "", ageYears),
      item.unit_cost,
      lineTotal,
    ]);
  }

  if (lastRoom !== null) {
    flushRoomSubtotal(lastRoom);
  }

  const rows = [...headerRows, ...itemRows];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);

  worksheet["K7"] = {
    v: grandTotal,
    t: "n",
    z: "#,##0.00",
  };

  worksheet["!cols"] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 22 },
    { wch: 16 },
    { wch: 42 },
    { wch: 20 },
    { wch: 8 },
    { wch: 10 },
    { wch: 10 },
    { wch: 12 },
    { wch: 18 },
    { wch: 14 },
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Inventory");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xls" });

  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `Israel_7579B726D_claim_${dateStr}.xls`;

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.ms-excel",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
