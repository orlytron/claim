import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabase } from "../../lib/supabase";

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

/** Guarantee all display fields have a usable value */
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

/** Single SerpAPI call → returns [mid, premium] results */
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
    console.log("Full SERP URL:", url.toString().replace(SERP_KEY, "***"));

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(10000),
    });
    const data = await response.json();

    console.log("SERP response status:", response.status);
    console.log("SERP data keys:", Object.keys(data));

    // Try shopping_results first, then organic_results
    const results: Array<{
      title?: string;
      price?: string | number;
      extracted_price?: number;
      source?: string;
      link?: string;
      product_link?: string;
      thumbnail?: string;
    }> = (data.shopping_results?.length ? data.shopping_results : data.organic_results) ?? [];

    console.log("shopping_results count:", data.shopping_results?.length ?? 0);
    console.log("First result:", JSON.stringify(data.shopping_results?.[0]).slice(0, 300));

    if (!results.length) return [null, null];

    const toProduct = (r: typeof results[0]): UpgradeProduct => {
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

/** Single Claude call → returns both mid AND premium in one shot */
async function claudeFallbackBoth(
  description: string,
  brand: string,
  currentPrice: number
): Promise<{ mid: UpgradeProduct; premium: UpgradeProduct }> {
  const client = new Anthropic();
  const midPrice = Math.round(currentPrice * 2);
  const premPrice = Math.round(currentPrice * 3.2);
  const fallbackMid = fillFallbacks(
    { title: `Mid upgrade — ${description}`, price: midPrice },
    `Upgraded ${description}`
  );
  const fallbackPremium = fillFallbacks(
    { title: `Premium upgrade — ${description}`, price: premPrice },
    `Premium ${description}`
  );

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `Suggest 2 real product upgrades for: "${description}"${brand ? ` by ${brand}` : ""} currently at $${currentPrice}.
Return ONLY valid JSON, no markdown, no explanation:
{
  "mid": { "title": "exact product name", "brand": "brand", "price": 000, "retailer": "retailer name", "url": "https://..." },
  "premium": { "title": "exact product name", "brand": "brand", "price": 000, "retailer": "retailer name", "url": "https://..." }
}
Rules: real products available before Jan 1 2025. Mid price ~$${midPrice}, premium ~$${premPrice}.`,
        },
      ],
    });

    const text =
      msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] ?? "{}";
    const parsed = JSON.parse(jsonStr) as {
      mid?: Partial<UpgradeProduct>;
      premium?: Partial<UpgradeProduct>;
    };

    return {
      mid: fillFallbacks(
        { ...parsed.mid, available_since: "2024 or earlier" },
        `Upgraded ${brand ? brand + " " : ""}${description}`
      ),
      premium: fillFallbacks(
        { ...parsed.premium, available_since: "2024 or earlier" },
        `Premium ${brand ? brand + " " : ""}${description}`
      ),
    };
  } catch (err) {
    console.log("Claude fallback error:", err);
    return { mid: fallbackMid, premium: fallbackPremium };
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

  console.log("Upgrade API called for:", item_description, "price:", current_price);

  if (!item_description || !current_price) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // ── Cache check ────────────────────────────────────────────────────────────
  console.log("Cache lookup for:", item_description);
  try {
    const { data: cached, error: cacheErr } = await supabase
      .from("upgrades_cache")
      .select("mid, premium")
      .eq("item_description", item_description)
      .maybeSingle();

    if (cacheErr) console.log("Cache read error:", cacheErr.message);

    if (cached?.mid) {
      console.log("Cache HIT:", item_description);
      return NextResponse.json({ mid: cached.mid, premium: cached.premium, source: "cache" });
    }
    console.log("Cache MISS:", item_description);
  } catch (e) {
    console.log("Cache lookup exception (non-fatal):", e);
  }

  const brandPrefix = brand ? `${brand} ` : "";
  const catSuffix = category ? ` ${category}` : "";
  const baseQuery = `${brandPrefix}${item_description} 2024${catSuffix}`.trim();
  const noBrandQuery = `${item_description} 2024${catSuffix}`.trim();

  // ONE SerpAPI call → [mid, premium]
  let [serpMid, serpPremium] = await serpSearchBoth(baseQuery);

  // Retry without brand if neither result came back
  if (!serpMid && brand) {
    [serpMid, serpPremium] = await serpSearchBoth(noBrandQuery);
  }

  let mid: UpgradeProduct;
  let premium: UpgradeProduct;

  if (serpMid || serpPremium) {
    // At least one SerpAPI result — fill any missing with Claude or fallback
    const midFallback = serpMid
      ? null
      : claudeFallbackBoth(item_description, brand, current_price).then((r) => r.mid);
    const premFallback = serpPremium
      ? null
      : claudeFallbackBoth(item_description, brand, current_price).then((r) => r.premium);

    const [mf, pf] = await Promise.all([midFallback, premFallback]);
    mid = fillFallbacks(serpMid ?? mf ?? {}, `Upgraded ${item_description}`);
    premium = fillFallbacks(serpPremium ?? pf ?? {}, `Premium ${item_description}`);
  } else {
    // No SerpAPI results at all — single Claude call for both
    const both = await claudeFallbackBoth(item_description, brand, current_price);
    mid = both.mid;
    premium = both.premium;
  }

  // ── Store in cache for next time ──────────────────────────────────────────
  try {
    await supabase.from("upgrades_cache").insert({
      item_description,
      brand: brand ?? "",
      search_query: baseQuery,
      mid,
      premium,
    });
    console.log("Cache STORED:", item_description);
  } catch (e) {
    console.log("Cache store error (non-fatal):", e);
  }

  return NextResponse.json({ mid, premium });
}
