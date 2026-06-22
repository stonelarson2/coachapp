import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { verifyRequest } from "@/lib/server-auth";
import { searchFoods } from "@/lib/foodSearch";
import { aiErrorResponse, aiNotConfigured } from "@/lib/aiError";

export const runtime = "nodejs";
export const maxDuration = 60;

// Two modes:
//  - "photo": one or more base64 food images (+ optional clarifications)
//  - "text":  a food description + amount/weight
// The model may call search_food_database to cross-check macros against USDA /
// Open Food Facts, then returns structured JSON via a forced record tool call.

type Mode = "photo" | "text";

interface EncodedImage {
  mediaType: string;
  data: string;
}
interface Body {
  mode?: Mode;
  // photo mode
  image?: EncodedImage; // back-compat: single image
  images?: EncodedImage[];
  clarifications?: string;
  // text mode
  description?: string;
  amount?: string;
}

const ALLOWED_MEDIA = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_IMAGES = 4;
const MAX_TURNS = 4; // model turns before we force a final answer

const SYSTEM =
  "You are a meticulous nutrition assistant that estimates the macronutrients of food. " +
  "Given a photo (or several) and/or a text description, identify each distinct food item and " +
  "estimate its weight in grams plus calories, protein, carbohydrates, and fat.\n\n" +
  "Method:\n" +
  "1. Identify each food and estimate a realistic portion size in grams from visual cues " +
  "(plate/utensil scale, container size) or the description.\n" +
  "2. For packaged, branded, or common whole foods, call search_food_database to verify the " +
  "per-100g macros against real database entries, then scale to your gram estimate. Prefer " +
  "database values over guesses when a good match exists.\n" +
  "3. Account for cooking oils, butter, sauces and dressings that are easy to miss.\n" +
  "4. When portion size or hidden ingredients are ambiguous and materially affect the numbers, " +
  "state your assumptions and ask brief, specific clarifying questions.\n\n" +
  "Always finish by calling record_food_estimate — never answer with free text.";

const SEARCH_TOOL: Anthropic.Tool = {
  name: "search_food_database",
  description:
    "Search the USDA + Open Food Facts food databases for real per-100g macros to verify an " +
    "estimate. Use a concise food name (e.g. 'grilled chicken breast', 'coca cola').",
  input_schema: {
    type: "object",
    properties: {
      query: { type: "string", description: "Food name to look up." },
    },
    required: ["query"],
  },
};

const RECORD_TOOL: Anthropic.Tool = {
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
              description: "Human-readable portion, e.g. '150 g', '1 cup', '2 slices'.",
            },
            gramsEstimate: {
              type: "number",
              description: "Estimated weight of this portion in grams (used to rescale macros).",
            },
            calories: { type: "number", description: "Calories (kcal) for the estimated portion." },
            proteinG: { type: "number", description: "Protein in grams." },
            carbsG: { type: "number", description: "Carbohydrates in grams." },
            fatG: { type: "number", description: "Fat in grams." },
          },
          required: ["name", "quantity", "gramsEstimate", "calories", "proteinG", "carbsG", "fatG"],
        },
      },
      assumptions: {
        type: "array",
        description: "Key assumptions made (portion, cooking method, added fats).",
        items: { type: "string" },
      },
      questions: {
        type: "array",
        description: "Up to 3 short clarifying questions that would most improve accuracy. Empty if confident.",
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

/** Run the model's food-database lookups and format compact results for it. */
async function runSearch(query: string): Promise<string> {
  const items = await searchFoods(query);
  if (items.length === 0) return `No database matches for "${query}".`;
  const top = items.slice(0, 4).map((f) => {
    const brand = f.brand ? ` [${f.brand}]` : "";
    const p = f.per100g;
    return `- ${f.name}${brand}: per 100g → ${Math.round(p.calories)} kcal, P ${p.proteinG}g, C ${p.carbsG}g, F ${p.fatG}g`;
  });
  return `Matches for "${query}":\n${top.join("\n")}`;
}

export async function POST(req: Request) {
  try {
    await verifyRequest(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return aiNotConfigured("food-estimate");

  const body = (await req.json().catch(() => ({}))) as Body;
  const mode: Mode = body.mode === "text" ? "text" : "photo";

  const content: Anthropic.ContentBlockParam[] = [];

  if (mode === "photo") {
    const images = (body.images ?? (body.image ? [body.image] : [])).slice(0, MAX_IMAGES);
    if (images.length === 0 || images.some((im) => !im?.data || !ALLOWED_MEDIA.has(im.mediaType))) {
      return NextResponse.json(
        { error: "At least one valid food image (jpeg, png, webp, or gif) is required." },
        { status: 400 },
      );
    }
    for (const im of images) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: im.mediaType as "image/jpeg" | "image/png" | "image/webp" | "image/gif",
          data: im.data,
        },
      });
    }
    const clarif = (body.clarifications || "").trim();
    const noun = images.length > 1 ? "these photos" : "this photo";
    content.push({
      type: "text",
      text: clarif
        ? `Estimate the macros for the food in ${noun}. The user clarified: ${clarif}`
        : `Estimate the macros for the food in ${noun}.`,
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
    const messages: Anthropic.MessageParam[] = [{ role: "user", content }];

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const lastTurn = turn === MAX_TURNS - 1;
      const message = await anthropic.messages.create({
        model,
        max_tokens: 1500,
        system: SYSTEM,
        tools: [SEARCH_TOOL, RECORD_TOOL],
        // Let the model search freely, but force the final answer on the last turn.
        tool_choice: lastTurn
          ? { type: "tool", name: RECORD_TOOL.name }
          : { type: "any" },
        messages,
      });

      const toolUses = message.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
      );
      const record = toolUses.find((b) => b.name === RECORD_TOOL.name);
      if (record) {
        return NextResponse.json(record.input);
      }

      const searches = toolUses.filter((b) => b.name === SEARCH_TOOL.name);
      if (searches.length === 0) {
        // No tool call we can act on; nudge once more or give up.
        if (lastTurn) break;
        continue;
      }

      // Run each requested search and feed the results back.
      messages.push({ role: "assistant", content: message.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const s of searches) {
        const query = (s.input as { query?: string }).query || "";
        results.push({
          type: "tool_result",
          tool_use_id: s.id,
          content: await runSearch(query),
        });
      }
      messages.push({ role: "user", content: results });
    }

    return NextResponse.json(
      { error: "The AI couldn't read that. Try a clearer photo or describe the food." },
      { status: 502 },
    );
  } catch (err) {
    return aiErrorResponse(err, "food-estimate");
  }
}
