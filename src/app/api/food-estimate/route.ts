import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { verifyRequest } from "@/lib/server-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

// Two modes:
//  - "photo": a base64 food image (+ optional clarifications) → estimated macros + follow-up questions
//  - "text":  a food description + amount/weight → estimated macros
// Both return structured JSON via a forced tool call (reliable shape, no JSON parsing of prose).

type Mode = "photo" | "text";

interface Body {
  mode?: Mode;
  // photo mode
  image?: { mediaType: string; data: string };
  clarifications?: string;
  // text mode
  description?: string;
  amount?: string;
}

const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const SYSTEM =
  "You are a meticulous nutrition assistant that estimates the macronutrients of food. " +
  "Given a photo and/or a text description, identify each distinct food item and estimate its " +
  "calories, protein, carbohydrates, and fat. Base estimates on standard nutrition databases and " +
  "realistic portion sizes. When portion size, preparation, or hidden ingredients (oils, sauces, " +
  "dressings) are ambiguous and materially affect the numbers, state your assumptions and ask brief, " +
  "specific clarifying questions that would most improve accuracy. Prefer common household measures. " +
  "Always respond by calling the record_food_estimate tool — never with free text.";

// The tool schema is the structured output contract. Forcing this tool guarantees the response shape.
const TOOL: Anthropic.Tool = {
  name: "record_food_estimate",
  description: "Record the estimated foods and their macros, plus any clarifying questions.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        description: "One entry per distinct food item identified.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Concise food name, e.g. 'Grilled chicken breast'." },
            quantity: {
              type: "string",
              description: "Estimated portion, e.g. '150 g', '1 cup', '2 slices'.",
            },
            calories: { type: "number", description: "Calories (kcal)." },
            proteinG: { type: "number", description: "Protein in grams." },
            carbsG: { type: "number", description: "Carbohydrates in grams." },
            fatG: { type: "number", description: "Fat in grams." },
          },
          required: ["name", "quantity", "calories", "proteinG", "carbsG", "fatG"],
        },
      },
      assumptions: {
        type: "array",
        description: "Key assumptions made (portion, cooking method, added fats).",
        items: { type: "string" },
      },
      questions: {
        type: "array",
        description:
          "Up to 3 short clarifying questions that would most improve accuracy. Empty if confident.",
        items: { type: "string" },
      },
      confidence: {
        type: "string",
        enum: ["low", "medium", "high"],
        description: "Overall confidence in the estimate.",
      },
    },
    required: ["items", "assumptions", "questions", "confidence"],
  },
};

export async function POST(req: Request) {
  try {
    await verifyRequest(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI estimation is not configured (missing ANTHROPIC_API_KEY)." },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const mode: Mode = body.mode === "text" ? "text" : "photo";

  // Build the user content for the chosen mode.
  const content: Anthropic.ContentBlockParam[] = [];

  if (mode === "photo") {
    const image = body.image;
    if (!image?.data || !ALLOWED_MEDIA.has(image.mediaType)) {
      return NextResponse.json(
        { error: "A valid food image (jpeg, png, webp, or gif) is required." },
        { status: 400 },
      );
    }
    content.push({
      type: "image",
      source: {
        type: "base64",
        media_type: image.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
        data: image.data,
      },
    });
    const clarif = (body.clarifications || "").trim();
    content.push({
      type: "text",
      text: clarif
        ? `Estimate the macros for the food in this photo. The user clarified: ${clarif}`
        : "Estimate the macros for the food in this photo.",
    });
  } else {
    const description = (body.description || "").trim();
    if (!description) {
      return NextResponse.json({ error: "A food description is required." }, { status: 400 });
    }
    const amount = (body.amount || "").trim();
    content.push({
      type: "text",
      text: amount
        ? `Estimate the macros for: ${description}. Amount: ${amount}.`
        : `Estimate the macros for: ${description}.`,
    });
  }

  try {
    const anthropic = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
    const message = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system: SYSTEM,
      tools: [TOOL],
      tool_choice: { type: "tool", name: TOOL.name },
      messages: [{ role: "user", content }],
    });

    const toolBlock = message.content.find(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );
    if (!toolBlock) {
      return NextResponse.json({ error: "The model did not return an estimate." }, { status: 502 });
    }

    return NextResponse.json(toolBlock.input);
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to estimate macros" },
      { status: 502 },
    );
  }
}
