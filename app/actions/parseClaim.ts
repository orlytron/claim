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

function buildRoomPrompt(roomName: string): string {
  return (
    `Extract ONLY the line items from the room called '${roomName}' from this insurance claim PDF. ` +
    `Return ONLY a valid JSON array. Each object must have: room, description, brand, model, qty, ` +
    `age_years, age_months, condition, unit_cost, category. ` +
    `Calculate unit_cost as total estimate amount divided by qty. ` +
    `Return empty array [] if no items found for this room.`
  );
}

async function callClaudeForRoom(
  client: Anthropic,
  base64Data: string,
  roomName: string
): Promise<ClaimItem[]> {
  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
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
            text: buildRoomPrompt(roomName),
          },
        ],
      },
    ],
  });

  const content = response.content[0];
  if (content.type !== "text") {
    console.error(`Unexpected non-text response for room: ${roomName}`);
    return [];
  }

  let rawText = content.text.trim();

  if (rawText.startsWith("```")) {
    rawText = rawText.replace(/^```[a-z]*\n?/, "").replace(/```$/, "").trim();
  }

  console.log(`Claude response for room "${roomName}":`, rawText.substring(0, 200));

  if (rawText === "[]" || rawText === "") {
    return [];
  }

  let items: ClaimItem[];
  try {
    items = JSON.parse(rawText) as ClaimItem[];
  } catch {
    console.error(
      `Failed to parse Claude response for room "${roomName}":`,
      rawText.substring(0, 200)
    );
    return [];
  }

  if (!Array.isArray(items)) {
    console.error(`Claude returned non-array for room "${roomName}", skipping`);
    return [];
  }

  return items;
}

/** Extract line items for a single room. Used by the client for per-room progress updates. */
export async function parsePdfRoom(
  base64Data: string,
  roomName: string
): Promise<ClaimItem[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return callClaudeForRoom(client, base64Data, roomName);
}

/** Extract all line items by iterating over every room in sequence. */
export async function parsePdf(
  base64Data: string,
  rooms: string[]
): Promise<ClaimItem[]> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const allItems: ClaimItem[] = [];

  for (const room of rooms) {
    const roomItems = await callClaudeForRoom(client, base64Data, room);
    allItems.push(...roomItems);
  }

  return allItems;
}
