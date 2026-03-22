import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { supabaseAdmin } from "../../lib/supabase-admin";
import {
  getMinUpgradeMultiplier,
  minMidFloorUsd,
  minPremiumFloorUsd,
} from "../../lib/upgrade-price-rules";

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

export type UpgradeOptionSet = { mid: UpgradeProduct; premium: UpgradeProduct | null };

function parsePrice(raw: string | number | undefined): number {
  if (typeof raw === "number") return raw;
  if (!raw) return 0;
  return parseFloat(String(raw).replace(/[^0-9.]/g, "")) || 0;
}

function fillFallbacks(p: Partial<UpgradeProduct>, fallbackTitle: string): UpgradeProduct {
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
    available_since: p.available_since ?? "2024 or earlier",
    age_years: 0,
    age_months: 0,
    condition: "New",
  };
}

function localFallbackBoth(
  description: string,
  brand: string,
  currentPrice: number
): UpgradeOptionSet {
  const midFloor = minMidFloorUsd(currentPrice);
  const premFloor = minPremiumFloorUsd(currentPrice);
  const midPrice = Math.max(Math.round(currentPrice * 2), Math.ceil(midFloor));
  const premPrice = Math.max(Math.round(currentPrice * 2.8), Math.ceil(premFloor), midPrice + 1);
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

function isValidMid(price: number, currentPrice: number): boolean {
  if (price <= currentPrice) return false;
  return price >= minMidFloorUsd(currentPrice);
}

function isValidPremium(premPrice: number, midPrice: number, currentPrice: number): boolean {
  if (premPrice <= currentPrice) return false;
  if (premPrice < minPremiumFloorUsd(currentPrice)) return false;
  return Math.abs(premPrice - midPrice) > 0.01;
}

/** Valid mid; premium optional, or omitted when same price as mid (single-tier). */
function isCompleteOptionSet(set: UpgradeOptionSet | null, currentPrice: number): boolean {
  if (!set?.mid || !set.mid.title) return false;
  if (!isValidMid(set.mid.price, currentPrice)) return false;
  if (!set.premium) return true;
  if (Math.abs(set.premium.price - set.mid.price) <= 0.01) return true;
  return isValidPremium(set.premium.price, set.mid.price, currentPrice);
}

const BRAND_STOP = new Set(["the", "a", "an", "new", "with", "for", "and", "or"]);

function guessBrandFromTitle(title: string): string {
  const parts = title.trim().split(/\s+/).filter(Boolean);
  const first = parts[0] || "";
  if (first.length >= 2 && !BRAND_STOP.has(first.toLowerCase())) return first;
  return "";
}

function enrichProduct(p: UpgradeProduct, claimBrand: string): UpgradeProduct {
  const title = (p.title || "").trim();
  let b = (p.brand || "").trim();
  if (!b) b = (claimBrand || "").trim() || guessBrandFromTitle(title);
  if (!b) b = "Brand — see product title";
  let retailer = (p.retailer || "").trim();
  if (!retailer) retailer = "Online retailer";
  return { ...p, title, brand: b, retailer };
}

function enrichSet(set: UpgradeOptionSet, claimBrand: string): UpgradeOptionSet {
  let { mid, premium } = set;
  mid = enrichProduct(mid, claimBrand);
  if (premium) {
    if (Math.abs(premium.price - mid.price) <= 0.01) {
      premium = null;
    } else {
      premium = enrichProduct(premium, claimBrand);
    }
  }
  return { mid, premium };
}

function normalizeOptionSet(raw: unknown, cleanDesc: string): UpgradeOptionSet | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as { mid?: Partial<UpgradeProduct>; premium?: Partial<UpgradeProduct> | null };
  if (!o.mid || typeof o.mid !== "object") return null;
  const mid = fillFallbacks(o.mid, o.mid.title || cleanDesc);
  const premium =
    o.premium && typeof o.premium === "object" && (o.premium.price ?? 0) > 0
      ? fillFallbacks(o.premium, o.premium.title || cleanDesc)
      : null;
  return { mid, premium };
}

