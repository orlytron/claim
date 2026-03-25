import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

const SYSTEM = `
You are helping rebuild an insurance claim for a Pacific Palisades family whose home burned down January 2025.

Return exactly 3 replacement options for the item requested, at three price tiers: basic, mid, luxury.

For each option return realistic 2025 retail prices. Consider:
- This is a high-end household
- Items were well maintained
- Basic = functional everyday brand
- Mid = quality brand, typical choice
- Luxury = premium, top of market

Respond ONLY with valid JSON array.
No markdown. No explanation.

Format:
[
  {
    "tier": "Basic",
    "brand": "Firewire",
    "description": "Seaside 6ft2in surfboard",
    "model": "Seaside",
    "unit_cost": 650,
    "age_years": 2,
    "condition": "Good",
    "category": "Sports"
  },
  {
    "tier": "Mid",
    "brand": "Channel Islands",
    "description": "Happy 6ft2in surfboard",
    "model": "Happy",
    "unit_cost": 950,
    "age_years": 1,
    "condition": "Like New",
    "category": "Sports"
  },
  {
    "tier": "Luxury",
    "brand": "JS Industries",
    "description": "Hyfi 6ft2in surfboard",
    "model": "Hyfi",
    "unit_cost": 1400,
    "age_years": 1,
    "condition": "Like New",
    "category": "Sports"
  }
]

Rules:
- Use real brands and models
- Prices must be accurate 2025 retail
- age_years should reflect typical use
- Basic tier: older, more affordable
- Luxury tier: newer, premium price
- Match category to item type
- Never return used or refurbished
`.trim();

export type SmartLookupResult = {
  tier: string;
  brand: string;
  description: string;
  model: string;
  unit_cost: number;
  age_years: number;
  condition: string;
  category: string;
};

function stripJsonFence(text: string): string {
  return text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

function parseResults(text: string): SmartLookupResult[] {
  let clean = stripJsonFence(text);
  const start = clean.indexOf("[");
  const end = clean.lastIndexOf("]");
  if (start < 0 || end <= start) throw new Error("No JSON array in response");
  clean = clean.slice(start, end + 1);
  const arr = JSON.parse(clean) as unknown[];
  if (!Array.isArray(arr) || arr.length === 0) throw new Error("Expected non-empty array");
  const out: SmartLookupResult[] = [];
  for (const el of arr.slice(0, 3)) {
    if (!el || typeof el !== "object") continue;
    const o = el as Record<string, unknown>;
    out.push({
      tier: String(o.tier ?? ""),
      brand: String(o.brand ?? ""),
      description: String(o.description ?? ""),
      model: String(o.model ?? ""),
      unit_cost: typeof o.unit_cost === "number" && Number.isFinite(o.unit_cost) ? o.unit_cost : 0,
      age_years: typeof o.age_years === "number" && Number.isFinite(o.age_years) ? Math.max(0, Math.round(o.age_years)) : 0,
      condition: String(o.condition ?? "Good"),
      category: String(o.category ?? "Other"),
    });
  }
  if (out.length === 0) throw new Error("No valid options parsed");
  return out;
}

async function callClaude(itemQuery: string, qty: number, room: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const userMessage = `Item: ${itemQuery}
Quantity needed: ${qty}
Room: ${room}
Family profile: Pacific Palisades, high-end home, active lifestyle`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 55_000);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": key,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        system: SYSTEM,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API ${response.status}: ${errText.slice(0, 300)}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const block = data.content?.[0];
    if (!block || block.type !== "text" || typeof block.text !== "string") {
      throw new Error("Unexpected Claude response shape");
    }
    return block.text;
  } finally {
    clearTimeout(t);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      item?: string;
      qty?: number;
      room?: string;
    };

    const item = typeof body.item === "string" ? body.item.trim() : "";
    const room = typeof body.room === "string" ? body.room.trim() : "";
    const qtyRaw = body.qty;
    const qtyNum =
      typeof qtyRaw === "number"
        ? qtyRaw
        : typeof qtyRaw === "string"
          ? parseInt(qtyRaw, 10)
          : NaN;
    const qty = Number.isFinite(qtyNum) && qtyNum >= 1 ? Math.min(99, Math.floor(qtyNum)) : 1;

    if (!item || !room) {
      return NextResponse.json({ error: "item and room are required" }, { status: 400 });
    }

    const text = await callClaude(item, qty, room);
    const results = parseResults(text);
    return NextResponse.json({ results });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Smart lookup failed";
    return NextResponse.json({ error: message, results: [] as SmartLookupResult[] }, { status: 500 });
  }
}
