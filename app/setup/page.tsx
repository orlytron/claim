import Link from "next/link";
import { loadSession } from "../lib/session";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

export default async function SetupPage() {
  const session = await loadSession();
  const items = session?.claim_items ?? null;
  const total = session?.current_total ?? null;
  const roomSummary = session?.room_summary ?? null;

  const roomCount = roomSummary
    ? roomSummary.length
    : items
    ? new Set(items.map((i) => i.room || "Uncategorized")).size
    : 0;

  const claimValue =
    total ??
    (items
      ? items.reduce((sum, item) => sum + item.qty * item.unit_cost, 0)
      : null);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100 px-6 py-4">
        <span className="text-xl font-semibold tracking-tight text-gray-900">
          ClaimBuilder
        </span>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <div className="mb-8">
          <p className="mb-1 text-xs font-medium uppercase tracking-wider text-gray-400">
            Step 2 of 3
          </p>
          <h1 className="text-2xl font-semibold text-gray-900">Claim Setup</h1>
          <p className="mt-1 text-sm text-gray-500">
            Review the summary below before we build your replacement claim.
          </p>
        </div>

        {!items || items.length === 0 ? (
          <div className="rounded-lg border border-red-100 bg-red-50 p-6">
            <p className="text-sm text-red-700">
              No claim data found.{" "}
              <Link href="/" className="font-medium underline">
                Go back and upload a PDF.
              </Link>
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
            <dl className="grid grid-cols-2 gap-6 sm:grid-cols-3">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  Items Parsed
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  {items.length}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  Rooms
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  {roomCount}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wider text-gray-400">
                  Current Claim Value
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-gray-900">
                  {claimValue != null ? formatCurrency(claimValue) : "—"}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <div className="mt-8">
          <Link href="/" className="text-sm text-[#2563EB] hover:underline">
            ← Back
          </Link>
        </div>
      </main>
    </div>
  );
}
