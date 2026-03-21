import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export type ParsedArtItem = {
  description: string;
  artist: string;
  medium: string;
  size: string;
  unit_cost: number;
};

const USER_PROMPT = `Parse this art inventory PDF.
Extract each artwork as a line item.
Return ONLY a JSON array, no other text.
Each object:
{
  "description": string (title or description),
  "artist": string (artist name if present),
  "medium": string (oil, print, photograph etc),
  "size": string (dimensions if present),
  "unit_cost": number (value if present, 0 if not)
}`;

export async function POST(req: NextRequest) {
  try {
    const { base64Data } = (await req.json()) as { base64Data?: string };
    if (!base64Data || typeof base64Data !== "string") {
      return NextResponse.json({ error: "Missing base64Data" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const client = new Anthropic({ apiKey });

    const pdfB64 = base64Data.replace(/^data:application\/pdf;base64,/, "").trim();

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: {
                type: "base64",
                media_type: "application/pdf",
                data: pdfB64,
              },
            },
            { type: "text", text: USER_PROMPT },
          ] as unknown as Anthropic.MessageCreateParams["messages"][number]["content"],
        },
      ],
    });

    const block = response.content[0];
    if (block.type !== "text") {
      return NextResponse.json({ error: "Unexpected response type" }, { status: 500 });
    }

    let raw = block.text.trim();
    if (raw.startsWith("```")) {
      raw = raw.replace(/^```[a-z]*\n?/, "").replace(/```$/, "").trim();
    }

    const parsed = JSON.parse(raw) as ParsedArtItem[];
    if (!Array.isArray(parsed)) {
      return NextResponse.json({ error: "Response was not an array" }, { status: 500 });
    }

    const normalized: ParsedArtItem[] = parsed.map((row) => ({
      description: String(row.description ?? "").trim() || "Untitled",
      artist: String(row.artist ?? "").trim(),
      medium: String(row.medium ?? "").trim(),
      size: String(row.size ?? "").trim(),
      unit_cost: typeof row.unit_cost === "number" && Number.isFinite(row.unit_cost) ? row.unit_cost : 0,
    }));

    return NextResponse.json(normalized);
  } catch (err) {
    console.error("parse-art-pdf:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse PDF" },
      { status: 500 }
    );
  }
}
