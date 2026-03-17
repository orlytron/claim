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

export default function SuggestionBox() {
  const [open, setOpen] = useState(false);
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

  function handleClose() {
    setOpen(false);
    setStatus("idle");
    setMessage("");
    setRoom("");
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-gray-800 transition-colors"
        aria-label="Send a suggestion"
      >
        <span>💬</span>
        <span className="hidden sm:inline">Suggest a Change</span>
      </button>

      {/* Slide-up panel */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={handleClose}
          />

          {/* Panel */}
          <div className="fixed bottom-0 left-0 right-0 z-50 mx-auto max-w-lg rounded-t-2xl bg-white shadow-2xl sm:bottom-6 sm:right-6 sm:left-auto sm:rounded-2xl sm:w-96">
            <div className="p-5">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                  <span>💬</span> Send a Suggestion
                </h3>
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  ×
                </button>
              </div>

              {status === "success" ? (
                <div className="py-6 text-center">
                  <div className="text-3xl mb-3">✓</div>
                  <p className="font-medium text-gray-900">Got it!</p>
                  <p className="text-sm text-gray-500 mt-1">
                    We&apos;ll review your suggestion and update your claim.
                  </p>
                  <button
                    onClick={handleClose}
                    className="mt-4 text-sm text-[#2563EB] hover:underline"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Room selector */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Room <span className="text-gray-400">(optional)</span>
                    </label>
                    <select
                      value={room}
                      onChange={(e) => setRoom(e.target.value)}
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                    >
                      <option value="">— Select a room —</option>
                      {ROOMS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">
                      Your message
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      rows={5}
                      placeholder="e.g. "I'd like to add a bar cart to the living room" or "The piano should be a Yamaha not Steinway" or anything else you want us to consider…"
                      className="w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                    />
                  </div>

                  {status === "error" && (
                    <p className="text-xs text-red-600">Something went wrong. Please try again.</p>
                  )}

                  <button
                    type="submit"
                    disabled={status === "loading" || !message.trim()}
                    className="w-full rounded-md bg-[#2563EB] px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {status === "loading" ? "Sending…" : "Send Suggestion →"}
                  </button>
                </form>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
