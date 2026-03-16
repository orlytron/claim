"use client";

import React, { useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { parsePdfRoom, ClaimItem } from "./actions/parseClaim";
import { getRoomSummary } from "./actions/getRoomSummary";
import { saveSession, RoomSummary } from "./lib/session";

type Phase = "idle" | "scanning" | "parsing" | "done";
type RoomParseStatus = "pending" | "loading" | "done";

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
  const [error, setError] = useState<string | null>(null);
  const [roomSummary, setRoomSummary] = useState<RoomSummary[] | null>(null);
  const [roomStatuses, setRoomStatuses] = useState<Record<string, RoomParseStatus>>({});
  const [roomItems, setRoomItems] = useState<Record<string, ClaimItem[]>>({});
  const [expandedRooms, setExpandedRooms] = useState<Set<string>>(new Set());
  const [parseProgress, setParseProgress] = useState<{ completed: number; total: number } | null>(null);
  const [targetValue, setTargetValue] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);

  const resetParseState = () => {
    setRoomSummary(null);
    setRoomStatuses({});
    setRoomItems({});
    setExpandedRooms(new Set());
    setParseProgress(null);
  };

  const handleFile = (f: File) => {
    if (f.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    setFile(f);
    setError(null);
    resetParseState();
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

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) handleFile(selected);
  };

  const fileToBase64 = (f: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });

  const toggleRoom = (room: string) => {
    setExpandedRooms((prev) => {
      const next = new Set(prev);
      if (next.has(room)) next.delete(room);
      else next.add(room);
      return next;
    });
  };

  const handleParse = async () => {
    if (!file) return;
    setError(null);
    resetParseState();

    try {
      const base64 = await fileToBase64(file);

      // ── Phase 1: fast room summary ─────────────────────────────────────
      setPhase("scanning");
      const summary = await getRoomSummary(base64);
      setRoomSummary(summary);

      // ── Phase 2: fire all room parses simultaneously ───────────────────
      setPhase("parsing");
      const rooms = summary.map((r) => r.room);
      const total = rooms.length;

      const initialStatuses: Record<string, RoomParseStatus> = {};
      rooms.forEach((r) => (initialStatuses[r] = "pending"));
      setRoomStatuses(initialStatuses);
      setParseProgress({ completed: 0, total });

      const promises = rooms.map(async (roomName) => {
        setRoomStatuses((prev) => ({ ...prev, [roomName]: "loading" }));

        const items = await parsePdfRoom(base64, roomName);

        const seen = new Set<string>();
        const deduped = items.filter((item) => {
          const key = `${item.room}||${item.description}||${item.unit_cost}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        setRoomItems((prev) => ({ ...prev, [roomName]: deduped }));
        setRoomStatuses((prev) => ({ ...prev, [roomName]: "done" }));
        setParseProgress((prev) =>
          prev ? { ...prev, completed: prev.completed + 1 } : { completed: 1, total }
        );

        return deduped;
      });

      const results = await Promise.allSettled(promises);

      const allItems = results
        .filter((r): r is PromiseFulfilledResult<ClaimItem[]> => r.status === "fulfilled")
        .flatMap((r) => r.value);

      const currentTotal = allItems.reduce((sum, item) => sum + item.qty * item.unit_cost, 0);

      await saveSession({
        claim_items: allItems,
        current_total: currentTotal,
        status: "complete",
      });

      setPhase("done");
    } catch (err) {
      resetParseState();
      setError(err instanceof Error ? err.message : "Failed to parse claim. Please try again.");
      setPhase("idle");
    }
  };

  const handleConfirm = async () => {
    const parsed = parseFloat(targetValue.replace(/[^0-9.]/g, ""));
    if (!isNaN(parsed) && parsed > 0) {
      await saveSession({ target_value: parsed });
    }
    router.push("/setup");
  };

  const handleReupload = () => {
    setFile(null);
    resetParseState();
    setError(null);
    setTargetValue("");
    setPhase("idle");
    if (inputRef.current) inputRef.current.value = "";
  };

  const allParsedItems = Object.values(roomItems).flat();
  const runningTotal = allParsedItems.reduce((sum, item) => sum + item.qty * item.unit_cost, 0);
  const isParsingActive = phase === "parsing" || phase === "done";

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-100 px-6 py-4">
        <span className="text-xl font-semibold tracking-tight text-gray-900">ClaimBuilder</span>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">

        {/* ── Upload zone ───────────────────────────────────────────────── */}
        {phase === "idle" && (
          <div className="flex flex-col items-center">
            <h1 className="mb-2 text-2xl font-semibold text-gray-900">
              Upload Your Insurance Claim
            </h1>
            <p className="mb-8 text-sm text-gray-500">
              Upload a PDF claim document to extract and review all line items.
            </p>

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
                    <svg className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="mt-1 text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
                </>
              ) : (
                <>
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-200">
                    <svg className="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-gray-700">Drag &amp; drop your PDF here</p>
                  <p className="mt-1 text-xs text-gray-400">or click to browse files</p>
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

        {/* ── Phase 1: scanning spinner ──────────────────────────────────── */}
        {phase === "scanning" && (
          <div className="flex flex-col items-center py-16">
            <Spinner color="blue" size="lg" />
            <p className="mt-4 text-sm text-gray-600">Scanning your claim...</p>
          </div>
        )}

        {/* ── Phase 2 + Done: accordion results view ─────────────────────── */}
        {isParsingActive && roomSummary && (
          <div>
            {/* Page header */}
            <div className="mb-6 flex items-start justify-between">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Claim Overview</h2>
                <p className="mt-1 text-sm text-gray-500">
                  {phase === "parsing" && parseProgress
                    ? `Parsing rooms… ${parseProgress.completed} of ${parseProgress.total} complete`
                    : `${allParsedItems.length} items extracted from `}
                  {phase === "done" && (
                    <span className="font-medium text-gray-700">{file?.name}</span>
                  )}
                </p>
              </div>
              <button
                onClick={handleReupload}
                className="text-sm text-[#2563EB] hover:underline"
              >
                Re-upload
              </button>
            </div>

            {/* Target value input — interactive immediately after Phase 1 */}
            <div className="mb-6 flex items-center gap-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
              <div className="flex-1">
                <label className="block text-xs font-medium uppercase tracking-wider text-gray-400">
                  Your Target Claim Value
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-sm text-gray-500">$</span>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                    placeholder="Enter target amount"
                    className="w-full bg-transparent text-lg font-semibold text-gray-900 placeholder-gray-300 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  />
                </div>
              </div>
              {runningTotal > 0 && (
                <div className="text-right">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                    Current Value
                  </p>
                  <p className="text-lg font-semibold text-gray-900">{formatCurrency(runningTotal)}</p>
                </div>
              )}
            </div>

            {/* Room accordion cards */}
            <div className="space-y-2">
              {roomSummary.map((r) => {
                const status = roomStatuses[r.room] ?? "pending";
                const items = roomItems[r.room] ?? [];
                const isExpanded = expandedRooms.has(r.room);
                const roomTotal = items.reduce((sum, item) => sum + item.qty * item.unit_cost, 0);

                return (
                  <div
                    key={r.room}
                    className="overflow-hidden rounded-lg border border-gray-200 bg-white"
                  >
                    {/* Room header row */}
                    <button
                      onClick={() => status === "done" && toggleRoom(r.room)}
                      disabled={status !== "done"}
                      className={`flex w-full items-center justify-between px-4 py-3 text-left transition-colors ${
                        status === "done"
                          ? "cursor-pointer hover:bg-gray-50"
                          : "cursor-default"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {status === "pending" && <Spinner color="gray" size="sm" />}
                        {status === "loading" && <Spinner color="blue" size="sm" />}
                        {status === "done" && (
                          <span className="flex h-4 w-4 items-center justify-center rounded-full bg-green-100">
                            <svg className="h-2.5 w-2.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </span>
                        )}
                        <span className="text-sm font-medium text-gray-900">{r.room}</span>
                      </div>

                      <div className="flex items-center gap-4">
                        {status === "pending" && (
                          <span className="text-xs text-gray-400">Pending...</span>
                        )}
                        {status === "loading" && (
                          <span className="text-xs font-medium text-blue-600">Loading...</span>
                        )}
                        {status === "done" && (
                          <>
                            <span className="text-xs text-gray-400">
                              {items.length} item{items.length !== 1 ? "s" : ""}
                            </span>
                            <span className="text-sm font-semibold text-gray-900">
                              {formatCurrency(roomTotal)}
                            </span>
                            <svg
                              className={`h-4 w-4 text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </>
                        )}
                      </div>
                    </button>

                    {/* Expandable items table */}
                    {isExpanded && status === "done" && items.length > 0 && (
                      <div className="border-t border-gray-100">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Description</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Brand</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Condition</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Unit Cost</th>
                              <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((item, idx) => {
                              const lineTotal = item.qty * item.unit_cost;
                              return (
                                <tr
                                  key={`${r.room}-${idx}`}
                                  className="border-t border-gray-50 hover:bg-gray-50"
                                >
                                  <td className="px-4 py-2.5 text-gray-900">{item.description}</td>
                                  <td className="px-4 py-2.5 text-gray-500">{item.brand || "—"}</td>
                                  <td className="px-4 py-2.5 text-right text-gray-900">{item.qty}</td>
                                  <td className="px-4 py-2.5">
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
                                  <td className="px-4 py-2.5 text-right text-gray-900">
                                    {formatCurrency(item.unit_cost)}
                                  </td>
                                  <td className="px-4 py-2.5 text-right font-medium text-gray-900">
                                    {formatCurrency(lineTotal)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {isExpanded && status === "done" && items.length === 0 && (
                      <div className="border-t border-gray-100 px-4 py-3 text-sm text-gray-400">
                        No items found for this room.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer: total + CTA */}
            <div className="mt-6 flex flex-col items-end gap-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-gray-500">
                {Object.keys(roomItems).length} of {roomSummary.length} room
                {roomSummary.length !== 1 ? "s" : ""} parsed · {allParsedItems.length} items
              </p>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs font-medium uppercase tracking-wider text-gray-400">
                    {phase === "parsing" ? "Running Total" : "Current Claim Value"}
                  </p>
                  <p className="text-2xl font-semibold text-gray-900">{formatCurrency(runningTotal)}</p>
                </div>
                <button
                  onClick={handleConfirm}
                  disabled={phase === "parsing"}
                  className={`rounded-md px-6 py-3 text-sm font-medium text-white transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                    phase === "done"
                      ? "bg-green-600 hover:bg-green-700 focus:ring-green-500"
                      : "cursor-not-allowed bg-gray-300"
                  }`}
                >
                  {phase === "parsing" ? "Parsing…" : "Confirm & Continue →"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Error after failed parse */}
        {phase === "idle" && error && (
          <p className="mt-4 text-center text-sm text-red-600">{error}</p>
        )}
      </main>
    </div>
  );
}

function Spinner({ color, size }: { color: "blue" | "gray"; size: "sm" | "lg" }) {
  const colorClass = color === "blue" ? "text-[#2563EB]" : "text-gray-400";
  const sizeClass = size === "lg" ? "h-6 w-6" : "h-3.5 w-3.5";
  return (
    <svg className={`animate-spin ${colorClass} ${sizeClass} shrink-0`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
