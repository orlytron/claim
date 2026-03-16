"use client";

import React, { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { extractPdfText, parseChunk, ClaimItem } from "./actions/parseClaim";
import { getRoomSummary, RoomSummary } from "./actions/getRoomSummary";
import { saveSession } from "./lib/session";

type GroupedClaims = Record<string, ClaimItem[]>;
type Phase = "idle" | "scanning" | "parsing" | "done";

function groupByRoom(items: ClaimItem[]): GroupedClaims {
  return items.reduce<GroupedClaims>((acc, item) => {
    const room = item.room || "Uncategorized";
    if (!acc[room]) acc[room] = [];
    acc[room].push(item);
    return acc;
  }, {});
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

export default function Home() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [roomSummary, setRoomSummary] = useState<RoomSummary[] | null>(null);
  const [items, setItems] = useState<ClaimItem[] | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (f.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    setFile(f);
    setError(null);
    setItems(null);
    setRoomSummary(null);
    setPhase("idle");
  };

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFile(dropped);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) handleFile(selected);
  };

  const handleParse = async () => {
    if (!file) return;
    setError(null);
    setProgress(null);
    setRoomSummary(null);
    setItems(null);

    try {
      // ── Phase 1: extract text + fast room summary ──────────────────────
      setPhase("scanning");
      const formData = new FormData();
      formData.append("pdf", file);

      const { fullText, chunks } = await extractPdfText(formData);

      // getRoomSummary also calls saveSession({ room_summary, status: 'parsing' })
      const summary = await getRoomSummary(fullText);
      setRoomSummary(summary);

      // ── Phase 2: per-chunk full item parsing ───────────────────────────
      setPhase("parsing");
      const total = chunks.length;
      const allItems: ClaimItem[] = [];

      for (let i = 0; i < chunks.length; i++) {
        setProgress({ current: i + 1, total });
        const chunkItems = await parseChunk(chunks[i]);
        // empty chunks are already returned as [] — just skip
        allItems.push(...chunkItems);
      }

      // Deduplicate by room + description + unit_cost
      const seen = new Set<string>();
      const deduplicated = allItems.filter((item) => {
        const key = `${item.room}||${item.description}||${item.unit_cost}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const currentTotal = deduplicated.reduce(
        (sum, item) => sum + item.qty * item.unit_cost,
        0
      );

      // Persist full results to Supabase
      await saveSession({
        claim_items: deduplicated,
        current_total: currentTotal,
        status: "complete",
      });

      setItems(deduplicated);
      setPhase("done");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to parse claim. Please try again."
      );
      setPhase("idle");
    } finally {
      setProgress(null);
    }
  };

  const handleReupload = () => {
    setFile(null);
    setItems(null);
    setRoomSummary(null);
    setError(null);
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  };

  const grouped = items ? groupByRoom(items) : {};
  const total = items
    ? items.reduce((sum, item) => sum + item.qty * item.unit_cost, 0)
    : 0;

  const isLoading = phase === "scanning" || phase === "parsing";

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4">
        <span className="text-xl font-semibold tracking-tight text-gray-900">
          ClaimBuilder
        </span>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">

        {/* ── Upload zone (idle only) ────────────────────────────────────── */}
        {phase === "idle" && (
          <div className="flex flex-col items-center">
            <h1 className="mb-2 text-2xl font-semibold text-gray-900">
              Upload Your Insurance Claim
            </h1>
            <p className="mb-8 text-sm text-gray-500">
              Upload a PDF claim document to extract and review all line items.
            </p>

            {/* Drop Zone */}
            <div
              className={`flex w-full max-w-lg cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-8 py-12 text-center transition-colors ${
                isDragging
                  ? "border-blue-600 bg-blue-50"
                  : "border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100"
              }`}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onDragLeave={onDragLeave}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf"
                className="hidden"
                onChange={onInputChange}
              />

              {file ? (
                <>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                    <svg
                      className="h-6 w-6 text-blue-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="mt-1 text-xs text-gray-400">
                    {(file.size / 1024).toFixed(1)} KB · Click to change
                  </p>
                </>
              ) : (
                <>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-200">
                    <svg
                      className="h-6 w-6 text-gray-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-700">
                    Drag &amp; drop your PDF here
                  </p>
                  <p className="mt-1 text-xs text-gray-400">
                    or click to browse files
                  </p>
                </>
              )}
            </div>

            {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

            {file && (
              <button
                onClick={handleParse}
                className="mt-6 rounded-md bg-[#2563EB] px-6 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Parse Claim
              </button>
            )}
          </div>
        )}

        {/* ── Phase 1: scanning spinner ─────────────────────────────────── */}
        {phase === "scanning" && (
          <div className="flex flex-col items-center py-16">
            <Spinner />
            <p className="mt-4 text-sm text-gray-600">Scanning your claim...</p>
          </div>
        )}

        {/* ── Phase 2: room summary preview + progress bar ──────────────── */}
        {phase === "parsing" && roomSummary && (
          <div>
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Claim Overview</h2>
              <p className="mt-1 text-sm text-gray-500">
                Extracting all line items — this may take a moment.
              </p>
            </div>

            {/* Room summary cards */}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {roomSummary.map((r) => (
                <div
                  key={r.room}
                  className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3"
                >
                  <p className="truncate text-xs font-medium uppercase tracking-wider text-gray-400">
                    {r.room}
                  </p>
                  <p className="mt-1 text-lg font-semibold text-gray-900">
                    {formatCurrency(r.subtotal)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {r.item_count} item{r.item_count !== 1 ? "s" : ""}
                  </p>
                </div>
              ))}
            </div>

            {/* Progress */}
            {progress && (
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <Spinner />
                  {`Analyzing chunk ${progress.current} of ${progress.total}...`}
                </div>
                <div className="w-full overflow-hidden rounded-full bg-gray-200">
                  <div
                    className="h-1.5 rounded-full bg-[#2563EB]"
                    style={{
                      width: `${Math.round((progress.current / progress.total) * 100)}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Done: full results table ──────────────────────────────────── */}
        {phase === "done" && items && items.length > 0 && (
          <div>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Claim Summary</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {items.length} line item{items.length !== 1 ? "s" : ""} extracted from{" "}
                  <span className="font-medium text-gray-700">{file?.name}</span>
                </p>
              </div>
              <button
                onClick={handleReupload}
                className="text-sm text-[#2563EB] hover:underline"
              >
                Re-upload
              </button>
            </div>

            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Room</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Description</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Brand</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Qty</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Condition</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Unit Cost</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(grouped).map(([room, roomItems]) => (
                    <React.Fragment key={room}>
                      <tr className="bg-gray-50">
                        <td
                          colSpan={7}
                          className="border-t border-gray-200 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-gray-500"
                        >
                          {room}
                        </td>
                      </tr>
                      {roomItems.map((item, idx) => {
                        const lineTotal = item.qty * item.unit_cost;
                        return (
                          <tr
                            key={`${room}-${idx}`}
                            className="border-t border-gray-100 hover:bg-gray-50"
                          >
                            <td className="px-4 py-3 text-gray-400">—</td>
                            <td className="px-4 py-3 text-gray-900">{item.description}</td>
                            <td className="px-4 py-3 text-gray-600">{item.brand || "—"}</td>
                            <td className="px-4 py-3 text-right text-gray-900">{item.qty}</td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                                  item.condition === "Good" || item.condition === "Excellent"
                                    ? "bg-green-50 text-green-700"
                                    : item.condition === "Poor"
                                    ? "bg-red-50 text-red-700"
                                    : "bg-gray-100 text-gray-600"
                                }`}
                              >
                                {item.condition || "Average"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-gray-900">
                              {formatCurrency(item.unit_cost)}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-gray-900">
                              {formatCurrency(lineTotal)}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Total & Actions */}
            <div className="mt-6 flex flex-col items-end gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500">
                {Object.keys(grouped).length} room
                {Object.keys(grouped).length !== 1 ? "s" : ""} · {items.length} items
              </p>
              <div className="flex flex-col items-end gap-3 sm:flex-row sm:items-center sm:gap-6">
                <div className="text-right">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                    Current Claim Value
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">
                    {formatCurrency(total)}
                  </p>
                </div>
                <button
                  onClick={() => router.push("/setup")}
                  className="rounded-md bg-green-600 px-6 py-3 text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  Confirm &amp; Continue →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Empty result after done */}
        {phase === "done" && items && items.length === 0 && (
          <div className="flex flex-col items-center py-16">
            <p className="text-gray-500">
              No line items could be extracted from this document.
            </p>
            <button
              onClick={handleReupload}
              className="mt-4 text-sm text-[#2563EB] hover:underline"
            >
              Try another file
            </button>
          </div>
        )}

        {/* Error after failed parse */}
        {phase === "idle" && !file && error && (
          <p className="mt-4 text-center text-sm text-red-600">{error}</p>
        )}
      </main>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-[#2563EB]" fill="none" viewBox="0 0 24 24">
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
