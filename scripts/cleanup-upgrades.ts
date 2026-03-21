import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UpgradeProduct {
  title: string;
  brand: string;
  price: number;
  retailer: string;
  url: string;
  thumbnail?: string;
  available_since: string;
}

interface CacheRow {
  id: string;
  item_description: string;
  brand: string;
  search_query: string;
  mid: UpgradeProduct;
  premium: UpgradeProduct | null;
}

// ── Bad retailers ─────────────────────────────────────────────────────────────

const BAD_RETAILERS = [
  "ebay",
  "aliexpress",
  "walmart",
  "target",
  "hobby lobby",
  "amazon",
  "food depot",
  "smoothies",
  "classysculptures",
  "paradise awards",
  "restockit",
  "selectblinds",
  "blindsgalore",
  "greatbigcanvas",
  "inktuitive",
];

function isBadRetailer(retailer: string): boolean {
  const lower = retailer.toLowerCase();
  return BAD_RETAILERS.some((bad) => lower.includes(bad));
}

// ── Items to delete from cache entirely ───────────────────────────────────────

const SKIP_ITEMS = [
  "emmy award",
  "golden globe award",
  "bowl with food",
  "artwork (heart)",
  "artwork (zebra print)",
  "elephant presenting flower",
  "kai schaeffer album",
  "holiday decorations",
  "gardening tools",
  "office supplies",
  "window shades",
  "ceramic teapot",
  "wooden bowl with tea",
  "glass vase with flowers",
  "orange vase",
  "beige vase",
  "black vase",
  "rose quartz",
  "decorative bowl with spheres",
  "vase",
  "textile",
  "prints",
  "art books",
  "satellite tv box",
  "wooden block",
];

function isSkipItem(description: string): boolean {
  const lower = description.toLowerCase().trim();
  return SKIP_ITEMS.some((s) => lower === s || lower.startsWith(s + " ") || lower.includes(s));
}

// ── High-value replacements via Claude ────────────────────────────────────────

interface ReplacementSpec {
  description: string;
  original_price: number;
  context: string;
}

const HIGH_VALUE_REPLACEMENTS: ReplacementSpec[] = [
  {
    description: "Refrigerator",
    original_price: 10000,
    context: "High-end integrated kitchen refrigerator in Pacific Palisades luxury home",
  },
  {
    description: "Kitchen Island",
    original_price: 10000,
    context: "Custom kitchen island in luxury Pacific Palisades home",
  },
  {
    description: "Wooden Dining Table",
    original_price: 5000,
    context: "Designer dining table for luxury home with Italian modern aesthetic",
  },
  {
    description: "ABC Carpet & Home Area Rug",
    original_price: 3200,
    context: "High-end area rug for luxury living room",
  },
  {
    description: "Wooden Storage Trunk",
    original_price: 2000,
    context: "Outdoor storage trunk for Pacific Palisades patio",
  },
  {
    description: "Sofa with cushions",
    original_price: 2100,
    context: "Outdoor sofa for Pacific Palisades patio",
  },
  {
    description: "Artwork",
    original_price: 4000,
    context:
      "Original artwork for home office of Emmy/Golden Globe winning entertainment professional",
  },
  {
    description: "Standup piano",
    original_price: 3000,
    context: "Quality upright piano for home",
  },
  {
    description: "20 yards velvet fabric for couch recover",
    original_price: 1000,
    context: "Premium upholstery fabric for sofa reupholstery",
  },
  {
    description: "5 yards Osborne & Little striped fabric",
    original_price: 750,
    context: "Premium decorative fabric",
  },
  {
    description: "Built-in desk",
    original_price: 2500,
    context: "Custom built-in desk for home office",
  },
];

function findReplacement(description: string): ReplacementSpec | null {
  const lower = description.toLowerCase().trim();
  return (
    HIGH_VALUE_REPLACEMENTS.find((r) => lower.includes(r.description.toLowerCase())) ?? null
  );
}

// ── Claude replacement generator ──────────────────────────────────────────────

async function generateReplacement(
  anthropic: Anthropic,
  spec: ReplacementSpec
): Promise<{ mid: UpgradeProduct; premium: UpgradeProduct } | null> {
  const minPrice = Math.round(spec.original_price * 1.3);
  const midMin = Math.round(spec.original_price * 1.5);
  const midMax = Math.round(spec.original_price * 3);
  const premMin = Math.round(spec.original_price * 2);
  const premMax = Math.round(spec.original_price * 5);

  const prompt = `You are an insurance claim specialist.
Suggest 2 real upgrade products for an insurance replacement claim.

Item: ${spec.description}
Original claimed value: $${spec.original_price}
Context: ${spec.context}

Requirements:
- Both suggestions must cost MORE than $${minPrice}
- Use only legitimate retail sources: brand websites, authorized dealers, specialty retailers, design showrooms
- NO eBay, Amazon, Walmart, Target, AliExpress
- Products must have been available before Jan 1 2025
- Mid upgrade: $${midMin}–$${midMax} range
- Premium upgrade: $${premMin}–$${premMax} range
- Be specific: exact brand, model name, retailer name

Return ONLY this JSON, no other text:
{
  "mid": {
    "title": "exact product name and model",
    "brand": "brand name",
    "price": 00000,
    "retailer": "retailer name",
    "url": "https://retailer.com/product-url",
    "available_since": "2024 or earlier"
  },
  "premium": {
    "title": "exact product name and model",
    "brand": "brand name",
    "price": 00000,
    "retailer": "retailer name",
    "url": "https://retailer.com/product-url",
    "available_since": "2024 or earlier"
  }
}`;

  try {
    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonStr) {
      console.error(`    Claude returned no JSON for "${spec.description}"`);
      return null;
    }

    const parsed = JSON.parse(jsonStr) as {
      mid?: Partial<UpgradeProduct>;
      premium?: Partial<UpgradeProduct>;
    };

    if (!parsed.mid?.title || !parsed.premium?.title) {
      console.error(`    Claude response missing fields for "${spec.description}"`);
      return null;
    }

    const toProduct = (p: Partial<UpgradeProduct>): UpgradeProduct => ({
      title: p.title ?? spec.description,
      brand: p.brand ?? "",
      price: typeof p.price === "number" ? p.price : 0,
      retailer: p.retailer ?? "",
      url: p.url ?? "",
      thumbnail: "",
      available_since: "2024 or earlier",
    });

    const mid = toProduct(parsed.mid);
    const premium = toProduct(parsed.premium);

    // Sanity-check: reject if Claude still gave a bad retailer
    if (isBadRetailer(mid.retailer) || isBadRetailer(premium.retailer)) {
      console.warn(
        `    Claude returned bad retailers for "${spec.description}": ${mid.retailer} / ${premium.retailer} — will retry once`
      );
      return null;
    }

    return { mid, premium };
  } catch (err) {
    console.error(`    Claude error for "${spec.description}":`, err);
    return null;
  }
}