function optionSetsFromRow(
  row: { mid: unknown; premium: unknown; options?: unknown },
  cleanDesc: string,
  currentPrice: number,
  claimBrand: string
): UpgradeOptionSet[] {
  const opts = row.options;
  const out: UpgradeOptionSet[] = [];
  if (Array.isArray(opts) && opts.length > 0) {
    for (const el of opts) {
      let s = normalizeOptionSet(el, cleanDesc);
      if (!s) continue;
      if (s.premium && Math.abs(s.premium.price - s.mid.price) <= 0.01) {
        s = { mid: s.mid, premium: null };
      }
      if (s.premium && !isValidPremium(s.premium.price, s.mid.price, currentPrice)) {
        s = { mid: s.mid, premium: null };
      }
      if (isCompleteOptionSet(s, currentPrice)) out.push(enrichSet(s, claimBrand));
    }
    if (out.length) return out;
  }
  let single = normalizeOptionSet({ mid: row.mid, premium: row.premium }, cleanDesc);
  if (!single) return [];
  if (single.premium && Math.abs(single.premium.price - single.mid.price) <= 0.01) {
    single = { mid: single.mid, premium: null };
  }
  if (single.premium && !isValidPremium(single.premium.price, single.mid.price, currentPrice)) {
    single = { mid: single.mid, premium: null };
  }
  if (isCompleteOptionSet(single, currentPrice)) return [enrichSet(single, claimBrand)];
  return [];
}

function pickMidPremiumFromProducts(
  products: UpgradeProduct[],
  currentPrice: number
): { mid: UpgradeProduct | null; premium: UpgradeProduct | null } {
  const midFloor = minMidFloorUsd(currentPrice);
  const premFloor = minPremiumFloorUsd(currentPrice);

  let mid: UpgradeProduct | null = null;
  for (const p of products) {
    const pr = p.price ?? 0;
    if (pr > currentPrice && pr >= midFloor) {
      mid = p;
      break;
    }
  }

  let premium: UpgradeProduct | null = null;
  if (mid) {
    for (const p of products) {
      const pr = p.price ?? 0;
      if (pr >= premFloor && Math.abs(pr - mid.price) > 0.01 && p.title !== mid.title) {
        premium = p;
        break;
      }
    }
  }

  return { mid, premium };
}

async function serpSearchList(query: string, num = 10): Promise<UpgradeProduct[]> {
  if (!SERP_KEY) return [];

  try {
    const url = new URL("https://serpapi.com/search");
    url.searchParams.set("engine", "google_shopping");
    url.searchParams.set("q", query);
    url.searchParams.set("api_key", SERP_KEY);
    url.searchParams.set("num", String(num));

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

    return results.map((r) => {
      const price = r.extracted_price ?? parsePrice(r.price);
      return fillFallbacks(
        {
          title: r.title ?? query,
          price,
          retailer: r.source ?? "",
          url: r.product_link ?? r.link ?? "",
          thumbnail: r.thumbnail ?? "",
        },
        r.title ?? query
      );
    });
  } catch {
    return [];
  }
}

