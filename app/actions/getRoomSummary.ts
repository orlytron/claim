"use server";

import Anthropic from "@anthropic-ai/sdk";
import { RoomSummary, saveSession } from "../lib/session";

export async function getRoomSummary(fullText: string): Promise<RoomSummary[]> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1024,
    system: `You are an insurance claim parser. Extract only a room-by-room summary from this claim. Return ONLY a valid JSON array with no other text, no markdown, no backticks. Each object must have exactly these keys:
room (string), item_count (number), subtotal (number).
Return only the raw JSON array.`,
    messages: [
      {
        role: "user",
        content: `Here is the extracted text from an insurance claim PDF. Return a room-by-room summary:\n\n${fullText}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    throw new Error("Unexpected response type from Claude API");
  }

  let rawText = content.text.trim();

  if (rawText.startsWith("```")) {
    rawText = rawText.replace(/^```[a-z]*\n?/, "").replace(/```$/, "").trim();
  }

  let summary: RoomSummary[];
  try {
    summary = JSON.parse(rawText) as RoomSummary[];
  } catch {
    console.error("Failed to parse room summary:", rawText);
    throw new Error("Failed to parse room summary. Claude returned: " + rawText.substring(0, 200));
  }

  if (!Array.isArray(summary)) {
    throw new Error("Claude did not return a JSON array for room summary");
  }

  // Persist Phase 1 result to Supabase immediately
  await saveSession({ room_summary: summary, status: "parsing" });

  return summary;
}
