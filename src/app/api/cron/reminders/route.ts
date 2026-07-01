import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import {
  sendLogFoodReminderEmail,
  sendWeighInReminderEmail,
} from "@/lib/email";
import type { UserDoc } from "@/lib/types";

export const runtime = "nodejs";
// Reminders read every client — don't cache; always run fresh.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** YYYY-MM-DD for `d` in UTC. Cron runs at ~evening US time so UTC ≈ client-local date. */
function isoUTC(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Daily reminder cron (wired via vercel.json). Every run nudges clients who
 * haven't logged food today; on Sundays it also nudges clients who haven't
 * weighed in for a week. Secured with CRON_SECRET (Vercel sends it as a Bearer
 * token automatically; a manual call must supply the same token).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 },
    );
  }
  if (req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = getAdminDb();
  const now = new Date();
  const today = isoUTC(now);
  const weekAgo = isoUTC(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  const isWeeklyDay = now.getUTCDay() === 0; // Sunday

  const snap = await db.collection("users").where("role", "==", "client").get();

  let foodSent = 0;
  let weighSent = 0;
  let skipped = 0;

  for (const docSnap of snap.docs) {
    const client = docSnap.data() as UserDoc;
    if (client.isExample || !client.email) {
      skipped++;
      continue;
    }

    // Food: no food logged today → nudge.
    const foodToday = await db
      .collection("foodLogs")
      .where("userId", "==", client.uid)
      .where("date", "==", today)
      .limit(1)
      .get();
    if (foodToday.empty) {
      if (await sendLogFoodReminderEmail(client.email, client.name)) foodSent++;
    }

    // Weight: only on the weekly day, and only if none in the last 7 days.
    if (isWeeklyDay) {
      const recentWeight = await db
        .collection("weightEntries")
        .where("userId", "==", client.uid)
        .where("date", ">=", weekAgo)
        .limit(1)
        .get();
      if (recentWeight.empty) {
        if (await sendWeighInReminderEmail(client.email, client.name)) weighSent++;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    date: today,
    clients: snap.size,
    foodReminders: foodSent,
    weighInReminders: weighSent,
    skipped,
  });
}
