import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyRequest } from "@/lib/server-auth";
import { formatWeight } from "@/lib/units";
import type { CheckinDoc, UserDoc } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Body {
  checkinId: string;
}

const RATING_LABELS: Record<string, string> = {
  nutrition: "Nutrition adherence",
  training: "Training/activity",
  sleep: "Sleep quality",
  energy: "Energy",
  mood: "Mood",
  stress: "Stress (1=high stress)",
};

export async function POST(req: Request) {
  let decoded;
  try {
    decoded = await verifyRequest(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI drafting is not configured (missing ANTHROPIC_API_KEY)." },
      { status: 500 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  if (!body.checkinId) {
    return NextResponse.json({ error: "checkinId is required" }, { status: 400 });
  }

  const adminDb = getAdminDb();
  const snap = await adminDb.collection("checkins").doc(body.checkinId).get();
  if (!snap.exists) {
    return NextResponse.json({ error: "Check-in not found" }, { status: 404 });
  }
  const checkin = snap.data() as CheckinDoc;

  // Only the client's coach may draft a reply.
  const clientSnap = await adminDb.collection("users").doc(checkin.userId).get();
  const client = clientSnap.data() as UserDoc | undefined;
  if (!client || client.coachId !== decoded.uid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const unit = client.weightUnit ?? "lb";
  const ratingLines = Object.entries(checkin.ratings)
    .map(([k, v]) => `- ${RATING_LABELS[k] ?? k}: ${v}/5`)
    .join("\n");

  const summary = [
    `Client: ${client.name}`,
    `Goal: ${client.goal?.type ?? "maintain"}`,
    client.calorieTarget ? `Calorie target: ${client.calorieTarget} kcal/day` : null,
    checkin.weightKg != null ? `Weight this week: ${formatWeight(checkin.weightKg, unit)}` : null,
    `Self-ratings (1-5):\n${ratingLines}`,
    checkin.notes ? `Client notes: "${checkin.notes}"` : "Client left no notes.",
  ]
    .filter(Boolean)
    .join("\n");

  const system =
    "You are an experienced, supportive 1:1 fitness coach replying to a client's weekly check-in. " +
    "Write a warm, personal, and specific reply (about 80-150 words). " +
    "Acknowledge wins, address any struggles or low ratings with practical guidance, and give 1-2 clear " +
    "action items for the coming week. Reference their actual numbers and notes. Write in first person as " +
    "the coach, ready to send. Do not use markdown headers or bullet lists — write it as a short message.";

  try {
    const anthropic = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
    const message = await anthropic.messages.create({
      model,
      max_tokens: 512,
      system,
      messages: [
        { role: "user", content: `Here is the client's check-in:\n\n${summary}\n\nDraft my reply.` },
      ],
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json(
      { error: (err as Error).message || "Failed to draft reply" },
      { status: 502 },
    );
  }
}
