import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "../../lib/supabase-admin";
import type { ClaimItem } from "../../lib/types";
import type { SmartItemRequestBundleJson } from "../../lib/smart-item-request";

export const maxDuration = 30;

const SYSTEM_PROMPT = `
You are helping rebuild a contents insurance claim for a family whose home was destroyed in the Pacific Palisades fire (January 2025).

FAMILY PROFILE:
- David (50s): Emmy + Golden Globe winning filmmaker. Serious tennis player, golfer, cyclist.
- Jacquie (50s): Professional art curator. European taste. Brands: La Mer, Augustinus Bader, Diptyque, Cire Trudon.
- Orly (30): Filmmaker/photographer. Sony camera collector, surfer, musician.
- Rafe (24): Luxury streetwear collector. Vintage. Velvet. Hard to find items. Gucci.
- Pacific Palisades home, high-end neighborhood, 20+ year residence.

YOUR JOB:
When the client describes an item they remember having, you must:

1. Identify the most likely specific product they had given their profile
2. Find a realistic 2020-2024 replacement price
3. Suggest related items they likely also had with that item
4. Generate a 3-tier bundle

PRICING RULES:
- Use real 2020-2024 retail prices only
- For this family: always suggest mid-to-high end versions
- Never suggest used or refurbished items
- Never suggest an item that came out after June 30 2024
- Prices must be defensible to an insurance adjuster

BUNDLE TIER RULES:
- Essential: the primary item + 2-3 obvious accessories
- Complete: Essential + more related items that naturally go with it (6-10 items) as relevant
- Full: Complete + premium additions, multiples, or luxury versions (8-14 items)

Each tier must be CUMULATIVE — Complete contains all Essential items plus new ones. Full contains all Complete items plus new ones.

IMPORTANT:
- No item should exceed $1,500 unless it's a major appliance or high-end electronics
- Add realistic quantities (a family of 4 with guests would have 8-12 coffee mugs)
- Think about what ELSE is in the same physical space (coffee mugs live near an espresso machine)

Respond ONLY with valid JSON. No markdown. No explanation. Just the JSON object.

JSON FORMAT:
{
  "bundle_name": "Espresso & Coffee Setup",
  "bundle_description": "Professional espresso and coffee station",
  "primary_item": {
    "description": "La Marzocco Linea Mini espresso machine",
    "brand": "La Marzocco",
    "price": 5500,
    "category": "Appliances"
  },
  "tiers": {
    "essential": {
      "total": 6200,
      "items": [
        {
          "description": "La Marzocco Linea Mini",
          "brand": "La Marzocco",
          "unit_cost": 5500,
          "qty": 1,
          "category": "Appliances"
        }
      ]
    },
    "complete": {
      "total": 9800,
      "items": []
    },
    "full": {
      "total": 14500,
      "items": []
    }
  }
}
`.trim();

function stripJsonFence(text: string): string {
  return text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
}

function parseBundleJson(text: string): SmartItemRequestBundleJson {
  let clean = stripJsonFence(text);
  const start = clean.indexOf("{");
  const end = clean.lastIndexOf("}");
  if (start >= 0 && end > start) clean = clean.slice(start, end + 1);
  const bundle = JSON.parse(clean) as SmartItemRequestBundleJson;
  if (!bundle?.tiers?.essential || !bundle?.tiers?.complete || !bundle?.tiers?.full) {
    throw new Error("Missing tiers in response");
  }
  if (!bundle.bundle_name || typeof bundle.bundle_name !== "string") {
    throw new Error("Missing bundle_name");
  }
  return bundle;
}

async function callClaude(room: string, request: string, existingLines: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 28_000);

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
        max_tokens: 4000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Room: ${room}

Client says: "${request}"

Existing items in this room:
${existingLines}

Generate a bundle for what they described.
Remember to include related items they likely had with this item.`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API ${response.status}: ${errText.slice(0, 200)}`);
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
      request?: string;
      room?: string;
      existingItems?: ClaimItem[];
      sessionId?: string;
    };

    const requestText = typeof body.request === "string" ? body.request.trim() : "";
    const room = typeof body.room === "string" ? body.room.trim() : "";
    const sessionId = typeof body.sessionId === "string" ? body.sessionId : "trial";
    const existingItems = Array.isArray(body.existingItems) ? body.existingItems : [];

    if (!requestText || !room) {
      return NextResponse.json({ success: false, error: "request and room are required" }, { status: 400 });
    }

    const existingLines = existingItems
      .slice(0, 20)
      .map((i) => `- ${i.description} $${i.unit_cost}`)
      .join("\n");

    let text: string;
    try {
      text = await callClaude(room, requestText, existingLines || "(none listed)");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Claude request failed";
      return NextResponse.json({ success: false, error: msg }, { status: 502 });
    }

    let bundle: SmartItemRequestBundleJson;
    try {
      bundle = parseBundleJson(text);
    } catch {
      try {
        text = await callClaude(room, requestText, existingLines || "(none listed)");
        bundle = parseBundleJson(text);
      } catch (e2) {
        const msg = e2 instanceof Error ? e2.message : "Invalid JSON from model";
        return NextResponse.json({ success: false, error: msg }, { status: 422 });
      }
    }

    const { error: insErr } = await supabaseAdmin.from("client_suggestions").insert({
      room,
      message: requestText,
      status: "generated",
      admin_response: JSON.stringify(bundle),
    });

    if (insErr) {
      console.warn("smart-item-request: client_suggestions insert", insErr.message);
    }

    void sessionId;

    return NextResponse.json({ success: true, bundle });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
