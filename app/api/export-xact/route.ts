import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "../../lib/supabase-admin";
import {
  displayRoomForExport,
  sortClaimItemsForExport,
} from "../../lib/claim-export-shared";
import { cleanDescription } from "../../lib/clean-description";
import type { ClaimItem } from "../../lib/types";

function cleanExportDescription(description: string, brand: string): string {
  if (!brand?.trim()) return description;
  const d = description.trim();
  const b = brand.trim();
  // Remove brand from start of description
  if (d.toLowerCase().startsWith(b.toLowerCase() + " ")) {
    return d.slice(b.length + 1).trim();
  }
  if (d.toLowerCase() === b.toLowerCase()) {
    return d;
  }
  return d;
}

function mapCondition(condition: string, ageYears: number): string {
  const c = (condition || "").toLowerCase();
  if (c === "new") return "New";
  if (c === "like new") return "New";
  if (c === "good") return "Above Avg.";
  if (c === "decent") return "Average";
  if (c === "used") return "Below Avg.";
  // Age fallback
  if (!ageYears || ageYears === 0) return "New";
  if (ageYears <= 5) return "New";
  if (ageYears <= 10) return "Above Avg.";
  if (ageYears <= 15) return "Average";
  return "Below Avg.";
}

function optionPrice(o: unknown): number {
  if (!o || typeof o !== "object") return 0;
  const p = (o as { price?: unknown }).price;
  if (typeof p === "number" && p > 0) return p;
  if (typeof p === "string") return parseFloat(p.replace(/[^0-9.]/g, "")) || 0;
  return 0;
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

function getReplacementCost(
  item: ClaimItem,
  replacementPriceMap: Record<string, number>
): number {
  const desc = (item.pre_upgrade_item?.description || item.description).toLowerCase();
  const cached = replacementPriceMap[desc];
  if (cached != null && cached > item.unit_cost) {
    return cached;
  }
  return item.unit_cost;
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId") || "trial";

  const { data: cacheRows } = await supabaseAdmin
    .from("upgrades_cache")
    .select("item_description, options");

  const replacementPriceMap: Record<string, number> = {};
  for (const row of cacheRows || []) {
    const rd = row as { item_description?: string; options?: unknown };
    const desc = typeof rd.item_description === "string" ? rd.item_description.trim() : "";
    if (!desc) continue;
    const opts = Array.isArray(rd.options) ? rd.options : [];
    const mid = opts[1];
    const price = optionPrice(mid);
    if (price > 0) {
      const key = desc.toLowerCase();
      replacementPriceMap[key] = Math.max(replacementPriceMap[key] ?? 0, price);
    }
  }

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

  const TEST_DESCRIPTIONS = ["elephant presenting flower", "kai schaeffer", "banksy", "bowl with food"];
  const exportItems = allItems.filter((item) => {
    const d = item.description.toLowerCase();
    return !TEST_DESCRIPTIONS.some((t) => d.includes(t));
  });

  const grandTotal = exportItems.reduce(
    (sum, item) => sum + item.qty * getReplacementCost(item, replacementPriceMap),
    0
  );

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

  for (const item of exportItems) {
    const displayRoom = displayRoomForExport(item.room);
    if (lastRoom !== null && displayRoom !== lastRoom) {
      flushRoomSubtotal(lastRoom);
    }
    lastRoom = displayRoom;
    itemNum += 1;
    const eachReplace = getReplacementCost(item, replacementPriceMap);
    const lineTotal = item.qty * eachReplace;
    roomRunSubtotal += lineTotal;

    const isNew = (item.condition || "").toLowerCase() === "new" || item.source === "bundle" || item.source === "suggestion";
    const ageYears = isNew ? 0 : item.age_years ?? 0;
    const ageMonths = isNew ? 0 : item.age_months ?? 0;

    itemRows.push([
      itemNum,
      displayRoom,
      item.brand || "",
      item.model || "",
      cleanDescription(cleanExportDescription(item.description, item.brand || "")),
      originalVendorColumn(item),
      item.qty,
      ageYears,
      ageMonths,
      mapCondition(item.condition || "", ageYears),
      eachReplace,
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
