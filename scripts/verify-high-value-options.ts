/**
 * Verify upgrades_cache options over $3,000 via SerpAPI.
 * $1,000–$3,000: mark estimated: true (no Serp). Under $1k: leave unchanged.
 * Env: .env.local — SERP_API_KEY, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or anon.
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";

/** Max SerpAPI calls per run (safety budget). Log shows [Call N/50]. */
const SERP_MAX_CALLS = 50;
const SERP_DELAY_MS = 600;

interface ClaimItem {
  description: string;
  unit_cost: number;
}

/** Flat option + verification flags (no DB migration — stored in JSON). */
interface CacheOption {
  title?: string;
  brand?: string;
  price?: number;
  retailer?: string;
  url?: string;
  available_since?: string;
  verified?: boolean;
  estimated?: boolean;
  verified_at?: string;
  thumbnail?: string;
}

interface CacheRow {
  id: string;
  item_description: string;
  options: unknown;
  mid: unknown;
  premium: unknown;
}

function normDesc(s: string): string {
  return s.trim().toLowerCase();
}

function buildOriginalPriceMap(claimItems: ClaimItem[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of claimItems) {
    const k = normDesc(it.description);
    if (!m.has(k)) m.set(k, it.unit_cost);
  }
  return m;
}

function resolveOriginalPrice(
  description: string,
  claimMap: Map<string, number>,
  existingMid: unknown
): number {
  const k = normDesc(description);
  if (claimMap.has(k)) return claimMap.get(k)!;
  for (const [dk, v] of claimMap) {
    if (k.includes(dk) || dk.includes(k)) return v;
  }
  const mid = existingMid as { price?: number } | null;
  if (mid && typeof mid.price === "number" && mid.price > 0) {
    return Math.max(25, Math.round(mid.price / 1.75));
  }
  return 100;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function parsePrice(raw: string | number | undefined): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  return parseFloat(String(raw).replace(/[^0-9.]/g, "")) || 0;
}

/** Flatten legacy { mid, premium } entries into a list of option-like objects. */
function normalizeOptionsArray(raw: unknown): CacheOption[] {
  if (!Array.isArray(raw)) return [];
  const out: CacheOption[] = [];
  for (const el of raw) {
    if (!el || typeof el !== "object") continue;
    const o = el as Record<string, unknown>;
    if ("mid" in o && o.mid && typeof o.mid === "object") {
      out.push({ ...(o.mid as CacheOption) });
      if (o.premium && typeof o.premium === "object") {
        out.push({ ...(o.premium as CacheOption) });
      }
    } else {
      out.push({ ...o } as CacheOption);
    }
  }
  return out;
}