async function claudeUpgradeSuggestions(
  description: string,
  brand: string,
  current_price: number,
  minMidPrice: number,
  minPremiumPrice: number
): Promise<UpgradeOptionSet | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const multMid = getMinUpgradeMultiplier(current_price, "mid");
  const multPrem = getMinUpgradeMultiplier(current_price, "premium");

  const prompt = `Suggest 2 branded upgrade options for 
    an insurance claim replacement.
    
    Item: "${description}"
    Brand: "${brand || "unknown"}"  
    Current value: $${current_price}
    
    CRITICAL PRICE RULES:
    - The mid upgrade must cost at least $${Math.ceil(minMidPrice)} (do not suggest anything below this).
    - The premium upgrade must cost at least $${Math.ceil(minPremiumPrice)} (do not suggest anything below this).
    - Premium must cost more than mid by a meaningful amount.
    - Typical multipliers vs current: mid ≥ ${multMid}x, premium ≥ ${multPrem}x (USD).
    
    Requirements:
    - Both must be real branded products
    - Available before January 2025
    - Use legitimate retailers only
    - Be specific: exact brand and model
    - Prefer brands known for quality in this category
    - Every product MUST have non-empty "brand" and "retailer" strings (real values, not placeholders).
    
    Return ONLY this JSON, no other text:
    {
      "mid": {
        "title": "exact product name",
        "brand": "brand name",
        "price": 000,
        "retailer": "retailer name",
        "url": "https://retailer.com",
        "available_since": "2024 or earlier"
      },
      "premium": {
        "title": "exact product name",
        "brand": "brand name", 
        "price": 000,
        "retailer": "retailer name",
        "url": "https://retailer.com",
        "available_since": "2024 or earlier"
      }
    }`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }],
    });
    const block = response.content[0];
    const text = block.type === "text" ? block.text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as {
      mid?: Partial<UpgradeProduct>;
      premium?: Partial<UpgradeProduct>;
    };
    if (!parsed.mid?.title) return null;
    const mid = fillFallbacks(
      {
        ...parsed.mid,
        price: Number(parsed.mid.price) || Math.ceil(minMidPrice),
      },
      parsed.mid.title || description
    );
    const premRaw = parsed.premium;
    const premium =
      premRaw && premRaw.title
        ? fillFallbacks(
            {
              ...premRaw,
              price: Number(premRaw.price) || Math.ceil(minPremiumPrice),
            },
            premRaw.title || description
          )
        : null;
    return { mid, premium };
  } catch (e) {
    console.warn("Claude upgrade error:", e);
    return null;
  }
}

/** When Serp found mid but no premium — ask Claude for a premium tier only. */
async function claudePremiumOnly(
  description: string,
  brand: string,
  current_price: number,
  mid: UpgradeProduct,
  minPremiumPrice: number
): Promise<UpgradeProduct | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const prompt = `Insurance claim upgrade — premium tier only.

Item: "${description}"
Brand: "${brand || "unknown"}"
Current value: $${current_price}
Existing mid-tier pick: "${mid.title}" at $${mid.price}

Return ONE premium upgrade (more expensive than mid, real product, before Jan 2025).
Price must be at least $${Math.ceil(minPremiumPrice)}.
Include non-empty "brand" and "retailer" strings.

Return ONLY this JSON:
{
  "premium": {
    "title": "exact product name",
    "brand": "brand name",
    "price": 000,
    "retailer": "retailer name",
    "url": "https://retailer.com",
    "available_since": "2024 or earlier"
  }
}`;

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    const block = response.content[0];
    const text = block.type === "text" ? block.text : "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]) as { premium?: Partial<UpgradeProduct> };
    const premRaw = parsed.premium;
    if (!premRaw?.title) return null;
    return fillFallbacks(
      {
        ...premRaw,
        price: Number(premRaw.price) || Math.ceil(minPremiumPrice),
      },
      premRaw.title
    );
  } catch (e) {
    console.warn("Claude premium-only error:", e);
    return null;
  }
}

