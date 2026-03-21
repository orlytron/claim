"use client";

import { useState } from "react";
import { supabase } from "../lib/supabase";

const ROOMS = [
  "Living Room",
  "Kitchen",
  "David Office / Guest Room",
  "Bedroom Orly",
  "Bedroom Rafe",
  "Patio",
  "Garage",
  "Bathroom Master",
  "Bathroom White",
  "Art Collection",
];

/** Admin-only client suggestion form (no floating launcher). */
export default function ClientSuggestionForm() {
  const [room, setRoom] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setStatus("loading");

    const { error } = await supabase.from("client_suggestions").insert({
      room: room || null,
      message: message.trim(),
      status: "pending",
    });

    if (error) {
      setStatus("error");
    } else {
      setStatus("success");
      setMessage("");
      setRoom("");
    }
  }

  if (status === "success") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50/80 p-6 text-center">
        <div className="mb-2 text-2xl">✓</div>
        <p className="font-medium text-gray-900">Suggestion recorded</p>
        <p className="mt-1 text-sm text-gray-600">It will appear in Client Feedback below.</p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-4 text-sm font-semibold text-[#2563EB] hover:underline"
        >
          Submit another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-700">
          Room <span className="text-gray-400">(optional)</span>
        </label>
        <select
          value={room}
          onChange={(e) => setRoom(e.target.value)}
          className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">— Select a room —</option>
          {ROOMS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-medium text-gray-700">Message</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={4}
          placeholder="e.g. Add a bar cart, adjust piano brand…"
          className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      {status === "error" && <p className="text-xs text-red-600">Something went wrong. Try again.</p>}
      <button
        type="submit"
        disabled={status === "loading" || !message.trim()}
        className="w-full rounded-md bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {status === "loading" ? "Sending…" : "Send suggestion →"}
      </button>
    </form>
  );
}
