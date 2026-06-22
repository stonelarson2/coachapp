import "server-only";
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

// Maps any error from an AI route to a user-safe message, while logging the
// real cause server-side (visible in Vercel logs). This keeps provider details
// — credit-balance warnings, invalid keys, raw stack traces — out of the UI,
// which is especially important since clients use the AI food estimator.

const BUSY = "The AI is busy right now — please try again in a moment.";
const UNAVAILABLE = "AI features are temporarily unavailable. Please try again later.";
const GENERIC = "Something went wrong with the AI. Please try again.";

/** Friendly message for a missing/unconfigured ANTHROPIC_API_KEY. */
export function aiNotConfigured(context: string): NextResponse {
  console.error(`[${context}] ANTHROPIC_API_KEY is not set.`);
  return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
}

/** Convert any thrown error into a safe JSON response. */
export function aiErrorResponse(err: unknown, context: string): NextResponse {
  console.error(`[${context}] AI error:`, err);

  if (err instanceof Anthropic.APIError) {
    const status = err.status;
    // Rate limited or overloaded → transient, ask the user to retry shortly.
    if (status === 429 || status === 529) {
      return NextResponse.json({ error: BUSY }, { status: 503 });
    }
    // Auth, permission, or billing/credit problems → our config, not the user's.
    if (status === 401 || status === 403 || /credit balance|billing/i.test(err.message)) {
      return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
    }
  }

  return NextResponse.json({ error: GENERIC }, { status: 502 });
}
