"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { loadSession } from "../../lib/session";
import type { ClaimItem } from "../../lib/types";
import { cleanDescription } from "../../lib/clean-description";
import { displayAgeYears } from "../../lib/original-claim-data";
import {
  flattenUpgradesCacheRow,
  pickSimilarAndUpgrade,
} from "../../lib/pick-replacement-options";
import { formatCurrency } from "../../lib/utils";
import { useClaimMode } from "../../lib/useClaimMode";
import { supabase } from "../../lib/supabase";

type ReplacementRow = {
  id: string;
  item_description: string;
  room: string;
  claimed_price: number;
  replacement_price: number;
  brand: string | null;
  model: string | null;
  retailer_url: string | null;
  source: string;
  created_at: string;
};

type CacheRow = {
  item_description: string;
  mid: unknown;
  premium: unknown;
  options: unknown;
};

type ReplacementOptionDto = {
  name: string;
  brand: string;
  price: number;
  url: string;
  tier: "similar" | "upgrade";
};

function lineKey(item: ClaimItem): string {
  return `${item.description.trim().toLowerCase()}|${item.room}|${item.unit_cost}|${(item.brand || "").trim().toLowerCase()}`;
}

function rowMatchesItem(row: ReplacementRow, item: ClaimItem): boolean {
  return (
    row.item_description.trim().toLowerCase() === item.description.trim().toLowerCase() &&
    row.room === item.room &&
    Number(row.claimed_price) === item.unit_cost &&
    (row.brand || "").trim().toLowerCase() === (item.brand || "").trim().toLowerCase()
  );
}

function findReplacementRowForItem(rows: ReplacementRow[], item: ClaimItem): ReplacementRow | null {
  for (const row of rows) {
    if (rowMatchesItem(row, item)) return row;
  }
  return null;
}

function normDesc(s: string): string {
  return s.trim().toLowerCase();
}

function findCacheRowForItem(item: ClaimItem, cacheRows: CacheRow[]): CacheRow | null {
  const d = normDesc(item.description);
  const exact = cacheRows.find((r) => normDesc(r.item_description) === d);
  if (exact) return exact;
  const words = item.description
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 2);
  for (const w of words) {
    const hit = cacheRows.find((r) => normDesc(r.item_description).includes(w.toLowerCase()));
    if (hit) return hit;
  }
  return null;
}

function isPriced(
  item: ClaimItem,
  replacementRows: ReplacementRow[],
  cacheRows: CacheRow[]
): boolean {
  if (findReplacementRowForItem(replacementRows, item)) return true;
  const cr = findCacheRowForItem(item, cacheRows);
  if (!cr) return false;
  const flat = flattenUpgradesCacheRow(cr);
  const { similar } = pickSimilarAndUpgrade(flat, item.unit_cost > 0 ? item.unit_cost : 0.01);
  return similar != null && similar.price > 0;
}

function pricedDisplay(
  item: ClaimItem,
  replacementRows: ReplacementRow[],
  cacheRows: CacheRow[]
): { replacementPrice: number; retailerUrl: string | null; fromDb: boolean } {
  const row = findReplacementRowForItem(replacementRows, item);
  if (row) {
    return {
      replacementPrice: Number(row.replacement_price),
      retailerUrl: row.retailer_url,
      fromDb: true,
    };
  }
  const cr = findCacheRowForItem(item, cacheRows);
  if (!cr) {
    return { replacementPrice: item.unit_cost, retailerUrl: null, fromDb: false };
  }
  const flat = flattenUpgradesCacheRow(cr);
  const { similar } = pickSimilarAndUpgrade(flat, item.unit_cost > 0 ? item.unit_cost : 0.01);
  if (similar && similar.price > 0) {
    return { replacementPrice: similar.price, retailerUrl: similar.url, fromDb: false };
  }
  return { replacementPrice: item.unit_cost, retailerUrl: null, fromDb: false };
}

