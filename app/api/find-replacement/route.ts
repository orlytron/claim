import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabase-admin";
import {
  flattenUpgradesCacheRow,
  pickSimilarAndUpgrade,
  parsePrice,
  type FlatProduct,
} from "../../lib/pick-replacement-options";

const SERP_KEY = process.env.SERP_API_KEY ?? "";

export type ReplacementOptionDto = {
  name: string;
  brand: string;
  price: number;
  url: string;
  tier: "similar" | "upgrade";
};

async function findCacheRow(trimmedDesc: string) {
  const { data: exact } = await supabaseAdmin
    .from("upgrades_cache")
    .select("mid, premium, options, item_description")
    .ilike("item_description", trimmedDesc)
    .maybeSingle();
  if (exact) return exact;

  const words = trimmedDesc.split(/\s+/).filter((w) => w.length > 3).slice(0, 2);
  for (const word of words) {
    const safe = word.replace(/[%_]/g, "");
    if (!safe) continue;
    const { data: partial } = await supabaseAdmin
      .from("upgrades_cache")
      .select("mid, premium, options, item_description")
      .ilike("item_description", `%${safe}%`)
      .maybeSingle();
    if (partial) return partial;
  }
  return null;
}

async function serpShoppingList(query: string, num = 12): Promise<FlatProduct[]> {
  if (!SERP_KEY) return [];

  try {
    const url = new URL("https://serpapi.com/search");
    url.searchParams.set("engine", "google_shopping");
    url.searchParams.set("q", query);
    url.searchParams.set("api_key", SERP_KEY);
    url.searchParams.set("num", String(num));

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(12000),
    });
    const data = (await response.json()) as {
      shopping_results?: Array<{
        title?: string;
        price?: string | number;
        extracted_price?: number;
        source?: string;
        link?: string;
        product_link?: string;
      }>;
    };

    const results = data.shopping_results ?? [];
    return results.map((r) => {
      const price = r.extracted_price ?? parsePrice(r.price);
      const title = (r.title ?? query).trim();
      return {
        title,
        brand: "",
        price,
        url: (r.product_link ?? r.link ?? "").trim() || `https://www.google.com/search?q=${encodeURIComponent(title)}&tbm=shop`,
        retailer: (r.source ?? "").trim(),
      };
    });
  } catch {
    return [];
  }
}

function toDto(p: FlatProduct, tier: "similar" | "upgrade"): ReplacementOptionDto {
  return {
    name: p.title,
    brand: p.brand,
    price: Math.round(p.price * 100) / 100,
    url: p.url,
    tier,
  };
}

async function persistCacheFromSerp(
  description: string,
  brand: string,
  query: string,
  similar: FlatProduct | null,
  upgrade: FlatProduct | null
) {
  const midJson = similar
    ? {
        title: similar.title,
        brand: similar.brand,
        model: "",
        price: similar.price,
        retailer: similar.retailer ?? "Search",
        url: similar.url,
        thumbnail: "",
        available_since: "2024 or earlier",
        age_years: 0,
        age_months: 0,
        condition: "New" as const,
      }
    : null;
  const premJson = upgrade
    ? {
        title: upgrade.title,
        brand: upgrade.brand,
        model: "",
        price: upgrade.price,
        retailer: upgrade.retailer ?? "Search",
        url: upgrade.url,
        thumbnail: "",
        available_since: "2024 or earlier",
        age_years: 0,
        age_months: 0,
        condition: "New" as const,
      }
    : null;

  const flatOpts: unknown[] = [];
  if (similar) flatOpts.push(midJson);
  if (upgrade && (!similar || Math.abs(upgrade.price - similar.price) > 0.01)) flatOpts.push(premJson);

  if (!midJson) return;

  const { error } = await supabaseAdmin.from("upgrades_cache").insert({
    item_description: description.trim(),
    brand: brand ?? "",
    search_query: query,
    mid: midJson,
    premium: premJson,
    options: flatOpts,
  });

  if (error?.code === "23505" || /duplicate/i.test(error?.message ?? "")) {
    /* unique item_description — row exists */
    return;
  }
  if (error) {
    console.warn("find-replacement: cache insert", error.message);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      description?: string;
      brand?: string;
      unit_cost?: number;
      room?: string;
    };

    const description = typeof body.description === "string" ? body.description.trim() : "";
    const brand = typeof body.brand === "string" ? body.brand.trim() : "";
    const unit_cost = typeof body.unit_cost === "number" && Number.isFinite(body.unit_cost) ? body.unit_cost : 0;
    void body.room;

    if (!description) {
      return NextResponse.json({ error: "description is required" }, { status: 400 });
    }

    const claimed = unit_cost > 0 ? unit_cost : 0.01;

    const cached = await findCacheRow(description);
    if (cached) {
      const flat = flattenUpgradesCacheRow(cached);
      const { similar, upgrade } = pickSimilarAndUpgrade(flat, claimed);
      return NextResponse.json({
        source: "cache" as const,
        similar: similar ? toDto(similar, "similar") : null,
        upgrade: upgrade ? toDto(upgrade, "upgrade") : null,
        claimedPrice: unit_cost,
      });
    }

    const query = [brand, description, "buy"].filter(Boolean).join(" ").trim();
    const serp = await serpShoppingList(query);
    const { similar, upgrade } = pickSimilarAndUpgrade(serp, claimed);

    if (similar || upgrade) {
      void persistCacheFromSerp(description, brand, query, similar, upgrade);
    }

    return NextResponse.json({
      source: "serp" as const,
      similar: similar ? toDto(similar, "similar") : null,
      upgrade: upgrade ? toDto(upgrade, "upgrade") : null,
      claimedPrice: unit_cost,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
