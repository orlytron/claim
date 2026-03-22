/**
 * For high-value claim lines (> $1000), append extra SerpAPI option sets to upgrades_cache.options
 * when fewer than 3 sets exist. Waits 500ms between API calls.
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";
import { minMidFloorUsd, minPremiumFloorUsd } from "../app/lib/upgrade-price-rules";

const SERP_KEY = process.env.SERP_API_KEY ?? "";

interface ClaimRow {
  description: string;
  brand: string;
  unit_cost: number;
  qty: number;
  category?: string;
}

interface UpgradeProductJson {
  title: string;
  brand: string;
  model?: string;
  price: number;
  retailer: string;
  url: string;
  thumbnail?: string;
  available_since?: string;
  age_years?: number;
  age_months?: number;
  condition?: string;
}

type OptionPair = { mid: UpgradeProductJson; premium: UpgradeProductJson | null };

const BAD_RETAILER = /wish\.com|aliexpress|alibaba|dhgate|bonanza|overstock\s*\(used\)/i;

function parsePrice(raw: string | number | undefined): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  return parseFloat(String(raw).replace(/[^0-9.]/g, "")) || 0;
}

function normTitle(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, " ");
}

function isBadRetailer(name: string): boolean {
  return BAD_RETAILER.test(name || "");
}

function toProduct(
  r: {
    title?: string;
    price?: string | number;
    extracted_price?: number;
    source?: string;
    link?: string;
    product_link?: string;
    thumbnail?: string;
  },
  fallback: string
): UpgradeProductJson {
  const price = r.extracted_price ?? parsePrice(r.price);
  return {
    title: r.title ?? fallback,
    brand: "",
    model: "",
    price,
    retailer: r.source ?? "",
    url: r.product_link ?? r.link ?? "",
    thumbnail: r.thumbnail ?? "",
    available_since: "2024 or earlier",
    age_years: 0,
    age_months: 0,
    condition: "New",
  };
}

async function serpList(query: string): Promise<UpgradeProductJson[]> {
  if (!SERP_KEY) return [];
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_shopping");
  url.searchParams.set("q", query);
  url.searchParams.set("api_key", SERP_KEY);
  url.searchParams.set("num", "10");
  url.searchParams.set("gl", "us");
  url.searchParams.set("hl", "en");

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) });
    const data = (await res.json()) as {
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
    if (data.error) {
      console.warn("  SerpAPI:", data.error);
      return [];
    }
    const results = data.shopping_results ?? [];
    return results
      .filter((r) => !isBadRetailer(r.source ?? ""))
      .map((r) => toProduct(r, query));
  } catch (e) {
    console.warn("  fetch error:", e);
    return [];
  }
}

function pickPair(products: UpgradeProductJson[], originalPrice: number): OptionPair | null {
  const midFloor = minMidFloorUsd(originalPrice);
  const premFloor = minPremiumFloorUsd(originalPrice);

  let mid: UpgradeProductJson | null = null;
  for (const p of products) {
    if (p.price > originalPrice && p.price >= midFloor && !isBadRetailer(p.retailer)) {
      mid = p;
      break;
    }
  }
  if (!mid) return null;

  let premium: UpgradeProductJson | null = null;
  for (const p of products) {
    if (
      p.price >= premFloor &&
      Math.abs(p.price - mid.price) > 0.01 &&
      normTitle(p.title) !== normTitle(mid.title) &&
      !isBadRetailer(p.retailer)
    ) {
      premium = p;
      break;
    }
  }
  return { mid, premium };
}

function countOptionSets(row: { options?: unknown; mid?: unknown }): number {
  if (Array.isArray(row.options) && row.options.length > 0) return row.options.length;
  return row.mid ? 1 : 0;
}

function existingTitles(options: unknown[]): Set<string> {
  const s = new Set<string>();
  for (const el of options) {
    if (!el || typeof el !== "object") continue;
    const o = el as { mid?: { title?: string } };
    if (o.mid?.title) s.add(normTitle(o.mid.title));
  }
  return s;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key");
    process.exit(1);
  }
  if (!SERP_KEY) {
    console.error("Missing SERP_API_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: session, error: sessErr } = await supabase
    .from("claim_session")
    .select("claim_items")
    .eq("id", "trial")
    .single();

  if (sessErr || !session?.claim_items) {
    console.error("Could not load claim_session trial:", sessErr?.message);
    process.exit(1);
  }

  const claimItems = session.claim_items as ClaimRow[];
  const highValue = claimItems.filter((i) => i.unit_cost > 1000);

  console.log(`High-value items (>${1000}): ${highValue.length}\n`);

  for (const item of highValue) {
    const desc = item.description.trim();
    const brand = (item.brand || "").trim();
    const orig = item.unit_cost;

    const { data: row, error: cacheErr } = await supabase
      .from("upgrades_cache")
      .select("id, item_description, mid, premium, options")
      .eq("item_description", desc)
      .maybeSingle();

    if (cacheErr) {
      console.warn(`Cache read error for "${desc}":`, cacheErr.message);
      continue;
    }
    if (!row?.id) {
      console.log(`SKIP (no cache row): ${desc}`);
      continue;
    }

    const opts: unknown[] = Array.isArray(row.options) ? [...row.options] : [];
    if (opts.length === 0 && row.mid) {
      opts.push({ mid: row.mid, premium: row.premium });
    }

    const n = opts.length;
    if (n >= 3) {
      console.log(`OK (already ${n}): ${desc}`);
      continue;
    }

    const titles = existingTitles(opts);
    const queries = [
      `${brand ? `${brand} ` : ""}${desc} alternative 2024`.trim(),
      `${desc} luxury upgrade 2024`.trim(),
      `best ${desc} 2024`.trim(),
    ];

    let added = 0;
    for (const q of queries) {
      if (opts.length >= 3) break;
      await sleep(500);
      const products = await serpList(q);
      const pair = pickPair(products, orig);
      if (!pair?.premium || !pair.mid.title) continue;
      if (titles.has(normTitle(pair.mid.title))) continue;
      if (titles.has(normTitle(pair.premium.title))) continue;

      opts.push({ mid: pair.mid, premium: pair.premium });
      titles.add(normTitle(pair.mid.title));
      if (pair.premium) titles.add(normTitle(pair.premium.title));
      added++;
    }

    if (added === 0) {
      console.log(`NO NEW OPTIONS: ${desc}`);
      continue;
    }

    const { error: upErr } = await supabase
      .from("upgrades_cache")
      .update({ options: opts, created_at: new Date().toISOString() })
      .eq("id", row.id);

    if (upErr) {
      console.error(`UPDATE failed ${desc}:`, upErr.message);
    } else {
      console.log(`EXPANDED: ${desc} — now has ${opts.length} options`);
    }
  }

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
