import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "../../lib/supabase-admin";
import { mergeClaimIncoming } from "../../lib/claim-item-merge";
import type { ClaimItem } from "../../lib/types";

const ROOM_ORDER = [
  "Living Room",
  "Kitchen",
  "David Office / Guest Room",
  "Bedroom Orly",
  "Bedroom Rafe",
  "Patio",
  "Garage",
  "Bathroom Master",
  "Bathroom White",
  "Art",
  "Art Collection",
];

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

function roomIndex(room: string): number {
  const i = ROOM_ORDER.indexOf(room);
  return i === -1 ? 999 : i;
}

function rawToClaimItem(row: Record<string, unknown>, room: string, source: ClaimItem["source"]): ClaimItem {
  return {
    room: String(row.room ?? room),
    description: String(row.description ?? ""),
    brand: String(row.brand ?? ""),
    model: String(row.model ?? ""),
    qty: Number(row.qty ?? 1),
    age_years: Number(row.age_years ?? 0),
    age_months: 0,
    condition: String(row.condition ?? "Average"),
    unit_cost: Number(row.unit_cost ?? 0),
    category: String(row.category ?? ""),
    vendor_url: row.vendor_url as string | undefined,
    vendor_name: row.vendor_name as string | undefined,
    source,
  };
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId") || "trial";

  const { data: sessionRow, error: sErr } = await supabaseAdmin
    .from("claim_session")
    .select("claim_items")
    .eq("id", sessionId)
    .single();

  if (sErr || !sessionRow?.claim_items?.length) {
    return NextResponse.json({ error: "No claim items found" }, { status: 404 });
  }

  const originalItems = sessionRow.claim_items as ClaimItem[];

  const { data: acceptedDecisions } = await supabaseAdmin
    .from("bundle_decisions")
    .select("*")
    .eq("action", "accepted");

  const bundleItems: ClaimItem[] =
    acceptedDecisions?.flatMap((d) => {
      const room = String(d.room ?? "");
      const items = (d.items ?? []) as Record<string, unknown>[];
      return items.map((item) => rawToClaimItem(item, room, "bundle"));
    }) ?? [];

  const { data: upgradeDecisions } = await supabaseAdmin
    .from("bundle_decisions")
    .select("*")
    .eq("action", "upgrade_applied");

  const upgradeItems: ClaimItem[] =
    upgradeDecisions?.flatMap((d) => {
      const room = String(d.room ?? "");
      const items = (d.items ?? []) as Record<string, unknown>[];
      return items.map((item) => rawToClaimItem(item, room, "upgrade"));
    }) ?? [];

  let allItems: ClaimItem[] = [...originalItems];
  if (bundleItems.length) {
    allItems = mergeClaimIncoming(allItems, bundleItems, "bundle");
  }
  if (upgradeItems.length) {
    allItems = mergeClaimIncoming(allItems, upgradeItems, "upgrade");
  }

  allItems.sort((a, b) => {
    const ai = roomIndex(a.room);
    const bi = roomIndex(b.room);
    if (ai !== bi) return ai - bi;
    return b.unit_cost - a.unit_cost;
  });

  const grandTotal = allItems.reduce((sum, item) => sum + item.qty * item.unit_cost, 0);

  const headerRows: unknown[][] = [
    ["Template Version: 4.3", "Average", "Below Avg.", "Above Avg.", "New", "", "", "", "", "", "", "", "", ""],
    ["Insured:", "ISRAEL, DAVID", "", "", "", "", "Claim Number:", "7579B726D", "", "", "", "State/Prov:", "CA", ""],
    ["Adjuster:", "", "", "", "", "", "Policy Number:", "71XS54220", "", "", "", "", "", ""],
    ["Important Information:", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["", "", "", "", "", "", "", "", "", "", "", "", "", ""],
    ["Total Estimated Replacement Cost = ", "", "", "", "", "", "", "", "", "", grandTotal, "", "", ""],
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
      "",
      "",
    ]);
    roomRunSubtotal = 0;
  };

  for (const item of allItems) {
    if (lastRoom !== null && item.room !== lastRoom) {
      flushRoomSubtotal(lastRoom);
    }
    lastRoom = item.room;
    itemNum += 1;
    const lineTotal = item.qty * item.unit_cost;
    roomRunSubtotal += lineTotal;

    const vendor = item.vendor_name || vendorFromUrl(item.vendor_url) || "";

    itemRows.push([
      itemNum,
      item.room,
      item.brand || "",
      item.model || "",
      item.description,
      vendor,
      item.qty,
      item.age_years ?? 0,
      0,
      item.condition || "Average",
      item.unit_cost,
      lineTotal,
      item.category || "",
      "",
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
    { wch: 14 },
    { wch: 6 },
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