function escapeCsvCell(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export default function RebuildPlanningPage() {
  const { sessionId, hydrated } = useClaimMode();
  const [items, setItems] = useState<ClaimItem[]>([]);
  const [replacementRows, setReplacementRows] = useState<ReplacementRow[]>([]);
  const [cacheRows, setCacheRows] = useState<CacheRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [roomTab, setRoomTab] = useState<string>("__all__");
  const [priceFilter, setPriceFilter] = useState<0 | 500 | 1000 | 2500>(0);
  const [openFindKey, setOpenFindKey] = useState<string | null>(null);
  const [findLoadingKey, setFindLoadingKey] = useState<string | null>(null);
  const [findResultByKey, setFindResultByKey] = useState<
    Record<
      string,
      {
        similar: ReplacementOptionDto | null;
        upgrade: ReplacementOptionDto | null;
        claimedPrice: number;
      }
    >
  >({});
  const [pricedExpanded, setPricedExpanded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const loadAll = useCallback(async (opts?: { silent?: boolean }) => {
    if (!hydrated) return;
    if (!opts?.silent) setLoading(true);
    try {
      const sess = await loadSession(sessionId);
      const list = (sess?.claim_items ?? []) as ClaimItem[];
      setItems(list);

      const { data: rp } = await supabase
        .from("replacement_prices")
        .select("*")
        .order("created_at", { ascending: false });
      setReplacementRows((rp ?? []) as ReplacementRow[]);

      const { data: cache } = await supabase
        .from("upgrades_cache")
        .select("item_description, mid, premium, options");
      setCacheRows((cache ?? []) as CacheRow[]);
    } catch {
      setToast("Could not load data");
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }, [hydrated, sessionId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const rooms = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) {
      if (i.room) set.add(i.room);
    }
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    let list = items;
    if (roomTab !== "__all__") {
      list = list.filter((i) => i.room === roomTab);
    }
    if (priceFilter > 0) {
      list = list.filter((i) => i.unit_cost >= priceFilter);
    }
    return list;
  }, [items, roomTab, priceFilter]);

  const pricedCount = useMemo(() => {
    return filteredItems.filter((i) => isPriced(i, replacementRows, cacheRows)).length;
  }, [filteredItems, replacementRows, cacheRows]);

  const progressPct =
    filteredItems.length > 0 ? Math.round((pricedCount / filteredItems.length) * 100) : 0;

  const needsPrice = useMemo(() => {
    return filteredItems
      .filter((i) => !isPriced(i, replacementRows, cacheRows))
      .sort((a, b) => b.unit_cost - a.unit_cost);
  }, [filteredItems, replacementRows, cacheRows]);

  const pricedList = useMemo(() => {
    return filteredItems.filter((i) => isPriced(i, replacementRows, cacheRows));
  }, [filteredItems, replacementRows, cacheRows]);

  async function handleFindPrice(item: ClaimItem) {
    const lk = lineKey(item);
    setFindLoadingKey(lk);
    try {
      const res = await fetch("/api/find-replacement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: item.description,
          brand: item.brand || "",
          unit_cost: item.unit_cost,
          room: item.room,
        }),
      });
      const data = (await res.json()) as {
        similar?: ReplacementOptionDto | null;
        upgrade?: ReplacementOptionDto | null;
        claimedPrice?: number;
        error?: string;
      };
      if (!res.ok) {
        setToast(data.error ?? "Search failed");
        return;
      }
      setFindResultByKey((prev) => ({
        ...prev,
        [lk]: {
          similar: data.similar ?? null,
          upgrade: data.upgrade ?? null,
          claimedPrice: data.claimedPrice ?? item.unit_cost,
        },
      }));
      void loadAll({ silent: true });
    } catch {
      setToast("Search failed");
    } finally {
      setFindLoadingKey(null);
    }
  }

  async function saveReplacement(
    item: ClaimItem,
    opt: ReplacementOptionDto | null,
    source: "similar" | "upgrade" | "manual",
    replacementPrice: number,
    retailerUrl: string | null
  ) {
    const res = await fetch("/api/replacement-prices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        item_description: item.description,
        room: item.room,
        claimed_price: item.unit_cost,
        replacement_price: replacementPrice,
        brand: opt?.brand ?? item.brand ?? "",
        model: opt?.name ?? "",
        retailer_url: retailerUrl ?? opt?.url ?? null,
        source,
      }),
    });
    if (!res.ok) {
      const j = (await res.json()) as { error?: string };
      setToast(j.error ?? "Save failed");
      return;
    }
    setOpenFindKey(null);
    setFindResultByKey((prev) => {
      const next = { ...prev };
      delete next[lineKey(item)];
      return next;
    });
    await loadAll({ silent: true });
    setToast("Saved");
  }

  function downloadCsv() {
    const rows: string[][] = [["Room", "Item", "Brand", "Claimed Price", "Replacement Price", "Retailer Link"]];
    for (const item of filteredItems) {
      if (!isPriced(item, replacementRows, cacheRows)) continue;
      const d = pricedDisplay(item, replacementRows, cacheRows);
      rows.push([
        item.room,
        item.description,
        item.brand || "",
        String(item.unit_cost),
        String(d.replacementPrice),
        d.retailerUrl || "",
      ]);
    }
    const body = rows.map((r) => r.map(escapeCsvCell).join(",")).join("\n");
    const blob = new Blob([body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rebuild-shopping-list-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(t);
  }, [toast]);

  if (!hydrated || loading) {
    return (
      <div className="min-h-screen bg-white px-4 py-10">
        <p className="text-center text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="mx-auto w-full max-w-[900px] px-4 py-8 md:px-6">
        <div className="mb-6 text-sm text-[#6B7280]">
          <Link href="/review" className="font-medium text-[#2563EB] hover:underline">
            ← Home
          </Link>
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">Rebuild planning</h1>
        <p className="mt-2 text-sm text-gray-600 md:text-base">
          Find today&apos;s replacement prices for your items. Download as a shopping list when done.
        </p>

        <div className="mt-6 -mx-1 overflow-x-auto pb-2">
          <div className="flex min-w-max gap-2 px-1">
            <button
              type="button"
              onClick={() => setRoomTab("__all__")}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                roomTab === "__all__"
                  ? "bg-[#2563EB] text-white"
                  : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
              }`}
            >
              All rooms
            </button>
            {rooms.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoomTab(r)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                  roomTab === r ? "bg-[#2563EB] text-white" : "border border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(
            [
              { v: 0 as const, label: "Any" },
              { v: 500 as const, label: "$500+" },
              { v: 1000 as const, label: "$1,000+" },
              { v: 2500 as const, label: "$2,500+" },
            ] as const
          ).map(({ v, label }) => (
            <button
              key={v}
              type="button"
              onClick={() => setPriceFilter(v)}
              className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${
                priceFilter === v
                  ? "border-[#2563EB] bg-blue-50 text-[#2563EB]"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium text-gray-700">
              {pricedCount} of {filteredItems.length} priced
            </span>
            <span className="tabular-nums text-gray-500">{progressPct}%</span>
          </div>
          <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-gray-200">
            <div
              className="h-full rounded-full bg-[#2563EB] transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>

        <section className="mt-10">
          <h2 className="text-xs font-bold uppercase tracking-wider text-gray-400">Needs replacement price</h2>
          <div className="mt-3 space-y-3">
            {needsPrice.length === 0 ? (
              <p className="rounded-xl border border-gray-100 bg-white px-4 py-6 text-center text-sm text-gray-500">
                No items in this view still need a price.
              </p>
            ) : (
              needsPrice.map((item) => {
                const lk = lineKey(item);
                const open = openFindKey === lk;
                const finding = findLoadingKey === lk;
                const result = findResultByKey[lk];
                return (
                  <div key={lk} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-gray-900">{cleanDescription(item.description)}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {item.brand?.trim() || "Unbranded"} ·{" "}
                          {displayAgeYears(item) > 0 ? `${displayAgeYears(item)} yr` : "New"} ·{" "}
                          {item.condition || "—"}
                        </p>
                        <p className="mt-0.5 text-xs text-gray-400">{item.room}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums text-gray-900">
                          {formatCurrency(item.unit_cost)}
                        </p>
                        <p className="text-xs text-gray-400">claimed</p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={finding}
                        onClick={() => {
                          setOpenFindKey(lk);
                          void handleFindPrice(item);
                        }}
                        className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-40"
                      >
                        {finding ? "Searching…" : open ? "Search again →" : "Find price →"}
                      </button>
                      {open ? (
                        <button
                          type="button"
                          onClick={() => {
                            setOpenFindKey(null);
                            setFindResultByKey((prev) => {
                              const n = { ...prev };
                              delete n[lk];
                              return n;
                            });
                          }}
                          className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
                        >
                          Close
                        </button>
                      ) : null}
                    </div>

                    {open ? (
                      <div className="mt-4 border-t border-gray-100 pt-4">
                        {finding ? (
                          <div className="flex items-center gap-2 py-6 text-sm text-gray-500">
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-400 border-t-transparent" />
                            Searching retailers…
                          </div>
                        ) : result ? (
                          <>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div
                            className={`rounded-xl border bg-white p-4 ${
                              result.similar ? "border-gray-200" : "border-dashed border-gray-200 opacity-60"
                            }`}
                          >
                            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Similar</p>
                            {result.similar ? (
                              <>
                                <p className="mt-2 text-sm font-semibold text-gray-900">{result.similar.name}</p>
                                <p className="text-xs text-gray-500">{result.similar.brand || "—"}</p>
                                <p className="mt-2 text-lg font-bold tabular-nums text-gray-900">
                                  {formatCurrency(result.similar.price)}
                                </p>
                                {result.similar.url ? (
                                  <a
                                    href={result.similar.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-block text-xs font-medium text-[#2563EB] hover:underline"
                                  >
                                    View retailer →
                                  </a>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() =>
                                    void saveReplacement(item, result.similar!, "similar", result.similar!.price, result.similar!.url)
                                  }
                                  className="mt-3 w-full rounded-lg bg-[#2563EB] py-2 text-sm font-bold text-white hover:bg-blue-700"
                                >
                                  Use this price
                                </button>
                              </>
                            ) : (
                              <p className="mt-2 text-sm text-gray-500">No match in range.</p>
                            )}
                          </div>
                          <div
                            className={`rounded-xl border bg-white p-4 ${
                              result.upgrade ? "border-blue-500" : "border-dashed border-gray-200 opacity-60"
                            }`}
                          >
                            <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Upgrade</p>
                            {result.upgrade ? (
                              <>
                                <p className="mt-2 text-sm font-semibold text-gray-900">{result.upgrade.name}</p>
                                <p className="text-xs text-gray-500">{result.upgrade.brand || "—"}</p>
                                <p className="mt-2 text-lg font-bold tabular-nums text-gray-900">
                                  {formatCurrency(result.upgrade.price)}
                                </p>
                                {result.upgrade.url ? (
                                  <a
                                    href={result.upgrade.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-2 inline-block text-xs font-medium text-[#2563EB] hover:underline"
                                  >
                                    View retailer →
                                  </a>
                                ) : null}
                                <button
                                  type="button"
                                  onClick={() =>
                                    void saveReplacement(item, result.upgrade!, "upgrade", result.upgrade!.price, result.upgrade!.url)
                                  }
                                  className="mt-3 w-full rounded-lg bg-[#2563EB] py-2 text-sm font-bold text-white hover:bg-blue-700"
                                >
                                  Use this price
                                </button>
                              </>
                            ) : (
                              <p className="mt-2 text-sm text-gray-500">No upgrade in range.</p>
                            )}
                          </div>
                        </div>
                            <button
                              type="button"
                              onClick={() =>
                                void saveReplacement(item, null, "manual", item.unit_cost, null)
                              }
                              className="mt-4 w-full rounded-lg border border-gray-200 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                            >
                              Keep original price ({formatCurrency(item.unit_cost)})
                            </button>
                          </>
                        ) : (
                          <p className="py-4 text-sm text-gray-500">No results yet. Try again.</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </section>

        <section className="mt-12">
          <button
            type="button"
            onClick={() => setPricedExpanded((e) => !e)}
            className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left hover:bg-gray-100"
          >
            <span className="text-sm font-bold text-gray-800">
              Replacement price set{" "}
              <span className="font-normal text-gray-500">({pricedList.length})</span>
            </span>
            <span className="text-gray-400">{pricedExpanded ? "▲" : "▼"}</span>
          </button>
          {pricedExpanded ? (
            <div className="mt-2 space-y-2">
              {pricedList.map((item) => {
                const d = pricedDisplay(item, replacementRows, cacheRows);
                const row = findReplacementRowForItem(replacementRows, item);
                return (
                  <div
                    key={lineKey(item)}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-gray-100 bg-white px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{cleanDescription(item.description)}</p>
                      <p className="text-xs text-gray-500">
                        {item.brand?.trim() || "Unbranded"} ·{" "}
                        {displayAgeYears(item) > 0 ? `${displayAgeYears(item)} yr` : "New"} · {item.condition || "—"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-right">
                      <span className="text-sm tabular-nums text-gray-400 line-through">
                        {formatCurrency(item.unit_cost)}
                      </span>
                      <span className="text-sm font-bold tabular-nums text-green-600">
                        {formatCurrency(d.replacementPrice)}
                      </span>
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-bold text-green-700">
                        ✓ priced
                      </span>
                      {!d.fromDb && row == null ? (
                        <span className="text-[10px] uppercase text-gray-400">cache</span>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>

        <div className="mt-10">
          <button
            type="button"
            onClick={() => downloadCsv()}
            disabled={pricedCount === 0}
            className="w-full rounded-xl bg-[#16A34A] py-3 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-40"
          >
            Download shopping list ({pricedCount} items priced) →
          </button>
        </div>
      </div>

      {toast ? (
        <div className="fixed bottom-24 left-1/2 z-40 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2 text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
