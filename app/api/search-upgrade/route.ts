import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
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

function optionSetsFromRow(row: {
  mid: unknown;
  premium: unknown;
  options?: unknown;
}, cleanDesc: string): UpgradeOptionSet[] {
  const opts = row.options;
  if (Array.isArray(opts) && opts.length > 0) {
    const out: UpgradeOptionSet[] = [];
    for (const el of opts) {
      const s = normalizeOptionSet(el, cleanDesc);
      if (s) out.push(s);
    }
    if (out.length) return out;
  }
  const single = normalizeOptionSet({ mid: row.mid, premium: row.premium }, cleanDesc);
  return single ? [single] : [];
}

async function serpSearchBoth(query: string): Promise<[UpgradeProduct | null, UpgradeProduct | null]> {
  if (!SERP_KEY) {
    return [null, null];
  }

  try {
    const url = new URL("https://serpapi.com/search");
    url.searchParams.set("engine", "google_shopping");
    url.searchParams.set("q", query);
    url.searchParams.set("api_key", SERP_KEY);
    url.searchParams.set("num", "5");

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
  } catch {
    return [null, null];
  }
}

async function claudeUpgradeSuggestions(
  description: string,
  brand: string,
  current_price: number
): Promise<UpgradeOptionSet | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const prompt = `Suggest 2 branded upgrade options for 
    an insurance claim replacement.
    
    Item: "${description}"
    Brand: "${brand || "unknown"}"  
    Current value: $${current_price}
    
    Requirements:
    - Both must be real branded products
    - Available before January 2025
    - Mid option: 1.5x to 2.5x current price
    - Premium option: 2x to 4x current price
    - Use legitimate retailers only
    - Be specific: exact brand and model
    - Prefer brands known for quality 
      in this category
    
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
        price: Number(parsed.mid.price) || Math.round(current_price * 2),
      },
      parsed.mid.title || description
    );
    const premRaw = parsed.premium;
    const premium =
      premRaw && premRaw.title
        ? fillFallbacks(
            {
              ...premRaw,
              price: Number(premRaw.price) || Math.round(current_price * 3),
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

async function fetchFreshPair(
  cleanDesc: string,
  brand: string,
  current_price: number,
  category: string
): Promise<UpgradeOptionSet> {
  const useClaude = current_price < 1000;

  if (useClaude) {
    const claude = await claudeUpgradeSuggestions(cleanDesc, brand, current_price);
    if (claude) return claude;
    return localFallbackBoth(cleanDesc, brand, current_price);
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
  const premium: UpgradeProduct | null = serpPremium
    ? fillFallbacks(serpPremium, serpPremium.title || cleanDesc)
    : fb.premium;

  return { mid, premium };
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
        const optionSets = optionSetsFromRow(exactRow, cleanDesc);
        return NextResponse.json({
          optionSets,
          mid: exactRow.mid,
          premium: exactRow.premium,
          source: "cache",
        });
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
          const optionSets = optionSetsFromRow(fuzzy, cleanDesc);
          return NextResponse.json({
            optionSets,
            mid: fuzzy.mid,
            premium: fuzzy.premium,
            source: "cache-fuzzy",
          });
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
      const prevSets = optionSetsFromRow(existing, cleanDesc);
      const serialized = [
        ...prevSets.map((s) => ({ mid: s.mid, premium: s.premium })),
        newPair,
      ];

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
    if (row) finalSets = optionSetsFromRow(row, cleanDesc);
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
