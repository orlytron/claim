import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ClaimItem {
  description: string;
  brand: string;
  unit_cost: number;
  qty: number;
  category: string;
}

interface UpgradeProduct {
  title: string;
  brand: string;
  price: number;
  retailer: string;
  url: string;
  thumbnail: string;
  available_since: string;
}

// ── Config ────────────────────────────────────────────────────────────────────

const SERP_KEY = process.env.SERP_API_KEY ?? "";

// Noise words — skip items whose description contains any of these
const SKIP_WORDS = [
  "dental", "toothpaste", "soap", "floss", "tack", "sharpie", "wax",
  "cord", "battery", "batteries", "thumbtack", "tissue", "curtain",
  "mat", "towel", "squatty", "bidet", "extension", "paintbrush",
  "paint", "toothbrush", "dental floss",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function shouldSkip(item: ClaimItem): boolean {
  if (item.unit_cost < 100) return true;
  const lower = item.description.toLowerCase();
  for (const word of SKIP_WORDS) {
    if (lower.includes(word)) {
      // Allow "bidet" above $300 etc — but keep simple for now
      if (word === "bidet" && item.unit_cost >= 300) continue;
      return true;
    }
  }
  return false;
}

function extractBrandFromTitle(title: string): string {
  // Take first 1-2 words as brand hint — good enough for display
  const words = title.trim().split(/\s+/);
  return words.slice(0, Math.min(2, words.length)).join(" ");
}

// ── SerpAPI search ────────────────────────────────────────────────────────────

async function searchUpgrades(
  description: string,
  brand: string,
  currentPrice: number
): Promise<{ mid: UpgradeProduct; premium: UpgradeProduct | null } | null> {
  if (!SERP_KEY) {
    console.error("❌  SERP_API_KEY not set in .env.local");
    return null;
  }

  const query = brand
    ? `${brand} ${description} 2024`
    : `${description} 2024`;

  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", SERP_KEY);
  url.searchParams.set("num", "5");
  url.searchParams.set("gl", "us");
  url.searchParams.set("hl", "en");

  let response: Response;
  let data: {
    shopping_results?: Array<{
      title?: string;
      extracted_price?: number;
      price?: string;
      source?: string;
      product_link?: string;
      link?: string;
      thumbnail?: string;
    }>;
    error?: string;
  };

  try {
    response = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) });
    data = await response.json();
  } catch (err) {
    console.error(`  Network error for "${description}":`, err);
    return null;
  }

  if (data.error) {
    console.error(`  SerpAPI error for "${description}":`, data.error);
    return null;
  }

  const results = data.shopping_results ?? [];
  if (results.length === 0) return null;

  const toProduct = (r: typeof results[0]): UpgradeProduct => ({
    title: r.title ?? description,
    brand: extractBrandFromTitle(r.title ?? ""),
    price: r.extracted_price ?? (parseFloat(String(r.price ?? "0").replace(/[^0-9.]/g, "")) || 0),
    retailer: r.source ?? "",
    url: r.product_link ?? r.link ?? "",
    thumbnail: r.thumbnail ?? "",
    available_since: "2024 or earlier",
  });

  // Filter: upgrades must cost at least 20% more than current
  const eligibleResults = results.filter(
    (r) => (r.extracted_price ?? 0) > currentPrice * 1.2
  );

  // If no eligible results, use first result as-is
  if (eligibleResults.length === 0) {
    const mid = toProduct(results[0]);
    const premium = results.length > 1 ? toProduct(results[1]) : null;
    return { mid, premium };
  }

  // mid = first result between 1.2x and 3x current price
  const midResult = eligibleResults.find(
    (r) => (r.extracted_price ?? 0) <= currentPrice * 3
  ) ?? eligibleResults[0];
  const mid = toProduct(midResult);

  // premium = first result above 2x, different from mid
  const premiumResult = eligibleResults.find(
    (r) =>
      (r.extracted_price ?? 0) > currentPrice * 2 &&
      r.title !== midResult.title
  ) ?? (eligibleResults.length > 1 ? eligibleResults[1] : null);
  const premium = premiumResult ? toProduct(premiumResult) : null;

  return { mid, premium };
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(1);
  }
  if (!SERP_KEY) {
    console.error("❌  Missing SERP_API_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // ── Check / hint about upgrades_cache table ─────────────────────────────
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  seed-upgrades — Israel Claim
  Make sure this table exists in Supabase before running:

  CREATE TABLE IF NOT EXISTS upgrades_cache (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    item_description text NOT NULL,
    brand text NOT NULL DEFAULT '',
    search_query text NOT NULL DEFAULT '',
    mid jsonb NOT NULL,
    premium jsonb,
    created_at timestamptz DEFAULT now()
  );
  CREATE UNIQUE INDEX IF NOT EXISTS upgrades_cache_desc_idx
    ON upgrades_cache (item_description);
  ALTER TABLE upgrades_cache ENABLE ROW LEVEL SECURITY;
  CREATE POLICY "Public read" ON upgrades_cache FOR SELECT USING (true);
  CREATE POLICY "Public insert" ON upgrades_cache FOR INSERT WITH CHECK (true);
  CREATE POLICY "Public update" ON upgrades_cache FOR UPDATE USING (true);
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

  // ── Load claim items ─────────────────────────────────────────────────────
  const { data: session, error: sessErr } = await supabase
    .from("claim_session")
    .select("claim_items")
    .eq("id", "trial")
    .single();

  if (sessErr || !session?.claim_items) {
    console.error("❌  Could not load claim_items:", sessErr?.message);
    process.exit(1);
  }

  const allItems: ClaimItem[] = session.claim_items;

  // Filter and sort
  const items = allItems
    .filter((i) => !shouldSkip(i))
    .sort((a, b) => b.unit_cost - a.unit_cost);

  console.log(`\nTotal items: ${allItems.length}`);
  console.log(`Items to search: ${items.length} (after filtering)\n`);

  let searched = 0;
  let cached = 0;
  let skipped = 0;
  let noResults = 0;

  for (const item of items) {
    // Check if already cached
    const { data: existing } = await supabase
      .from("upgrades_cache")
      .select("id")
      .eq("item_description", item.description)
      .maybeSingle();

    if (existing) {
      console.log(`  SKIP (cached): ${item.description}`);
      skipped++;
      continue;
    }

    console.log(`  Searching: ${item.description} ($${item.unit_cost}) by "${item.brand}"...`);
    searched++;

    const query = item.brand
      ? `${item.brand} ${item.description} 2024`
      : `${item.description} 2024`;

    const result = await searchUpgrades(item.description, item.brand, item.unit_cost);

    if (!result) {
      console.log(`    ↳ NO RESULTS`);
      noResults++;
    } else {
      const { error: insertErr } = await supabase.from("upgrades_cache").insert({
        item_description: item.description,
        brand: item.brand,
        search_query: query,
        mid: result.mid,
        premium: result.premium ?? null,
      });

      if (insertErr) {
        console.error(`    ↳ Insert failed: ${insertErr.message}`);
      } else {
        console.log(
          `    ↳ CACHED: mid $${result.mid.price} @ ${result.mid.retailer}` +
            (result.premium ? ` | premium $${result.premium.price} @ ${result.premium.retailer}` : " | no premium")
        );
        cached++;
      }
    }

    // Rate limit: 500ms between calls
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Done.
  Searched:    ${searched}
  Cached:      ${cached}
  Skipped:     ${skipped} (already cached)
  No results:  ${noResults}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Check your SerpAPI usage at: https://serpapi.com/dashboard
`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
