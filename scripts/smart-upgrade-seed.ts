/**
 * Re-seed upgrades_cache rows using Claude + category-aware price ceilings.
 * Same env as other scripts: .env.local with ANTHROPIC_API_KEY + Supabase keys.
 */
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";

// ── Category rules ───────────────────────────────────────────────────────────

const CATEGORY_RULES: Record<
  string,
  {
    hasPremium: boolean;
    maxReasonablePrice: number;
    notes: string;
  }
> = {
  tennis_racquet: {
    hasPremium: false,
    maxReasonablePrice: 500,
    notes: "Top pro rackets max at $450",
  },
  gaming_console: {
    hasPremium: false,
    maxReasonablePrice: 600,
    notes: "Xbox/PlayStation have no premium tier",
  },
  basketball: {
    hasPremium: false,
    maxReasonablePrice: 200,
    notes: "Official NBA ball is the ceiling",
  },
  boogie_board: {
    hasPremium: false,
    maxReasonablePrice: 250,
    notes: "Category ceiling is real",
  },
  tripod: {
    hasPremium: true,
    maxReasonablePrice: 2500,
    notes: "Wide range from $150 to $2500",
  },
  camera: {
    hasPremium: true,
    maxReasonablePrice: 6000,
    notes: "Wide range up to cinema cameras",
  },
  speaker: {
    hasPremium: true,
    maxReasonablePrice: 10000,
    notes: "Hi-fi speakers can be very expensive",
  },
  desk_lamp: {
    hasPremium: true,
    maxReasonablePrice: 8000,
    notes: "Designer lamps wide range",
  },
  toolbox: {
    hasPremium: true,
    maxReasonablePrice: 4000,
    notes: "Snap-on professional tier",
  },
  handbag: {
    hasPremium: true,
    maxReasonablePrice: 15000,
    notes: "Luxury handbags wide range",
  },
  mattress: {
    hasPremium: true,
    maxReasonablePrice: 5000,
    notes: "Luxury mattresses up to $5000",
  },
  headphones: {
    hasPremium: true,
    maxReasonablePrice: 1500,
    notes: "Audiophile tier exists",
  },
  luggage: {
    hasPremium: true,
    maxReasonablePrice: 1500,
    notes: "Rimowa/Tumi are the ceiling",
  },
  keyboard: {
    hasPremium: true,
    maxReasonablePrice: 500,
    notes: "Mechanical keyboard ceiling",
  },
  wetsuit: {
    hasPremium: true,
    maxReasonablePrice: 800,
    notes: "Top wetsuits cap around $700",
  },
  sleeping_bag: {
    hasPremium: true,
    maxReasonablePrice: 700,
    notes: "Western Mountaineering is ceiling",
  },
};

