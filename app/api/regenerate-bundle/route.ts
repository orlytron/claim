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

interface Bundle {
  room: string;
  bundle_code: string;
  name: string;
  description: string;
  tier: string;
  total_value: number;
  plausibility: "green" | "yellow" | "red";
  items: BundleItem[];
}

const SYSTEM_PROMPT = `You are an insurance claim specialist helping adjust a personal property bundle for a luxury home in Pacific Palisades, CA.

The client has a specific taste profile:
- Design tier: High-end modern / Italian / British luxury
- Aesthetic: Warm modern, natural materials, ceramics
- Professional: Entertainment industry, Emmy and Golden Globe winner, video production
- Active lifestyle: surfing, tennis, cycling, golf, beach

You will receive a bundle of items and client feedback. Regenerate the bundle respecting the feedback while:
- Keeping the same total value (within 10%)
- Keeping the same room and category focus
- Including a plausibility code for internal database storage only (not user-facing)
- All items must be available before Jan 1 2025
- Keep items the client said they liked
- Replace items the client said to change

Return ONLY a raw JSON object with these exact keys:
{
  "name": "string",
  "description": "string",
  "total_value": number,
  "plausibility": "green" | "yellow" | "red",
  "items": [
    {
      "description": "string",
      "brand": "string",
      "qty": number,
      "unit_cost": number,
      "total": number,
      "category": "string"
    }
  ]
}`;

export async function POST(request: NextRequest) {
  try {
    const { bundle, note } = (await request.json()) as {
      bundle: Bundle;
      note: string;
    };

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Original bundle: ${JSON.stringify(bundle, null, 2)}

Client feedback: "${note}"

Regenerate this bundle based on the feedback.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "Unexpected response type" }, { status: 500 });
    }

    let raw = content.text.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```[a-z]*\n?/, "").replace(/```$/, "").trim();
    }

    const revised = JSON.parse(raw);
    return NextResponse.json(revised);
  } catch (err) {
    console.error("regenerate-bundle error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to regenerate" },
      { status: 500 }
    );
  }
}
