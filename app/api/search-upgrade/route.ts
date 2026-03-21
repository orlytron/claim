import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const SERP_KEY = process.env.SERP_API_KEY ?? "";

export interface UpgradeProduct {
  title: string;
  brand: string;
  model: string;
  price: number;
  retailer: string;
  url: string;
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

function extractBrand(title: string, fallback: string): string {
  if (fallback && fallback.length > 0) return fallback;
  return title.split(" ").slice(0, 2).join(" ");
}

async function serpSearch(
  query: string,
  resultIndex = 0   // which result to pick (0=first, 1=second)
): Promise<UpgradeProduct | null> {
  if (!SERP_KEY) {
    console.log("SerpAPI: no API key — skipping");
    return null;
  }
  try {
    const url = new URL("https://serpapi.com/search");
    url.searchParams.set("engine", "google_shopping");
    url.searchParams.set("q", query);
    url.searchParams.set("api_key", SERP_KEY);
    url.searchParams.set("num", "5");

    console.log("SerpAPI searching:", query);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) });
    console.log("SerpAPI response status:", res.status);
    if (!res.ok) { console.log("SerpAPI error body:", await res.text()); return null; }

    const data = await res.json();
    const results: Array<{
      title?: string;
      price?: string | number;
      source?: string;
      link?: string;
      product_link?: string;
    }> = data.shopping_results ?? [];

    console.log("SerpAPI results count:", results.length);
    if (results.length > 0) console.log("SerpAPI first result:", JSON.stringify(results[0]).slice(0, 200));

    if (!results.length) return null;
    const top = results[Math.min(resultIndex, results.length - 1)];
    const price = parsePrice(top.price);
    if (!price) return null;
    return {
      title: top.title ?? query,
      brand: extractBrand(top.title ?? "", top.source ?? ""),
      model: "",
      price,
      retailer: top.source ?? "",
      url: top.link ?? top.product_link ?? "",
      available_since: "2024 or earlier",
      age_years: 0,
      age_months: 0,
      condition: "New",
    };
  } catch (err) {
    console.log("SerpAPI exception:", err);
    return null;
  }
}

async function claudeFallback(
  description: string,
  brand: string,
  currentPrice: number,
  tier: "mid" | "premium"
): Promise<UpgradeProduct> {
  const client = new Anthropic();
  const multiplier = tier === "mid" ? "1.5–2.5x" : "2.5–4x";
  const approxPrice = currentPrice * (tier === "mid" ? 2 : 3);

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Suggest one real ${tier}-tier upgrade product for "${description}" ${
            brand ? `by ${brand}` : ""
          } (currently $${currentPrice}). Target price: ~$${Math.round(
            approxPrice
          )} (${multiplier} original). Must be a real product available before Jan 1 2025. Return JSON only, no markdown: {"title":"","brand":"","model":"","price":0,"retailer":"","url":""}`,
        },
      ],
    });
    const text =
      msg.content[0].type === "text" ? msg.content[0].text.trim() : "{}";
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] ?? "{}";
    const parsed = JSON.parse(jsonStr) as Partial<UpgradeProduct>;
    return {
      title: parsed.title ?? `${brand} ${description} upgrade`,
      brand: parsed.brand ?? brand,
      model: parsed.model ?? "",
      price: parsed.price ?? approxPrice,
      retailer: parsed.retailer ?? "",
      url: parsed.url ?? "",
      available_since: "2024 or earlier",
      age_years: 0,
      age_months: 0,
      condition: "New",
    };
  } catch {
    return {
      title: `${tier === "mid" ? "Mid" : "Premium"} upgrade — ${description}`,
      brand,
      model: "",
      price: approxPrice,
      retailer: "",
      url: "",
      available_since: "2024 or earlier",
      age_years: 0,
      age_months: 0,
      condition: "New",
    };
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

  if (!item_description || !current_price) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const brandPrefix = brand ? `${brand} ` : "";
  const catSuffix = category ? ` ${category}` : "";

  // Build query with 2024 date qualifier — no price range filters (they cause 0 results)
  const baseQuery = `${brandPrefix}${item_description} 2024${catSuffix}`.trim();
  const noBrandQuery = `${item_description} 2024${catSuffix}`.trim();

  // One search call — take result[0] as mid, result[1] as premium
  let serpMid = await serpSearch(baseQuery, 0);
  let serpPremium = await serpSearch(baseQuery, 1);

  // Retry without brand if no results
  if (!serpMid && brand) {
    serpMid = await serpSearch(noBrandQuery, 0);
    serpPremium = await serpSearch(noBrandQuery, 1);
  }

  // Fall back to Claude where SerpAPI returned nothing
  const [mid, premium] = await Promise.all([
    serpMid ?? claudeFallback(item_description, brand, current_price, "mid"),
    serpPremium ?? claudeFallback(item_description, brand, current_price, "premium"),
  ]);

  return NextResponse.json({ mid, premium });
}
