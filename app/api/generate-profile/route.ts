import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { ClaimItem, LifestyleProfile } from "../../lib/types";

export async function POST(request: NextRequest) {
  try {
    const { items } = (await request.json()) as { items: ClaimItem[] };

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const itemList = items
      .slice(0, 80)
      .map((i) => `- ${i.description}${i.brand ? ` (${i.brand})` : ""}, $${i.unit_cost}, ${i.room}`)
      .join("\n");

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: `You are a luxury lifestyle analyst. Analyze this list of personal property items and determine the lifestyle profile of the owner.

Return ONLY a raw JSON object matching this exact structure. No markdown. No backticks. Just JSON.

{
  "design_tier": string,
  "aesthetic": string,
  "art_engagement": string,
  "active_lifestyle": string[],
  "professional": string,
  "avoid": string[],
  "prioritize": string[],
  "suggested_brands": {
    "furniture": string[],
    "lighting": string[],
    "kitchen": string[],
    "art": string[],
    "outdoor": string[],
    "textiles": string[]
  }
}`,
      messages: [
        {
          role: "user",
          content: `Analyze these personal property items and return the owner's lifestyle profile:\n\n${itemList}`,
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

    const profile = JSON.parse(rawText) as LifestyleProfile;
    return NextResponse.json(profile);
  } catch (err) {
    console.error("generate-profile error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate profile" },
      { status: 500 }
    );
  }
}
