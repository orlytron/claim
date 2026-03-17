import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

interface BundleItem {
  description: string;
  brand: string;
  qty: number;
  unit_cost: number;
  total: number;
  category: string;
}

const ISRAEL_PROFILE = {
  design_tier: "High-end modern / Italian / British luxury",
  aesthetic: "Warm modern, natural materials, ceramics, curated not decorated",
  active_lifestyle: ["surfing", "tennis", "cycling", "golf", "swimming", "basketball", "beach"],
  professional: "Entertainment industry — Emmy and Golden Globe winner, video production",
  avoid: ["mass market", "big box", "matching sets", "generic brands"],
  prioritize: ["Italian furniture", "gallery art", "craft ceramics", "designer lighting", "signed pieces"],
};

export async function POST(request: NextRequest) {
  try {
    const { item, room, bundle_total } = (await request.json()) as {
      item: BundleItem;
      room: string;
      bundle_total: number;
    };

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are an insurance claim specialist for a luxury home in Pacific Palisades, CA.
You suggest like-kind replacements for personal property items.

Client profile: ${JSON.stringify(ISRAEL_PROFILE)}

Return ONLY a raw JSON array of exactly 3 alternative items at similar price points (within 20% of original price) for the same category.
No markdown, no backticks, just the array.

Each item:
{
  "description": "string",
  "brand": "string",
  "qty": number,
  "unit_cost": number,
  "total": number,
  "category": "string"
}`,
      messages: [
        {
          role: "user",
          content: `Suggest 3 alternatives for this item:
Item: ${item.description}
Brand: ${item.brand}
Category: ${item.category}
Qty: ${item.qty}
Unit cost: $${item.unit_cost}
Room: ${room}
Bundle total: $${bundle_total}

The alternatives should be the same category, similar price range ($${Math.round(item.unit_cost * 0.8)}–$${Math.round(item.unit_cost * 1.2)}), and match the client's luxury taste profile.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
    }

    let raw = content.text.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```[a-z]*\n?/, "").replace(/```$/, "").trim();
    }

    const alternatives = JSON.parse(raw) as BundleItem[];
    return NextResponse.json(alternatives);
  } catch (err) {
    console.error("swap-item error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get alternatives" },
      { status: 500 }
    );
  }
}
