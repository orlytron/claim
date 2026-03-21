import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabase-admin";

const SERP_KEY = process.env.SERP_API_KEY ?? "";

export interface UpgradeProduct {
  title: string;
  brand: string;
  model: string;
  price: number;
  retailer: string;
  url: string;
  thumbnail: string;
  available_since: string;
  age_years: 0;
  age_months: 0;
  condition: "New";
}

function parsePrice(raw: string | number | undefined): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  return parseFloat(String(raw).replace(/[^0-9.]/g, "")) || 0;
}

function fillFallbacks(
  p: Partial<UpgradeProduct>,
  fallbackTitle: string
): UpgradeProduct {
  const title = (p.title?.trim()) || fallbackTitle;
  const retailer = (p.retailer?.trim()) || "Search online";
  const url =
    (p.url?.trim()) ||
    `https://www.google.com/search?q=${encodeURIComponent(title)}&tbm=shop`;
  return {
    title,
    brand: p.brand ?? "",
    model: p.model ?? "",
    price: p.price ?? 0,
    retailer,
    url,
    thumbnail: p.thumbnail ?? "",
    available_since: "2024 or earlier",
    age_years: 0,
    age_months: 0,
    condition: "New",
  };
}

/** No external LLM — deterministic fallbacks when SerpAPI misses */
function localFallbackBoth(
  description: string,
  brand: string,
  currentPrice: number
): { mid: UpgradeProduct; premium: UpgradeProduct } {
  const midPrice = Math.round(currentPrice * 2);
  const premPrice = Math.round(currentPrice * 3.2);
  return {
    mid: fillFallbacks(
      { title: `Mid upgrade — ${description}`, price: midPrice },
      `Upgraded ${brand ? brand + " " : ""}${description}`
    ),
    premium: fillFallbacks(
      { title: `Premium upgrade — ${description}`, price: premPrice },
      `Premium ${brand ? brand + " " : ""}${description}`
    ),
  };
}

async function serpSearchBoth(
  query: string
): Promise<[UpgradeProduct | null, UpgradeProduct | null]> {
  console.log("SERP API KEY exists:", !!SERP_KEY);
  if (!SERP_KEY) {
    console.log("SerpAPI: no API key — skipping");
    return [null, null];
  }

  try {
    const url = new URL("https://serpapi.com/search");
    url.searchParams.set("engine", "google_shopping");
    url.searchParams.set("q", query);
    url.searchParams.set("api_key", SERP_KEY);
    url.searchParams.set("num", "5");

    console.log("Search query:", query);

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();

    const results: Array<{
      title?: string;
      price?: string | number;
      extracted_price?: number;
      source?: string;
      link?: string;
      product_link?: string;
      thumbnail?: string;
    }> = (data.shopping_results?.length ? data.shopping_results : data.organic_results) ?? [];

    if (!results.length) return [null, null];

    const toProduct = (r: (typeof results)[0]): UpgradeProduct => {
      const price = r.extracted_price ?? parsePrice(r.price);
      return {
        title: r.title ?? query,
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
    };

    const mid = toProduct(results[0]);
    const premium = results.length > 1 ? toProduct(results[1]) : null;
    return [mid, premium];
  } catch (err) {
    console.log("SerpAPI exception:", err);
    return [null, null];
  }
}

export async function POST(req: NextRequest) {
  const { item_description, brand, current_price, category } =
    (await req.json()) as {
      item_description: string;
      brand: string;
      current_price: number;
      category: string;
    };

  const cleanDesc = (item_description ?? "").trim();
  console.log("Upgrade API called for:", cleanDesc, "price:", current_price);

  if (!cleanDesc || !current_price) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // ── Cache (service role) — case-insensitive exact, then fuzzy first word ───
  console.log("Cache lookup:", cleanDesc);
  let cached: { mid: unknown; premium: unknown } | null = null;
  try {
    const { data: exactRow, error: cacheErr } = await supabaseAdmin
      .from("upgrades_cache")
      .select("mid, premium")
      .ilike("item_description", cleanDesc)
      .maybeSingle();

    if (cacheErr) console.log("Cache read error:", cacheErr.message);
    cached = exactRow;

    console.log("Cache hit:", !!cached);

    if (cached?.mid) {
      console.log("Mid:", (cached.mid as UpgradeProduct)?.title, "$" + (cached.mid as UpgradeProduct)?.price);
      return NextResponse.json({ mid: cached.mid, premium: cached.premium, source: "cache" });
    }

    const firstWord = cleanDesc.split(/\s+/).filter(Boolean)[0] ?? "";
    if (firstWord.length >= 4) {
      const safe = firstWord.replace(/[%_]/g, "");
      const { data: fuzzy } = await supabaseAdmin
        .from("upgrades_cache")
        .select("mid, premium")
        .ilike("item_description", `%${safe}%`)
        .maybeSingle();

      if (fuzzy?.mid) {
        return NextResponse.json({
          ...fuzzy,
          source: "cache-fuzzy",
        });
      }
    }
  } catch (e) {
    console.log("Cache lookup exception (non-fatal):", e);
  }

  const brandPrefix = brand ? `${brand} ` : "";
  const catSuffix = category ? ` ${category}` : "";
  const baseQuery = `${brandPrefix}${cleanDesc} 2024${catSuffix}`.trim();
  const noBrandQuery = `${cleanDesc} 2024${catSuffix}`.trim();

  let [serpMid, serpPremium] = await serpSearchBoth(baseQuery);
  if (!serpMid && brand) {
    [serpMid, serpPremium] = await serpSearchBoth(noBrandQuery);
  }

  const fb = localFallbackBoth(cleanDesc, brand, current_price);
  const mid: UpgradeProduct = serpMid
    ? fillFallbacks(serpMid, serpMid.title || cleanDesc)
    : fb.mid;
  const premium: UpgradeProduct = serpPremium
    ? fillFallbacks(serpPremium, serpPremium.title || cleanDesc)
    : fb.premium;

  try {
    await supabaseAdmin.from("upgrades_cache").insert({
      item_description: cleanDesc,
      brand: brand ?? "",
      search_query: baseQuery,
      mid,
      premium,
    });
    console.log("Cache STORED:", cleanDesc);
  } catch (e) {
    console.log("Cache store error (non-fatal):", e);
  }

  return NextResponse.json({ mid, premium });
}
