import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { supabaseAdmin } from "../../../lib/supabase-admin";
import { ORIGINAL_CLAIM_ITEMS, ORIGINAL_TOTAL } from "../../../lib/original-claim-data";
import type { ClaimItem } from "../../../lib/types";
import { displayRoomForExport, sortClaimItemsForExport } from "../../../lib/claim-export-shared";

function norm(s: string) {
  return s.trim().toLowerCase();
}

function lineKey(i: Pick<ClaimItem, "room" | "description">) {
  return `${norm(i.room)}|${norm(i.description)}`;
}

function lineTotal(i: ClaimItem) {
  return i.qty * i.unit_cost;
}

export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId") || "trial";

  const { data: sessionRow, error } = await supabaseAdmin
    .from("claim_session")
    .select("claim_items")
    .eq("id", sessionId)
    .single();

  if (error || !sessionRow) {
    return NextResponse.json({ error: error?.message ?? "Session not found" }, { status: 404 });
  }

  const current = (sessionRow.claim_items ?? []) as ClaimItem[];
  const orig = ORIGINAL_CLAIM_ITEMS as unknown as ClaimItem[];

  const origByLine = new Map<string, ClaimItem>();
  for (const o of orig) {
    origByLine.set(lineKey(o), o);
  }

  const currentKeys = new Set(current.map(lineKey));

  const rows: unknown[][] = [
    ["Admin report — current vs original PDF"],
    ["Session ID", sessionId],
    ["Generated (UTC)", new Date().toISOString()],
    [],
    ["Metric", "Value"],
    ["Original line count", orig.length],
    ["Original total $", ORIGINAL_TOTAL],
    ["Current line count", current.length],
    ["Current total $", current.reduce((s, i) => s + lineTotal(i), 0)],
    [],
    ["Section", "Room", "Description", "Qty", "Unit was", "Unit now", "Line total", "Source"],
  ];

  for (const c of sortClaimItemsForExport(current)) {
    const o = origByLine.get(lineKey(c));
    if (!o) {
      rows.push([
        "added",
        displayRoomForExport(c.room),
        c.description,
        c.qty,
        "",
        c.unit_cost,
        lineTotal(c),
        c.source ?? "",
      ]);
      continue;
    }
    if (Math.abs(c.unit_cost - o.unit_cost) > 0.01 || c.qty !== o.qty || c.description !== o.description) {
      rows.push([
        c.source === "upgrade" ? "upgraded" : "modified",
        displayRoomForExport(c.room),
        c.description,
        c.qty,
        o.unit_cost,
        c.unit_cost,
        lineTotal(c),
        c.source ?? "original",
      ]);
    }
  }

  for (const o of orig) {
    if (!currentKeys.has(lineKey(o))) {
      rows.push([
        "removed",
        displayRoomForExport(o.room),
        o.description,
        o.qty,
        o.unit_cost,
        "",
        -lineTotal(o),
        "—",
      ]);
    }
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Report");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const dateStr = new Date().toISOString().slice(0, 10);

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="admin-report-${sessionId}-${dateStr}.xlsx"`,
    },
  });
}