async function verifyProduct(
  option: CacheOption,
  originalPrice: number,
  serpKey: string
): Promise<CacheOption> {
  const title = (option.title ?? "").trim();
  const expected = Number(option.price);
  if (!title || !Number.isFinite(expected) || expected <= 0) {
    return { ...option, verified: false };
  }

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", title);
  url.searchParams.set("api_key", serpKey);
  url.searchParams.set("num", "5");
  url.searchParams.set("gl", "us");
  url.searchParams.set("hl", "en");

  let data: {
    shopping_results?: Array<{
      title?: string;
      extracted_price?: number;
      price?: string | number;
      source?: string;
      product_link?: string;
      link?: string;
      thumbnail?: string;
    }>;
    error?: string;
  };

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    data = await res.json();
  } catch {
    return { ...option, verified: false };
  }

  if (data.error) {
    console.warn("  SerpAPI error:", data.error);
    return { ...option, verified: false };
  }

  const results = data.shopping_results ?? [];
  const match = results.find((r) => {
    const ep = r.extracted_price ?? parsePrice(r.price);
    if (!ep || ep <= originalPrice) return false;
    const priceDiff = Math.abs(ep - expected) / expected;
    return priceDiff < 0.25;
  });

  if (match) {
    const realPrice = match.extracted_price ?? parsePrice(match.price);
    const retailer = match.source ?? option.retailer ?? "";
    const link = match.product_link ?? match.link ?? option.url ?? "";
    return {
      ...option,
      price: realPrice,
      retailer,
      url: link,
      thumbnail: match.thumbnail ?? (option.thumbnail as string) ?? "",
      verified: true,
      verified_at: new Date().toISOString(),
      estimated: false,
    };
  }

  return { ...option, verified: false };
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serpKey = process.env.SERP_API_KEY ?? "";

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key");
    process.exit(1);
  }
  if (!serpKey) {
    console.error("Missing SERP_API_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: session } = await supabase.from("claim_session").select("claim_items").eq("id", "trial").maybeSingle();
  const claimItems = (session?.claim_items as ClaimItem[] | null) ?? [];
  const claimMap = buildOriginalPriceMap(claimItems);

  const { data: cacheRows, error: listErr } = await supabase
    .from("upgrades_cache")
    .select("id, item_description, options, mid, premium");

  if (listErr) {
    console.error("Failed to load upgrades_cache:", listErr.message);
    process.exit(1);
  }

  if (!cacheRows?.length) {
    console.log("No rows in upgrades_cache.");
    return;
  }

  let verifiedSerpCount = 0;
  let notFoundCount = 0;
  let estimatedCount = 0;
  let serpCallsUsed = 0;
  let itemsUpdated = 0;
  let safetyLimitReached = false;

  for (const row of cacheRows as CacheRow[]) {
    if (safetyLimitReached) break;

    const description = (row.item_description ?? "").trim();
    const originalPrice = resolveOriginalPrice(description, claimMap, row.mid);
    let options = normalizeOptionsArray(row.options);

    if (options.length === 0) continue;

    let rowChanged = false;

    for (let i = 0; i < options.length; i++) {
      if (safetyLimitReached) break;

      let opt = options[i]!;
      if (opt.verified === true) continue;
      if (opt.estimated === true) continue;

      const price = Number(opt.price);
      if (!Number.isFinite(price)) continue;

      if (price > 3000 && !opt.verified) {
        if (serpCallsUsed >= SERP_MAX_CALLS) {
          console.log("\nSAFETY LIMIT REACHED — run again to continue\n");
          safetyLimitReached = true;
          break;
        }

        serpCallsUsed++;
        const titlePreview = (opt.title ?? "").slice(0, 72);
        console.log(`[Call ${serpCallsUsed}/${SERP_MAX_CALLS}] Verifying: ${titlePreview}...`);

        const beforePrice = price;
        const updated = await verifyProduct(opt, originalPrice, serpKey);
        options[i] = updated;
        rowChanged = true;

        await sleep(SERP_DELAY_MS);

        if (updated.verified === true) {
          verifiedSerpCount++;
          console.log(
            `VERIFIED: ${updated.title} $${beforePrice} → $${updated.price} @ ${updated.retailer}`
          );
        } else {
          notFoundCount++;
          console.log(`NOT FOUND: ${opt.title} — keeping Claude price`);
        }
      } else if (price >= 1000 && price <= 3000) {
        options[i] = { ...opt, estimated: true };
        rowChanged = true;
        estimatedCount++;
        console.log(`ESTIMATED: ${opt.title} $${price}`);
      }
    }

    if (!rowChanged) continue;

    const mid = options[0];
    const premium = options[options.length - 1];

    const { error: upErr } = await supabase
      .from("upgrades_cache")
      .update({
        options,
        mid,
        premium,
        created_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (upErr) {
      console.error(`UPDATE failed (${description}):`, upErr.message);
    } else {
      itemsUpdated++;
    }
  }

  console.log("\n──────── Summary ────────");
  console.log(`Verified with SerpAPI: ${verifiedSerpCount}`);
  console.log(`Not found (kept Claude): ${notFoundCount}`);
  console.log(`Marked as estimated: ${estimatedCount}`);
  console.log(`SerpAPI calls used: ${serpCallsUsed}`);
  console.log(`Items updated: ${itemsUpdated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
