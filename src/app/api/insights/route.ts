import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyRequest } from "@/lib/server-auth";
import {
  buildDailySeries,
  dailyAverages,
  weightChangeOverWindow,
} from "@/lib/progress";
import { addDays, formatWeight, toISODate } from "@/lib/units";
import { aiErrorResponse, aiNotConfigured } from "@/lib/aiError";
import type { FoodLogEntry, InsightPeriod, UserDoc, WeightEntry } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const PERIOD_DAYS: Record<InsightPeriod, number> = {
  week: 7,
  "2weeks": 14,
  month: 30,
};

const PERIOD_LABEL: Record<InsightPeriod, string> = {
  week: "past week",
  "2weeks": "past 2 weeks",
  month: "past month",
};

interface Body {
  clientId: string;
  period: InsightPeriod;
}

export async function POST(req: Request) {
  let decoded;
  try {
    decoded = await verifyRequest(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return aiNotConfigured("insights");

  const body = (await req.json().catch(() => ({}))) as Body;
  const period = body.period in PERIOD_DAYS ? body.period : "week";
  const clientId = body.clientId;
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required" }, { status: 400 });
  }

  const adminDb = getAdminDb();
  const clientSnap = await adminDb.collection("users").doc(clientId).get();
  if (!clientSnap.exists) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  const client = clientSnap.data() as UserDoc;

  // Authorize: the client themselves, or their coach.
  const isSelf = decoded.uid === clientId;
  const isCoach = client.coachId === decoded.uid;
  if (!isSelf && !isCoach) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const days = PERIOD_DAYS[period];
  const startISO = addDays(toISODate(new Date()), -(days - 1));

  // Gather data within the window.
  const [weightSnap, foodSnap] = await Promise.all([
    adminDb.collection("weightEntries").where("userId", "==", clientId).get(),
    adminDb
      .collection("foodLogs")
      .where("userId", "==", clientId)
      .where("date", ">=", startISO)
      .get(),
  ]);
  const weights = weightSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as WeightEntry);
  const foods = foodSnap.docs.map((d) => ({ id: d.id, ...d.data() }) as FoodLogEntry);

  const series = buildDailySeries(foods, startISO, days);
  const avg = dailyAverages(series);
  const weightChangeKg = weightChangeOverWindow(weights, startISO);
  const unit = client.weightUnit ?? "lb";

  const start = client.startWeightKg ?? client.profile?.weightKg ?? 0;
  const current = client.currentWeightKg ?? start;

  // Build a compact data summary for the model.
  const summary = [
    `Client goal: ${client.goal?.type ?? "maintain"}` +
      (client.goal && client.goal.type !== "maintain"
        ? ` at ${formatWeight(client.goal.targetRatePerWeekKg, unit)}/week`
        : ""),
    `Calorie target: ${client.calorieTarget ?? "not set"} kcal/day`,
    client.macroTargets
      ? `Macro targets: ${client.macroTargets.proteinG}g protein, ${client.macroTargets.carbsG}g carbs, ${client.macroTargets.fatG}g fat`
      : "Macro targets: not set",
    `Current weight: ${formatWeight(current, unit)} (started at ${formatWeight(start, unit)})`,
    weightChangeKg == null
      ? `Weight change over ${PERIOD_LABEL[period]}: not enough weigh-ins`
      : `Weight change over ${PERIOD_LABEL[period]}: ${weightChangeKg >= 0 ? "+" : "−"}${formatWeight(Math.abs(weightChangeKg), unit)}`,
    `Days food was logged in window: ${avg.loggedDays} of ${days}`,
    `Average intake on logged days: ${avg.calories} kcal, ${avg.proteinG}g protein, ${avg.carbsG}g carbs, ${avg.fatG}g fat`,
  ].join("\n");

  const system =
    "You are an experienced, supportive fitness and nutrition coach. " +
    "Given a client's recent data, write a concise, encouraging but honest progress analysis. " +
    "Use exactly these three markdown sections with '## ' headers: " +
    "'## What went well', '## What to improve', '## Next steps'. " +
    "Use short bullet points. Reference the actual numbers. " +
    "Account for the client's goal (a cut should lose weight, a bulk should gain, maintain should hold). " +
    "If logging is sparse, gently flag that consistency limits the analysis. Keep it under 250 words.";

  const prompt = `Here is the client's data for the ${PERIOD_LABEL[period]}:\n\n${summary}\n\nWrite the analysis.`;

  try {
    const anthropic = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
    const message = await anthropic.messages.create({
      model,
      max_tokens: 1024,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    // Persist the insight (Admin bypasses the write:false rule).
    await adminDb.collection("insights").add({
      userId: clientId,
      period,
      text,
      createdAt: Date.now(),
    });

    return NextResponse.json({ text });
  } catch (err) {
    return aiErrorResponse(err, "insights");
  }
}
