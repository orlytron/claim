import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ClaimItem, LifestyleProfile, RoomContext, TierSuggestion } from "../../lib/types";

function buildSystemPrompt(): string {
  return `You are an insurance claim upgrade specialist.
You suggest like-kind-and-quality replacements for personal property items in luxury insurance claims.

Each tier must include plausibility and plausibility_reason for backend storage only — never user-facing difficulty or narrative text.

UPGRADE MULTIPLE = suggested price / original price

All suggestions must:
- Be the same item category (sofa stays sofa)
- Be available for purchase before Jan 1 2025
- Match the lifestyle profile AND the room context provided
- Have real brand names and real market prices
- Be specific: brand + model + material + origin

IMPORTANT: Match suggestions to the room occupant and type.
For children's rooms (kids_bedroom), suggest age-appropriate items — NOT luxury Italian designer furniture.
For shared/master bathrooms, suggest quality but functional items.
For garage/outdoor, suggest durable and activity-appropriate items.

Return ONLY a raw JSON array of exactly 4 objects.
One object per tier: keep, entry, mid, premium.
No markdown. No backticks. Just the array.`;
}

function buildUserMessage(
  item: ClaimItem,
  profile: LifestyleProfile | null,
  roomBudget: number,
  roomContext: RoomContext | null
): string {
  const furnitureBrands = profile?.suggested_brands?.furniture?.join(", ") ?? "not specified";
  const prioritize = profile?.prioritize?.join(", ") ?? "not specified";
  const avoid = profile?.avoid?.join(", ") ?? "not specified";

  const contextLine = roomContext
    ? `Room context: ${roomContext.type} — occupant: ${roomContext.occupant}`
    : "";

  return `Item: ${item.description}${item.brand ? ` by ${item.brand}` : ""}
Original price: $${item.unit_cost}
Room: ${item.room}
Quantity: ${item.qty}
Room budget: $${roomBudget}
${contextLine}

Lifestyle profile:
- Design tier: ${profile?.design_tier ?? "not specified"}
- Aesthetic: ${profile?.aesthetic ?? "not specified"}
- Prioritize: ${prioritize}
- Avoid: ${avoid}
- Suggested furniture brands: ${furnitureBrands}

Generate 4 upgrade tiers for this item.
Keep tier must use the original item details (brand: "${item.brand || "unknown"}", unit_cost: ${item.unit_cost}).
Each higher tier must be a genuinely better version of the same item type, matching the lifestyle profile and room context.`;
}

export async function POST(request: NextRequest) {
  try {
    const { item, lifestyle_profile, room_budget, room_context } = (await request.json()) as {
      item: ClaimItem;
      lifestyle_profile: LifestyleProfile | null;
      room_budget: number;
      room_context?: RoomContext | null;
    };

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: buildSystemPrompt(),
      messages: [
        {
          role: "user",
          content: buildUserMessage(item, lifestyle_profile, room_budget, room_context ?? null),
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

    const tiers = JSON.parse(rawText) as TierSuggestion[];

    if (!Array.isArray(tiers) || tiers.length === 0) {
      return NextResponse.json({ error: "Invalid tier array" }, { status: 500 });
    }

    return NextResponse.json(tiers);
  } catch (err) {
    console.error("generate-tiers error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate tiers" },
      { status: 500 }
    );
  }
}
