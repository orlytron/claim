"use server";

import Anthropic from "@anthropic-ai/sdk";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

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

function splitIntoChunks(text: string, chunkSize = 2000): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = start + chunkSize;
    if (end < text.length) {
      const newlinePos = text.lastIndexOf("\n", end);
      if (newlinePos > start) end = newlinePos + 1;
    }
    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) chunks.push(chunk);
    start = end;
  }
  return chunks;
}

export async function extractPdfText(
  formData: FormData
): Promise<{ fullText: string; chunks: string[] }> {
  const file = formData.get("pdf") as File;
  if (!file) throw new Error("No file provided");

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const loadingTask = getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText +=
      content.items
        .map((item: any) => ("str" in item ? item.str : ""))
        .join(" ") + "\n";
  }

  if (!fullText || fullText.trim().length === 0) {
    throw new Error(
      "Could not extract text from the PDF. Please ensure the file is not scanned/image-based."
    );
  }

  return { fullText, chunks: splitIntoChunks(fullText) };
}

export async function parseChunk(chunkText: string): Promise<ClaimItem[]> {
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8096,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Here is a portion of extracted text from an insurance claim PDF. Parse all line items you find:\n\n${chunkText}`,
      },
    ],
  });

  const content = message.content[0];
  if (content.type !== "text") {
    console.error("Unexpected non-text response from Claude, skipping chunk");
    return [];
  }

  let rawText = content.text.trim();

  if (rawText.startsWith("```")) {
    rawText = rawText.replace(/^```[a-z]*\n?/, "").replace(/```$/, "").trim();
  }

  console.log("Claude raw response:", rawText);

  // Empty array response — no items in this chunk, skip cleanly
  if (rawText === "[]" || rawText === "") {
    return [];
  }

  let items: ClaimItem[];
  try {
    items = JSON.parse(rawText) as ClaimItem[];
  } catch (e) {
    console.error("Failed to parse Claude response for chunk, skipping:", rawText.substring(0, 200));
    return [];
  }

  if (!Array.isArray(items)) {
    console.error("Claude returned non-array for chunk, skipping");
    return [];
  }

  return items;
}
