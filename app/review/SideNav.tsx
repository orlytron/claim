"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SessionData } from "../lib/session";
import { generateItemId, slugify, formatCurrency } from "../lib/utils";

function computeRoomTotals(session: SessionData): Record<string, number> {
  if (!session.claim_items) return {};
  const totals: Record<string, number> = {};

  session.claim_items.forEach((item) => {
    const id = generateItemId(item);
    const storedTier = session.item_tiers?.[id];
    const selectedTierData = storedTier?.tiers?.find((t) => t.tier === storedTier.selected_tier);
    const price = selectedTierData?.unit_cost ?? item.unit_cost;
    const room = item.room || "Uncategorized";
    totals[room] = (totals[room] ?? 0) + price * item.qty;
  });

  return totals;
}

function computePlausibility(session: SessionData) {
  const counts = { green: 0, yellow: 0, red: 0 };
  if (!session.claim_items) return counts;

  session.claim_items.forEach((item) => {
    const id = generateItemId(item);
    const storedTier = session.item_tiers?.[id];
    if (!storedTier) { counts.green++; return; }
    const selectedTierData = storedTier.tiers?.find((t) => t.tier === storedTier.selected_tier);
    const p = (selectedTierData?.plausibility ?? "green") as "green" | "yellow" | "red";
    counts[p]++;
  });

  return counts;
}

export default function SideNav({ session }: { session: SessionData | null }) {
  const pathname = usePathname();
  if (!session) return null;

  const rooms = session.room_summary?.map((r) => r.room) ?? [];
  const roomTotals = computeRoomTotals(session);
  const plausibility = computePlausibility(session);
  const targetValue = session.target_value ?? 0;
  const grandTotal = Object.values(roomTotals).reduce((s, v) => s + v, 0);
  const grandPct = targetValue > 0 ? Math.min(100, (grandTotal / targetValue) * 100) : 0;

  return (
    <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r border-gray-100 bg-white lg:flex overflow-y-auto">
      {/* Header + progress */}
      <div className="px-4 py-4 border-b border-gray-100">
        <Link href="/" className="block">
          <p className="text-sm font-semibold tracking-tight text-gray-900">Israel Claim</p>
          <p className="text-xs text-gray-400">Claim #7579B726D</p>
        </Link>
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="tabular-nums font-semibold text-gray-900">
              {formatCurrency(grandTotal)}
            </span>
            <span className="text-gray-400">
              → {formatCurrency(targetValue || 1_600_000)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-[#2563EB] transition-all"
              style={{ width: `${grandPct}%` }}
            />
          </div>
          <p className="mt-0.5 text-xs text-gray-400">{grandPct.toFixed(0)}% of target</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <Link
          href="/review"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
        >
          <span>🏠</span> All Rooms
        </Link>

        <div className="pt-2 pb-1 px-3">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Rooms</p>
        </div>

        {rooms.map((room) => {
          const slug = slugify(room);
          const isActive = pathname === `/review/${slug}`;
          const budget = session.room_budgets?.[room] ?? 0;
          const total = roomTotals[room] ?? 0;
          const pct = budget > 0 ? Math.min(100, Math.round((total / budget) * 100)) : 0;

          return (
            <Link
              key={room}
              href={`/review/${slug}`}
              className={`flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-blue-50 font-medium text-[#2563EB]"
                  : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className="truncate">{room}</span>
              {budget > 0 && (
                <span
                  className={`ml-2 shrink-0 text-xs tabular-nums ${
                    pct >= 100
                      ? "text-green-600"
                      : pct >= 80
                      ? "text-amber-600"
                      : "text-gray-400"
                  }`}
                >
                  {pct}%
                </span>
              )}
            </Link>
          );
        })}

        {/* Art Collection special entry */}
        <div className="pt-2 pb-1 px-3">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-400">Special</p>
        </div>
        <Link
          href="/review/art"
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
            pathname === "/review/art"
              ? "bg-blue-50 font-medium text-[#2563EB]"
              : "text-gray-700 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          <span>🖼</span> Art Collection
        </Link>
      </nav>

      <div className="border-t border-gray-100 px-4 py-4 space-y-3">
        {/* Plausibility summary */}
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1 text-green-600">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            {plausibility.green} clean
          </span>
          <span className="flex items-center gap-1 text-amber-600">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            {plausibility.yellow}
          </span>
          <span className="flex items-center gap-1 text-red-600">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            {plausibility.red}
          </span>
        </div>

        <a
          href="/api/export-xact"
          className="block w-full rounded-md border border-gray-200 px-3 py-2 text-center text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          Export XactContents →
        </a>
      </div>
    </aside>
  );
}