function coerceToValidSet(
  set: UpgradeOptionSet | null,
  description: string,
  brand: string,
  current_price: number
): UpgradeOptionSet {
  const midFloor = minMidFloorUsd(current_price);
  const premFloor = minPremiumFloorUsd(current_price);

  if (set && isCompleteOptionSet(set, current_price)) {
    let s = set;
    if (s.premium && Math.abs(s.premium.price - s.mid.price) <= 0.01) {
      s = { mid: s.mid, premium: null };
    }
    return enrichSet(s, brand);
  }

  let mid = set?.mid;
  let premium = set?.premium ?? null;

  if (!mid || !isValidMid(mid.price, current_price)) {
    mid = fillFallbacks(
      {
        title: `Mid upgrade — ${description}`,
        price: Math.max(Math.ceil(midFloor), Math.round(current_price * 2)),
      },
      description
    );
  } else {
    mid = fillFallbacks(mid, mid.title);
  }

  if (!premium || !isValidPremium(premium.price, mid.price, current_price)) {
    premium = fillFallbacks(
      {
        title: `Premium upgrade — ${description}`,
        price: Math.max(Math.ceil(premFloor), mid.price + 1, Math.round(current_price * 2.8)),
      },
      description
    );
  } else {
    premium = fillFallbacks(premium, premium.title);
  }

  if (premium && Math.abs(premium.price - mid.price) <= 0.01) {
    premium = null;
  }

  return enrichSet({ mid, premium }, brand);
}

async function fetchFreshPair(
  cleanDesc: string,
  brand: string,
  current_price: number,
  category: string
): Promise<UpgradeOptionSet> {
  const midFloor = minMidFloorUsd(current_price);
  const premFloor = minPremiumFloorUsd(current_price);
  const useClaude = current_price < 1000;

  if (useClaude) {
    const claude = await claudeUpgradeSuggestions(cleanDesc, brand, current_price, midFloor, premFloor);
    if (claude) return coerceToValidSet(claude, cleanDesc, brand, current_price);
    return coerceToValidSet(localFallbackBoth(cleanDesc, brand, current_price), cleanDesc, brand, current_price);
  }

  const brandPrefix = brand ? `${brand} ` : "";
  const catSuffix = category ? ` ${category}` : "";
  const baseQuery = `${brandPrefix}${cleanDesc} 2024${catSuffix}`.trim();
  const noBrandQuery = `${cleanDesc} 2024${catSuffix}`.trim();

  let products = await serpSearchList(baseQuery);
  if (!products.length && brand) {
    products = await serpSearchList(noBrandQuery);
  }

  const seen = new Set<string>();
  const unique: UpgradeProduct[] = [];
  for (const p of products) {
    const k = normTitle(p.title);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(p);
  }

  let { mid, premium } = pickMidPremiumFromProducts(unique, current_price);

  if (!mid) {
    const claude = await claudeUpgradeSuggestions(cleanDesc, brand, current_price, midFloor, premFloor);
    return coerceToValidSet(claude, cleanDesc, brand, current_price);
  }

  mid = fillFallbacks(mid, mid.title || cleanDesc);

  if (!premium) {
    const claudePrem = await claudePremiumOnly(cleanDesc, brand, current_price, mid, premFloor);
    if (claudePrem && isValidPremium(claudePrem.price, mid.price, current_price)) {
      premium = fillFallbacks(claudePrem, claudePrem.title);
    } else {
      const claudeBoth = await claudeUpgradeSuggestions(cleanDesc, brand, current_price, midFloor, premFloor);
      if (claudeBoth?.premium && isValidPremium(claudeBoth.premium.price, mid.price, current_price)) {
        premium = fillFallbacks(claudeBoth.premium, claudeBoth.premium.title);
      } else {
        premium = fillFallbacks(
          {
            title: `Premium upgrade — ${cleanDesc}`,
            price: Math.max(Math.ceil(premFloor), mid.price + 1),
          },
          cleanDesc
        );
      }
    }
  } else {
    premium = fillFallbacks(premium, premium.title || cleanDesc);
  }

  return coerceToValidSet({ mid, premium }, cleanDesc, brand, current_price);
}