// ── Price sanity check ────────────────────────────────────────────────────────

function priceIsWrong(row: CacheRow): boolean {
  const midPrice = row.mid?.price ?? 0;
  const premPrice = row.premium?.price ?? 0;

  // Obviously wrong: mid price suspiciously low
  if (midPrice < 100) return true;

  // Premium cheaper than mid — almost certainly wrong
  if (premPrice > 0 && premPrice < midPrice * 0.8) return true;

  return false;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("❌  Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const anthropic = new Anthropic();

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  cleanup-upgrades — auditing upgrades_cache");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  // ── Load cache ─────────────────────────────────────────────────────────────
  const { data: rows, error: fetchErr } = await supabase
    .from("upgrades_cache")
    .select("id, item_description, brand, search_query, mid, premium");

  if (fetchErr) {
    console.error("❌  Could not fetch upgrades_cache:", fetchErr.message);
    process.exit(1);
  }

  const cache = (rows ?? []) as CacheRow[];
  console.log(`Loaded ${cache.length} cache entries\n`);

  let deleted = 0;
  let replaced = 0;
  let kept = 0;

  for (const row of cache) {
    const desc = row.item_description;

    // ── Step A: skip list → delete ─────────────────────────────────────────
    if (isSkipItem(desc)) {
      const { error } = await supabase.from("upgrades_cache").delete().eq("id", row.id);
      if (error) {
        console.error(`  Delete error for "${desc}":`, error.message);
      } else {
        console.log(`  DELETED (skip list): ${desc}`);
        deleted++;
      }
      continue;
    }

    // ── Step B/C: check retailer quality and price sanity ──────────────────
    const midBad = isBadRetailer(row.mid?.retailer ?? "");
    const premBad = !row.premium || isBadRetailer(row.premium.retailer ?? "");
    const priceBad = priceIsWrong(row);

    const needsAction = midBad || premBad || priceBad;

    if (!needsAction) {
      console.log(`  OK: ${desc} — mid $${row.mid.price} @ ${row.mid.retailer}`);
      kept++;
      continue;
    }

    const reasons: string[] = [];
    if (midBad) reasons.push(`mid retailer "${row.mid?.retailer}"`);
    if (premBad && row.premium) reasons.push(`premium retailer "${row.premium.retailer}"`);
    if (!row.premium) reasons.push("no premium result");
    if (priceBad) reasons.push(`price issue (mid $${row.mid?.price})`);

    // ── Step D: replace via Claude or delete ───────────────────────────────
    const spec = findReplacement(desc);

    if (spec) {
      console.log(`  REPLACING: ${desc} (${reasons.join(", ")})`);

      const result = await generateReplacement(anthropic, spec);
      if (result) {
        const { error } = await supabase.from("upgrades_cache").upsert(
          {
            id: row.id,
            item_description: desc,
            brand: row.brand,
            search_query: row.search_query,
            mid: result.mid,
            premium: result.premium,
          },
          { onConflict: "id" }
        );

        if (error) {
          console.error(`    Upsert error:`, error.message);
        } else {
          console.log(
            `    ↳ REPLACED: mid $${result.mid.price} @ ${result.mid.retailer} | premium $${result.premium.price} @ ${result.premium.retailer}`
          );
          replaced++;
        }
      } else {
        // Claude failed — delete so the app falls back to live search
        const { error } = await supabase.from("upgrades_cache").delete().eq("id", row.id);
        if (!error) {
          console.log(`    ↳ DELETED (Claude failed): ${desc}`);
          deleted++;
        }
      }
    } else {
      // Not in high-value list — just delete, app will search live
      const { error } = await supabase.from("upgrades_cache").delete().eq("id", row.id);
      if (error) {
        console.error(`  Delete error for "${desc}":`, error.message);
      } else {
        console.log(`  DELETED (bad data, not in replace list): ${desc}`);
        deleted++;
      }
    }

    // Small pause between Claude calls
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Done.
  Total audited:          ${cache.length}
  Kept unchanged:         ${kept}
  Replaced with Claude:   ${replaced}
  Deleted:                ${deleted}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
