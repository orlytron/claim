"use server";

import Anthropic from "@anthropic-ai/sdk";

export interface ClaimItem {
  room: string;
  description: string;
  brand: string;
  model: string;
  qty: number;
  age_years: number;
  age_months: number;
  condition: string;
  unit_cost: number;
  category: string;
}

const SYSTEM_PROMPT = `You are an insurance claim parser. Extract all line items from this insurance claim PDF. Return ONLY a valid JSON array with no other text, no markdown, no backticks. Each object must have these exact keys:
room, description, brand, model, qty, age_years, age_months, condition, unit_cost, category

The 'Estimate Amount' column in this PDF is the TOTAL cost for all units of that item combined. Calculate unit_cost as: Estimate Amount divided by Qty. For example if Estimate Amount is $6400 and Qty is 8, unit_cost should be $800.

For any field not clearly present use these defaults: model = empty string, brand = empty string, age_years = 0, age_months = 0, condition = Average, category = empty string.

Return only the raw JSON array, nothing else.`;

export async function parsePdf(base64Data: string): Promise<ClaimItem[]> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: base64Data,
            },
          },
          {
            type: "text",
            text: "Extract all line items from this insurance claim PDF as instructed.",
          },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    console.error("Unexpected non-text response from Claude");
    return [];
  }

  let rawText = content.text.trim();

  if (rawText.startsWith("```")) {
    rawText = rawText.replace(/^```[a-z]*\n?/, "").replace(/```$/, "").trim();
  }

  console.log("Claude raw response:", rawText);

  if (rawText === "[]" || rawText === "") {
    return [];
  }

  let items: ClaimItem[];
  try {
    items = JSON.parse(rawText) as ClaimItem[];
  } catch (e) {
    console.error("Failed to parse Claude response, skipping:", rawText.substring(0, 200));
    return [];
  }

  if (!Array.isArray(items)) {
    console.error("Claude returned non-array, skipping");
    return [];
  }

  return items;
}
