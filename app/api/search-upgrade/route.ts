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
  // Take the first 1-2 words of the title as brand if no fallback
  if (fallback && fallback.length > 0) return fallback;
  return title.split(" ").slice(0, 2).join(" ");
}

async function serpSearch(
  query: string,
  minPrice: number,
  maxPrice: number
): Promise<UpgradeProduct | null> {
  if (!SERP_KEY) return null;
  try {
    const params = new URLSearchParams({
      engine: "google_shopping",
      q: query,
      api_key: SERP_KEY,
      num: "5",
      tbs: `mr:1,price:1,ppr_min:${Math.round(minPrice)},ppr_max:${Math.round(maxPrice)}`,
    });
    const res = await fetch(`https://serpapi.com/search.json?${params}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const results: Array<{
      title?: string;
      price?: string | number;
      source?: string;
      link?: string;
      product_link?: string;
    }> = data.shopping_results ?? [];
    if (!results.length) return null;
    const top = results[0];
    const price = parsePrice(top.price);
    if (!price) return null;
    return {
      title: top.title ?? query,
      brand: extractBrand(top.title ?? "", top.source ?? ""),
      model: "",
      price,
      retailer: top.source ?? "",
      url: top.link ?? top.product_link ?? "",
      age_years: 0,
      age_months: 0,
      condition: "New",
    };
  } catch {
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

  const brandStr = brand ? `${brand} ` : "";
  const midQuery = `${brandStr}${item_description} upgrade ${category ?? ""}`.trim();
  const premQuery = `${brandStr}${item_description} premium ${category ?? ""}`.trim();

  const midMin = current_price * 1.5;
  const midMax = current_price * 2.5;
  const premMin = current_price * 2.5;
  const premMax = current_price * 4;

  // Run both SerpAPI searches in parallel
  const [serpMid, serpPremium] = await Promise.all([
    serpSearch(midQuery, midMin, midMax),
    serpSearch(premQuery, premMin, premMax),
  ]);

  // Fall back to Claude where SerpAPI returned nothing
  const [mid, premium] = await Promise.all([
    serpMid ?? claudeFallback(item_description, brand, current_price, "mid"),
    serpPremium ?? claudeFallback(item_description, brand, current_price, "premium"),
  ]);

  return NextResponse.json({ mid, premium });
}
