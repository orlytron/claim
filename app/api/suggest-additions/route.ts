import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ClaimItem, LifestyleProfile, TierSuggestion } from "../../lib/types";

export async function POST(request: NextRequest) {
  try {
    const {
      room,
      room_budget,
      current_room_total,
      existing_items,
      lifestyle_profile,
      category,
      custom_request,
    } = (await request.json()) as {
      room: string;
      room_budget: number;
      current_room_total: number;
      existing_items: ClaimItem[];
      lifestyle_profile: LifestyleProfile | null;
      category: string;
      custom_request: string;
    };

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const remaining = room_budget - current_room_total;
    const existingList = existing_items
      .map((i) => `- ${i.description}${i.brand ? ` (${i.brand})` : ""}`)
      .join("\n");

    const requestText = custom_request || `${category} items for ${room}`;

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are an insurance claim specialist suggesting like-kind additions to a personal property claim.
Return ONLY a raw JSON array of exactly 3 objects at low, mid, and high price points.
Each object must match this structure exactly:
{
  "tier": "mid",
  "label": string,
  "brand": string,
  "model": string,
  "material": string,
  "origin": string,
  "vendor": string,
  "vendor_url": string,
  "unit_cost": number,
  "plausibility": "green" | "yellow" | "red",
  "plausibility_reason": string,
  "adjuster_narrative": string,
  "upgrade_multiple": 1
}
No markdown. No backticks. Just the array.`,
      messages: [
        {
          role: "user",
          content: `Room: ${room}
Room budget: $${room_budget}
Current room total: $${current_room_total}
Remaining budget: $${remaining}

Existing items:
${existingList}

Lifestyle profile:
- Design tier: ${lifestyle_profile?.design_tier ?? "not specified"}
- Aesthetic: ${lifestyle_profile?.aesthetic ?? "not specified"}
- Prioritize: ${lifestyle_profile?.prioritize?.join(", ") ?? "not specified"}

Request: ${requestText}

Suggest 3 specific ${category || "addition"} items at low, mid, and high price points that would be found in a ${room} matching this lifestyle profile. Items must be real products available before Jan 1 2025.`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== "text") {
      return NextResponse.json({ error: "Unexpected response type" }, { status: 500 });
    }

    let rawText = content.text.trim();
    if (rawText.startsWith("```")) {
      rawText = rawText.replace(/^```[a-z]*\n?/, "").replace(/```$/, "").trim();
    }

    const suggestions = JSON.parse(rawText) as TierSuggestion[];
    return NextResponse.json(suggestions);
  } catch (err) {
    console.error("suggest-additions error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate suggestions" },
      { status: 500 }
    );
  }
}
