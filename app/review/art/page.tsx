"use client";

import { useState } from "react";

export default function ArtCollectionPage() {
  const [uploadClicked, setUploadClicked] = useState(false);

  return (
    <div className="flex flex-col min-h-screen">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white px-6 py-4">
        <p className="text-xs text-gray-400 mb-1">Israel Claim · Claim #7579B726D</p>
        <h1 className="text-xl font-semibold text-gray-900">Art Collection</h1>
      </header>

      <main className="flex-1 px-6 py-8 max-w-2xl">
        {/* Placeholder card */}
        <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-200 text-2xl">
            🖼
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">
            Art collection to be added by advisor
          </h2>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            Upload the art inventory PDF when available. Fine art, photography editions, signed
            prints, and sculptural works will be itemized here separately.
          </p>

          {uploadClicked ? (
            <div className="inline-flex items-center gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              Art inventory upload coming soon. Please contact your advisor.
            </div>
          ) : (
            <button
              onClick={() => setUploadClicked(true)}
              className="inline-flex items-center gap-2 rounded-md border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </svg>
              Upload Art Inventory PDF
            </button>
          )}
        </div>

        {/* Context note */}
        <div className="mt-6 rounded-lg border border-gray-100 bg-white p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">About art claims</h3>
          <p className="text-sm text-gray-500 leading-relaxed">
            Fine art and collectibles require appraisal documentation. Items in this claim include
            photography editions, framed prints, and gallery acquisitions. These will be valued
            separately with supporting provenance and market comparables.
          </p>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[
              { label: "Photography", note: "Editions & prints" },
              { label: "Framed Art", note: "Gallery acquisitions" },
              { label: "Collectibles", note: "Signed pieces" },
            ].map(({ label, note }) => (
              <div key={label} className="rounded-lg bg-gray-50 px-3 py-3">
                <p className="text-sm font-medium text-gray-700">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{note}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