function normTitle(t: string): string {
  return t.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    item_description: string;
    brand: string;
    current_price: number;
    category: string;
    force_refresh?: boolean;
  };

  const { item_description, brand, current_price, category, force_refresh } = body;

  const cleanDesc = (item_description ?? "").trim();
  if (!cleanDesc || !current_price) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const brandStr = brand ?? "";
  const catStr = category ?? "";

  // ── Cache read (skip when force_refresh) ─────────────────────────────────
  if (!force_refresh) {
    try {
      const { data: exactRow, error: cacheErr } = await supabaseAdmin
        .from("upgrades_cache")
        .select("id, mid, premium, options")
        .ilike("item_description", cleanDesc)
        .maybeSingle();

      if (cacheErr) console.log("Cache read error:", cacheErr.message);

      if (exactRow?.mid) {
        const optionSets = optionSetsFromRow(exactRow, cleanDesc, current_price, brandStr);
        if (optionSets.length > 0) {
          return NextResponse.json({
            optionSets,
            mid: optionSets[0]!.mid,
            premium: optionSets[0]!.premium,
            source: "cache",
          });
        }
      }

      const firstWord = cleanDesc.split(/\s+/).filter(Boolean)[0] ?? "";
      if (firstWord.length >= 4) {
        const safe = firstWord.replace(/[%_]/g, "");
        const { data: fuzzy } = await supabaseAdmin
          .from("upgrades_cache")
          .select("id, mid, premium, options")
          .ilike("item_description", `%${safe}%`)
          .maybeSingle();

        if (fuzzy?.mid) {
          const optionSets = optionSetsFromRow(fuzzy, cleanDesc, current_price, brandStr);
          if (optionSets.length > 0) {
            return NextResponse.json({
              optionSets,
              mid: optionSets[0]!.mid,
              premium: optionSets[0]!.premium,
              source: "cache-fuzzy",
            });
          }
        }
      }
    } catch (e) {
      console.log("Cache lookup exception (non-fatal):", e);
    }
  }

  // ── Live fetch (SerpAPI $1000+ or Claude <$1000) ─────────────────────────
  const fresh = await fetchFreshPair(cleanDesc, brandStr, current_price, catStr);

  // ── Persist: append options; do not overwrite mid/premium on refresh ───────
  try {
    const { data: existing } = await supabaseAdmin
      .from("upgrades_cache")
      .select("id, mid, premium, options")
      .ilike("item_description", cleanDesc)
      .maybeSingle();

    const newPair = { mid: fresh.mid, premium: fresh.premium };

    if (existing?.id) {
      const rawOpts: unknown[] = Array.isArray(existing.options)
        ? [...(existing.options as unknown[])]
        : [];
      if (rawOpts.length === 0 && existing.mid) {
        rawOpts.push({ mid: existing.mid, premium: existing.premium });
      }
      const serialized = [...rawOpts, newPair];

      const { error: upErr } = await supabaseAdmin
        .from("upgrades_cache")
        .update({
          options: serialized,
          created_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (upErr) {
        console.log("Cache options update error:", upErr.message);
        await supabaseAdmin
          .from("upgrades_cache")
          .update({
            mid: fresh.mid,
            premium: fresh.premium,
            created_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      }
    } else {
      await supabaseAdmin.from("upgrades_cache").insert({
        item_description: cleanDesc,
        brand: brandStr,
        search_query: `${brandStr ? brandStr + " " : ""}${cleanDesc} 2024${catStr ? " " + catStr : ""}`.trim(),
        mid: fresh.mid,
        premium: fresh.premium,
        options: [newPair],
      });
    }
  } catch (e) {
    console.log("Cache store error (non-fatal):", e);
  }

  let finalSets: UpgradeOptionSet[] = [fresh];
  try {
    const { data: row } = await supabaseAdmin
      .from("upgrades_cache")
      .select("mid, premium, options")
      .ilike("item_description", cleanDesc)
      .maybeSingle();
    if (row) {
      const sanitized = optionSetsFromRow(row, cleanDesc, current_price, brandStr);
      if (sanitized.length) finalSets = sanitized;
    }
  } catch {
    /* keep [fresh] */
  }

  return NextResponse.json({
    optionSets: finalSets.length ? finalSets : [fresh],
    mid: fresh.mid,
    premium: fresh.premium,
    source: force_refresh ? "refresh" : current_price < 1000 ? "claude" : "serpapi",
  });
}
