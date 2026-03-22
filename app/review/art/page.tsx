"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { dispatchUpgradeReward } from "../../components/UpgradeRewardToast";
import { mergeClaimIncoming } from "../../lib/claim-item-merge";
import type { ClaimItem } from "../../lib/types";
import { loadSession, saveSession } from "../../lib/session";
import { formatCurrency } from "../../lib/utils";
import { useClaimMode } from "../../lib/useClaimMode";

const ART_ROOM = "Art Collection";
const RESERVED = 300_000;

export type ParsedArtItem = {
  description: string;
  artist: string;
  medium: string;
  size: string;
  unit_cost: number;
};

export default function ArtCollectionPage() {
  const { sessionId, hydrated } = useClaimMode();
  const [isAdmin, setIsAdmin] = useState(false);
  const [claimItems, setClaimItems] = useState<ClaimItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedArtItem[]>([]);
  const [checked, setChecked] = useState<boolean[]>([]);
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setIsAdmin(window.localStorage.getItem("isAdmin") === "true");
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 1500);
    return () => clearTimeout(t);
  }, [toast]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const s = await loadSession(sessionId);
      setClaimItems((s?.claim_items ?? []) as ClaimItem[]);
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!hydrated) return;
    void refresh();
  }, [hydrated, refresh]);

  const artOnClaim = useMemo(
    () => claimItems.filter((i) => i.room === ART_ROOM || i.category === "Art"),
    [claimItems]
  );
  const artTotal = useMemo(
    () => artOnClaim.reduce((s, i) => s + i.qty * i.unit_cost, 0),
    [artOnClaim]
  );

  const sortedPreview = useMemo(
    () => [...artOnClaim].sort((a, b) => b.unit_cost - a.unit_cost),
    [artOnClaim]
  );

  async function onUploadPdf(file: File) {
    if (file.type !== "application/pdf") {
      setParseError("Please choose a PDF file.");
      return;
    }
    setParseError(null);
    setParseLoading(true);
    setParsed([]);
    setChecked([]);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("read failed"));
        r.readAsDataURL(file);
      });
      const base64Data = dataUrl.includes(",") ? dataUrl.split(",")[1]! : dataUrl;
      const res = await fetch("/api/parse-art-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base64Data }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || res.statusText);
      const rows = body as ParsedArtItem[];
      if (!Array.isArray(rows)) throw new Error("Invalid response");
      setParsed(rows);
      setChecked(rows.map(() => true));
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setParseLoading(false);
    }
  }

  async function addParsedToClaim() {
    const rows = parsed.filter((_, i) => checked[i]);
    if (rows.length === 0) return;
    setAdding(true);
    setParseError(null);
    try {
      const session = await loadSession(sessionId);
      const current = (session?.claim_items ?? []) as ClaimItem[];
      const incoming: ClaimItem[] = rows.map((row) => ({
        room: ART_ROOM,
        description: row.description,
        brand: row.artist,
        model: [row.medium, row.size].filter(Boolean).join(" · "),
        qty: 1,
        age_years: 0,
        age_months: 0,
        condition: "Listed",
        unit_cost: row.unit_cost,
        category: "Art",
        source: "art",
      }));
      const before = current.reduce((s, i) => s + i.qty * i.unit_cost, 0);
      const merged = mergeClaimIncoming(current, incoming, "art");
      const after = merged.reduce((s, i) => s + i.qty * i.unit_cost, 0);
      const goal = session?.target_value ?? 1_600_000;
      await saveSession({ claim_items: merged }, sessionId);
      setClaimItems(merged);
      dispatchUpgradeReward({
        delta: after - before,
        claimTotal: after,
        goalPctBefore: goal > 0 ? Math.min(100, Math.round((before / goal) * 100)) : 0,
        goalPctAfter: goal > 0 ? Math.min(100, Math.round((after / goal) * 100)) : 0,
        label: `✓ Added ${formatCurrency(after - before)} to Art Collection`,
      });
      setToast(`Added ${rows.length} art line(s)`);
      setParsed([]);
      setChecked([]);
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Could not save");
    } finally {
      setAdding(false);
    }
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-gray-500">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50 pb-24">
      <header className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-4 md:px-8">
        <Link href="/review" className="text-sm font-medium text-[#2563EB] hover:underline">
          ← Dashboard
        </Link>
        <p className="mt-2 text-xs text-gray-400">Israel Claim · #7579B726D</p>
        <h1 className="text-xl font-bold text-gray-900">Art collection</h1>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 space-y-8 px-4 py-8 md:px-8">
        <section className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 p-6 text-center shadow-sm">
          <p className="text-lg font-bold text-gray-900">Art collection — {formatCurrency(RESERVED)} reserved</p>
          <p className="mt-2 text-sm text-gray-600">
            Your art advisor will provide the final list. Claim lines you add here export as room &quot;Art
            Collection&quot;, category &quot;Art&quot;, sorted by value.
          </p>
          <p className="mt-4 text-base font-semibold tabular-nums text-gray-900">
            Current on claim: {loading ? "…" : formatCurrency(artTotal)}
          </p>
        </section>

        {isAdmin ? (
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">Admin · PDF import</h2>
            <label className="mt-4 inline-flex min-h-[48px] cursor-pointer items-center justify-center rounded-xl border-2 border-[#2563EB] bg-blue-50 px-6 text-sm font-bold text-[#2563EB] hover:bg-blue-100">
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="sr-only"
                disabled={parseLoading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void onUploadPdf(f);
                }}
              />
              {parseLoading ? "Parsing PDF…" : "Upload Art PDF"}
            </label>
            {parseError ? <p className="mt-3 text-sm text-red-600">{parseError}</p> : null}

            {parsed.length > 0 ? (
              <div className="mt-6 overflow-x-auto rounded-xl border border-gray-100">
                <table className="w-full min-w-[520px] text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-500">
                    <tr>
                      <th className="w-10 px-2 py-2" />
                      <th className="px-2 py-2">Description</th>
                      <th className="px-2 py-2">Artist</th>
                      <th className="px-2 py-2">Medium</th>
                      <th className="px-2 py-2">Dimensions</th>
                      <th className="px-2 py-2 text-right">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {parsed.map((row, i) => (
                      <tr key={i}>
                        <td className="px-2 py-2">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[#2563EB]"
                            checked={!!checked[i]}
                            onChange={() =>
                              setChecked((c) => {
                                const n = [...c];
                                n[i] = !n[i];
                                return n;
                              })
                            }
                          />
                        </td>
                        <td className="px-2 py-2 text-gray-900">{row.description}</td>
                        <td className="px-2 py-2 text-gray-700">{row.artist || "—"}</td>
                        <td className="px-2 py-2 text-gray-700">{row.medium || "—"}</td>
                        <td className="px-2 py-2 text-gray-700">{row.size || "—"}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{formatCurrency(row.unit_cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {parsed.length > 0 ? (
              <button
                type="button"
                disabled={adding || !checked.some(Boolean)}
                onClick={() => void addParsedToClaim()}
                className="mt-4 min-h-[48px] w-full rounded-xl bg-[#2563EB] text-base font-bold text-white hover:bg-blue-700 disabled:opacity-50 sm:w-auto sm:px-8"
              >
                {adding ? "Adding…" : "Add to claim"}
              </button>
            ) : null}
          </section>
        ) : null}

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-400">On your claim</h2>
          {loading ? (
            <p className="mt-4 text-sm text-gray-500">Loading…</p>
          ) : sortedPreview.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No art lines yet.</p>
          ) : (
            <ul className="mt-4 divide-y divide-gray-100">
              {sortedPreview.map((it, idx) => (
                <li key={`${it.description}-${idx}`} className="flex flex-col gap-1 py-3 sm:flex-row sm:justify-between">
                  <span className="min-w-0 text-gray-900">{it.description}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-gray-900">
                    {formatCurrency(it.qty * it.unit_cost)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {toast ? (
        <div className="fixed left-1/2 top-4 z-50 max-w-sm -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-3 text-center text-sm text-white shadow-lg">
          {toast}
        </div>
      ) : null}
    </div>
  );
}