function detectCategory(description: string): string | null {
  const d = description.toLowerCase();
  if (d.includes("tennis racquet") || d.includes("tennis racket")) return "tennis_racquet";
  if (d.includes("xbox") || d.includes("playstation") || d.includes("gaming console")) return "gaming_console";
  if (d.includes("basketball")) return "basketball";
  if (d.includes("boogie")) return "boogie_board";
  if (d.includes("tripod")) return "tripod";
  if (d.includes("camera")) return "camera";
  if (d.includes("speaker")) return "speaker";
  if ((d.includes("lamp") || d.includes("light")) && !d.includes("bulb")) return "desk_lamp";
  if (d.includes("toolbox") || d.includes("tool box")) return "toolbox";
  if (d.includes("handbag") || d.includes("purse")) return "handbag";
  if (d.includes("mattress")) return "mattress";
  if (d.includes("headphone") || d.includes("headset")) return "headphones";
  if (d.includes("luggage") || d.includes("carry on") || d.includes("suitcase")) return "luggage";
  if (d.includes("keyboard")) return "keyboard";
  if (d.includes("wetsuit") || d.includes("wet suit")) return "wetsuit";
  if (d.includes("sleeping bag")) return "sleeping_bag";
  return null;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface CacheRow {
  id: string;
  item_description: string;
  brand: string;
  mid: unknown;
  premium: unknown;
  options?: unknown;
}

interface ClaimItem {
  description: string;
  unit_cost: number;
}

interface ClaudeOption {
  title?: string;
  brand?: string;
  price?: number;
  retailer?: string;
  url?: string;
  available_since?: string;
  tier?: string;
}

interface UpgradeProductJson {
  title: string;
  brand: string;
  model: string;
  price: number;
  retailer: string;
  url: string;
  thumbnail: string;
  available_since: string;
  age_years: number;
  age_months: number;
  condition: "New";
}

function normDesc(s: string): string {
  return s.trim().toLowerCase();
}

/** Per-field checks before price-tier logic. */
function strictValidateClaudeOption(el: unknown): ClaudeOption | null {
  if (el === null || typeof el !== "object") return null;
  const o = el as Record<string, unknown>;
  if (typeof o.title !== "string" || !o.title.trim()) return null;
  if (typeof o.brand !== "string" || !o.brand.trim()) return null;
  if (typeof o.retailer !== "string" || !o.retailer.trim()) return null;
  if (typeof o.url !== "string" || !o.url.trim().toLowerCase().startsWith("http")) return null;
  let price: number;
  if (typeof o.price === "number" && Number.isFinite(o.price)) {
    price = o.price;
  } else if (typeof o.price === "string") {
    const n = parseFloat(o.price.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(n) || n <= 0) return null;
    price = n;
  } else {
    return null;
  }
  if (price <= 0) return null;
  return {
    title: o.title.trim(),
    brand: o.brand.trim(),
    retailer: o.retailer.trim(),
    url: o.url.trim(),
    price,
    available_since: typeof o.available_since === "string" ? o.available_since : undefined,
    tier: typeof o.tier === "string" ? o.tier : undefined,
  };
}

function extractJsonArraySubstring(raw: string): string | null {
  const m = raw.match(/\[[\s\S]*\]/);
  return m ? m[0] : null;
}

/** Parse Claude output; retry once after stripping ``` fences. */
function parseClaudeJsonArray(text: string): unknown[] | null {
  const tryOnce = (src: string): unknown[] | null => {
    const slice = extractJsonArraySubstring(src);
    if (!slice) return null;
    try {
      const v = JSON.parse(slice) as unknown;
      return Array.isArray(v) ? v : null;
    } catch {
      return null;
    }
  };

  let out = tryOnce(text);
  if (out) return out;

  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  out = tryOnce(cleaned);
  return out;
}

function toUpgradeProduct(o: ClaudeOption): UpgradeProductJson | null {
  const title = (o.title ?? "").trim();
  const brand = (o.brand ?? "").trim();
  const retailer = (o.retailer ?? "").trim();
  const url = (o.url ?? "").trim();
  const price = Number(o.price);
  if (!title || !brand || !retailer || !url.toLowerCase().startsWith("http")) return null;
  if (!Number.isFinite(price) || price <= 0) return null;
  return {
    title,
    brand,
    model: "",
    price,
    retailer,
    url,
    thumbnail: "",
    available_since: (o.available_since ?? "2024 or earlier").trim() || "2024 or earlier",
    age_years: 0,
    age_months: 0,
    condition: "New",
  };
}

const BLOCKED = /ebay|amazon\.|amazon\s|walmart|aliexpress/i;

function isBlockedRetailer(r: string, u: string): boolean {
  return BLOCKED.test(r) || BLOCKED.test(u);
}

/**
 * Filter by price bounds, blocked retailers, then build increasing chain with ≥25% steps.
 */
function validateOptions(raw: unknown[], originalPrice: number, maxPrice: number): UpgradeProductJson[] {
  const minP = originalPrice * 1.2;
  const candidates: UpgradeProductJson[] = [];
  for (const r of raw) {
    const strict = strictValidateClaudeOption(r);
    if (!strict) continue;
    const p = toUpgradeProduct(strict);
    if (!p) continue;
    if (p.price <= minP || p.price > maxPrice) continue;
    if (isBlockedRetailer(p.retailer, p.url)) continue;
    candidates.push(p);
  }
  candidates.sort((a, b) => a.price - b.price);
  if (candidates.length === 0) return [];

  const chain: UpgradeProductJson[] = [candidates[0]];
  for (let i = 1; i < candidates.length; i++) {
    const prev = chain[chain.length - 1]!;
    const cur = candidates[i]!;
    if (cur.price >= prev.price * 1.25) {
      if (normDesc(cur.title) !== normDesc(prev.title)) {
        chain.push(cur);
      }
    }
  }

  return chain;
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

/** Flat cache entries — no { mid, premium } wrapper. */
type FlatCacheOption = {
  title: string;
  brand: string;
  price: number;
  retailer: string;
  url: string;
  available_since: string;
};

function toFlatOption(p: UpgradeProductJson): FlatCacheOption {
  return {
    title: p.title,
    brand: p.brand,
    price: p.price,
    retailer: p.retailer,
    url: p.url,
    available_since: p.available_since,
  };
}

function flatToFullUpgradeJson(f: FlatCacheOption): UpgradeProductJson {
  return {
    title: f.title,
    brand: f.brand,
    model: "",
    price: f.price,
    retailer: f.retailer,
    url: f.url,
    thumbnail: "",
    available_since: f.available_since,
    age_years: 0,
    age_months: 0,
    condition: "New",
  };
}

function assertFlatOptionsBeforeUpsert(options: FlatCacheOption[]): void {
  options.forEach((opt, i) => {
    if (typeof opt.price !== "number") {
      throw new Error(`Option ${i} has no price`);
    }
    if (!opt.title) {
      throw new Error(`Option ${i} has no title`);
    }
    if ("mid" in opt) {
      throw new Error(`Option ${i} is nested — must be flat`);
    }
  });
}

function verifyOptionsSerializable(optionsColumn: FlatCacheOption[]): FlatCacheOption[] | null {
  try {
    const s = JSON.stringify(optionsColumn);
    const reparsed = JSON.parse(s) as unknown;
    if (!Array.isArray(reparsed)) return null;
    return reparsed as FlatCacheOption[];
  } catch {
    return null;
  }
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or Supabase key");
    process.exit(1);
  }
  if (!apiKey) {
    console.error("Missing ANTHROPIC_API_KEY in .env.local");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const client = new Anthropic({ apiKey });

  const { data: session } = await supabase.from("claim_session").select("claim_items").eq("id", "trial").maybeSingle();

  const claimItems = (session?.claim_items as ClaimItem[] | null) ?? [];
  const claimMap = buildOriginalPriceMap(claimItems);

  const { data: rows, error: listErr } = await supabase
    .from("upgrades_cache")
    .select("id, item_description, brand, mid, premium, options")
    .order("item_description");

  if (listErr || !rows?.length) {
    console.error("No upgrades_cache rows or error:", listErr?.message);
    process.exit(listErr ? 1 : 0);
  }

  console.log(`Processing ${rows.length} cache rows…\n`);

  for (const row of rows as CacheRow[]) {
    const description = (row.item_description ?? "").trim();
    const brand = (row.brand ?? "").trim();
    if (!description) {
      console.log("SKIP (empty description)");
      await sleep(300);
      continue;
    }

    const originalPrice = resolveOriginalPrice(description, claimMap, row.mid);
    const categoryKey = detectCategory(description);
    const rule = categoryKey ? CATEGORY_RULES[categoryKey] : null;
    const maxPrice = rule?.maxReasonablePrice ?? originalPrice * 5;
    const hasPremium = rule?.hasPremium !== false;
    const count = hasPremium ? 3 : 2;
    const minPriceHint = Math.round(originalPrice * 1.2);

    const prompt = `You are an insurance claim specialist generating upgrade options.

Item: "${description}"
Brand: "${brand}"
Original value: $${originalPrice}
Category notes: ${rule?.notes ?? "general item"}
Maximum reasonable price: $${maxPrice}
Has meaningful premium tier: ${hasPremium}

Generate ${count} upgrade options as a JSON array.

Rules:
- All prices must be between $${minPriceHint} and $${maxPrice}
- Each option must be a different product
- Use real brands available before Jan 2025
- No eBay, Amazon, Walmart, AliExpress (do not use those as retailer or in URLs)
- Prices must increase meaningfully between tiers (at least 25% between each tier when sorted by price)
${
  !hasPremium
    ? "- This category has no premium tier — keep all options within the reasonable range without runaway luxury SKUs"
    : ""
}

Return ONLY a JSON array, no other text:
[
  {
    "title": "exact product name",
    "brand": "brand name",
    "price": 000,
    "retailer": "retailer name",
    "url": "https://retailer.com/product",
    "available_since": "2024 or earlier",
    "tier": "entry|mid|premium"
  }
]`;

    let validated: UpgradeProductJson[] = [];
    try {
      const response = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      });
      const block = response.content[0];
      const text = block.type === "text" ? block.text : "";
      const parsed = parseClaudeJsonArray(text);
      if (!parsed || parsed.length === 0) {
        console.error(`ERROR JSON parse: ${description} — could not parse array after cleanup`);
        await sleep(300);
        continue;
      }
      validated = validateOptions(parsed, originalPrice, maxPrice);
    } catch (e) {
      console.error(`ERROR ${description}:`, e);
      await sleep(300);
      continue;
    }

    if (validated.length < 2) {
      console.log(`SKIP (validation): ${description} — need ≥2 valid tiers, got ${validated.length}`);
      await sleep(300);
      continue;
    }

    const optionsFlat: FlatCacheOption[] = validated.map(toFlatOption);
    try {
      assertFlatOptionsBeforeUpsert(optionsFlat);
    } catch (e) {
      console.error(`ERROR flat options: ${description}`, e);
      await sleep(300);
      continue;
    }

    const verifiedOptions = verifyOptionsSerializable(optionsFlat);
    if (!verifiedOptions) {
      console.error(`ERROR verify options JSON: ${description} — stringify/parse failed`);
      await sleep(300);
      continue;
    }

    const midCol = flatToFullUpgradeJson(verifiedOptions[0]!);
    const premiumCol = flatToFullUpgradeJson(verifiedOptions[verifiedOptions.length - 1]!);

    const { error: upErr } = await supabase
      .from("upgrades_cache")
      .update({
        mid: midCol,
        premium: premiumCol,
        options: verifiedOptions,
        created_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (upErr) {
      console.error(`UPDATE failed ${description}:`, upErr.message);
    } else {
      const priceStr = validated.map((p) => `$${p.price}`).join(" / ");
      if (!hasPremium) {
        console.log(`SKIP (no premium): ${description} — $${originalPrice} → ${priceStr}`);
      } else {
        console.log(`UPDATED: ${description} — $${originalPrice} → ${priceStr}`);
      }
    }

    await sleep(300);
  }

  const { data: check } = await supabase
    .from("upgrades_cache")
    .select("item_description, options")
    .not("options", "eq", "[]")
    .limit(3);

  console.log("\nSample stored options:");
  check?.forEach((row) => {
    const opts = row.options as FlatCacheOption[] | null;
    console.log(row.item_description);
    console.log("  Option 1:", opts?.[0]?.title, "$" + String(opts?.[0]?.price ?? ""));
    console.log("  Option 2:", opts?.[1]?.title, "$" + String(opts?.[1]?.price ?? ""));
  });

  console.log("\nDone.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
