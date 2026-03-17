import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const PROMPT = `You are an insurance claim extractor. 
Extract every single line item from this PDF.

The PDF has items organized by room with these columns:
Description | Qty | Estimate Amount | Taxes | 
Replacement Cost Total | Age | Condition | Depreciation

CRITICAL RULES:
1. unit_cost = Estimate Amount DIVIDED by Qty
   Example: 8 chairs, Estimate Amount $6400 = $800 each
2. Extract every item from every room
3. Do not skip any items
4. Do not include subtotal or summary rows
5. Room name comes from the section header above the items

Return ONLY a raw JSON array. No markdown. No backticks.
No explanation. Just the JSON array starting with [ 

Each object:
{
  room: string,
  description: string,
  brand: string,
  model: string,
  qty: number,
  age_years: number,
  age_months: number,
  condition: string,
  unit_cost: number,
  category: string
}`;

/**
 * Scan accumulated text for complete top-level JSON objects.
 * Correctly handles { } and " characters inside string values.
 * Returns all complete objects found and the unconsumed remainder.
 */
function extractCompleteObjects(text: string): { objects: unknown[]; remaining: string } {
  const objects: unknown[] = [];
  let i = 0;
  let objectStart = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  while (i < text.length) {
    const ch = text[i];

    if (escaped) {
      escaped = false;
    } else if (inString) {
      if (ch === "\\") escaped = true;
      else if (ch === '"') inString = false;
    } else {
      if (ch === '"') {
        inString = true;
      } else if (objectStart === -1) {
        if (ch === "{") {
          objectStart = i;
          depth = 1;
        }
      } else {
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) {
            const raw = text.slice(objectStart, i + 1);
            try {
              objects.push(JSON.parse(raw));
            } catch {
              // malformed — skip and keep scanning
            }
            objectStart = -1;
          }
        }
      }
    }
    i++;
  }

  const remaining = objectStart !== -1 ? text.slice(objectStart) : "";
  return { objects, remaining };
}

export async function POST(request: NextRequest) {
  const { base64Data } = await request.json();

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const claudeStream = await client.messages.stream({
          model: "claude-sonnet-4-6",
          max_tokens: 8096,
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
                { type: "text", text: PROMPT },
              ],
            },
          ],
        });

        let buffer = "";

        for await (const event of claudeStream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            buffer += event.delta.text;
            const { objects, remaining } = extractCompleteObjects(buffer);
            buffer = remaining;

            for (const obj of objects) {
              controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
            }
          }
        }

        controller.close();
      } catch (err) {
        controller.error(err);
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
