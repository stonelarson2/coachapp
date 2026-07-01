// Pure helpers for computing food-logging adherence, streaks, and weekly recaps
// from a user's food log entries. No Firestore access here — callers pass in the
// entries (typically from useFoodLogRange) so these stay easy to test and reuse.

import type { FoodLogEntry, MacroTargets } from "@/lib/types";
import { addDays, todayISO } from "@/lib/units";

export interface DayTotals {
  date: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

/** Sum a user's food entries per calendar day. */
export function totalsByDay(entries: FoodLogEntry[]): Map<string, DayTotals> {
  const map = new Map<string, DayTotals>();
  for (const e of entries) {
    const d = map.get(e.date) ?? {
      date: e.date,
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
    };
    d.calories += e.calories;
    d.proteinG += e.proteinG;
    d.carbsG += e.carbsG;
    d.fatG += e.fatG;
    map.set(e.date, d);
  }
  return map;
}

export interface AdherenceResult {
  /** Overall 0-100 adherence score. */
  score: number;
  windowDays: number;
  daysLogged: number;
  /** Fraction of the window with at least one logged food (0-1). */
  loggingRate: number;
  /** Fraction of the window within ±15% of the calorie target (undefined if no target). */
  calorieHitRate?: number;
  /** Fraction of the window hitting ≥90% of the protein target (undefined if no target). */
  proteinHitRate?: number;
}

const CAL_TOLERANCE = 0.15; // within ±15% of target counts as a hit
const PROTEIN_FLOOR = 0.9; // ≥90% of protein target counts as a hit

/**
 * Adherence score over `windowDays`. When targets are provided the score blends
 * three equally-weighted components measured across the whole window (an unlogged
 * day counts as a miss for every component):
 *   - logging consistency
 *   - calories within ±15% of target
 *   - protein at ≥90% of target
 * Without targets it is purely logging consistency.
 */
export function computeAdherence(
  entries: FoodLogEntry[],
  windowDays: number,
  calorieTarget?: number,
  macroTargets?: MacroTargets,
): AdherenceResult {
  const byDay = totalsByDay(entries);
  const daysLogged = byDay.size;
  const loggingRate = windowDays > 0 ? Math.min(daysLogged / windowDays, 1) : 0;

  const hasTargets = !!calorieTarget && !!macroTargets?.proteinG;
  if (!hasTargets) {
    return {
      score: Math.round(loggingRate * 100),
      windowDays,
      daysLogged,
      loggingRate,
    };
  }

  let calHits = 0;
  let proteinHits = 0;
  for (const day of byDay.values()) {
    if (Math.abs(day.calories - calorieTarget!) / calorieTarget! <= CAL_TOLERANCE) calHits++;
    if (day.proteinG >= PROTEIN_FLOOR * macroTargets!.proteinG) proteinHits++;
  }
  const calorieHitRate = windowDays > 0 ? calHits / windowDays : 0;
  const proteinHitRate = windowDays > 0 ? proteinHits / windowDays : 0;

  const score = Math.round(
    ((loggingRate + calorieHitRate + proteinHitRate) / 3) * 100,
  );
  return {
    score,
    windowDays,
    daysLogged,
    loggingRate,
    calorieHitRate,
    proteinHitRate,
  };
}

/** A qualitative band + color token for an adherence score. */
export function adherenceBand(score: number): {
  label: string;
  color: "green" | "amber" | "red" | "gray";
} {
  if (score >= 80) return { label: "On track", color: "green" };
  if (score >= 50) return { label: "Slipping", color: "amber" };
  if (score > 0) return { label: "At risk", color: "red" };
  return { label: "No data", color: "gray" };
}

/**
 * Current consecutive-day logging streak ending today (or yesterday, so the
 * streak doesn't read as "broken" before the client has logged today).
 */
export function loggingStreak(loggedDates: Set<string>): number {
  let cursor = todayISO();
  if (!loggedDates.has(cursor)) cursor = addDays(cursor, -1);
  let streak = 0;
  while (loggedDates.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

export interface WeeklyRecap {
  daysLogged: number;
  avgCalories: number;
  avgProtein: number;
  /** Days (of 7) that hit ≥90% of the protein target, or undefined if no target. */
  proteinDaysHit?: number;
  /** Days (of 7) within ±15% of the calorie target, or undefined if no target. */
  calorieDaysHit?: number;
}

/** Summarize the last 7 days of food logs for a client-facing recap. */
export function weeklyRecap(
  entries: FoodLogEntry[],
  calorieTarget?: number,
  macroTargets?: MacroTargets,
): WeeklyRecap {
  const byDay = totalsByDay(entries);
  const days = [...byDay.values()];
  const daysLogged = days.length;
  const div = daysLogged || 1;
  const sumCal = days.reduce((s, d) => s + d.calories, 0);
  const sumPro = days.reduce((s, d) => s + d.proteinG, 0);

  const recap: WeeklyRecap = {
    daysLogged,
    avgCalories: Math.round(sumCal / div),
    avgProtein: Math.round(sumPro / div),
  };
  if (calorieTarget) {
    recap.calorieDaysHit = days.filter(
      (d) => Math.abs(d.calories - calorieTarget) / calorieTarget <= CAL_TOLERANCE,
    ).length;
  }
  if (macroTargets?.proteinG) {
    recap.proteinDaysHit = days.filter(
      (d) => d.proteinG >= PROTEIN_FLOOR * macroTargets.proteinG,
    ).length;
  }
  return recap;
}
