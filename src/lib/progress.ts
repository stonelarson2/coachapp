// Aggregation helpers for the Progress tab (pure functions).
import { addDays } from "./units";
import type { FoodLogEntry, WeightEntry } from "./types";

export interface DailyTotals {
  date: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  logged: boolean;
}

/** Build a zero-filled per-day series of `days` entries starting at `startISO`. */
export function buildDailySeries(
  entries: FoodLogEntry[],
  startISO: string,
  days: number,
): DailyTotals[] {
  const byDate = new Map<string, DailyTotals>();
  for (let i = 0; i < days; i++) {
    const date = addDays(startISO, i);
    byDate.set(date, {
      date,
      calories: 0,
      proteinG: 0,
      carbsG: 0,
      fatG: 0,
      logged: false,
    });
  }
  for (const e of entries) {
    const d = byDate.get(e.date);
    if (!d) continue;
    d.calories += e.calories;
    d.proteinG += e.proteinG;
    d.carbsG += e.carbsG;
    d.fatG += e.fatG;
    d.logged = true;
  }
  return Array.from(byDate.values());
}

/** Average calories/macros across only the days that have logged food. */
export function dailyAverages(series: DailyTotals[]) {
  const loggedDays = series.filter((d) => d.logged);
  const n = loggedDays.length || 1;
  const sum = loggedDays.reduce(
    (a, d) => ({
      calories: a.calories + d.calories,
      proteinG: a.proteinG + d.proteinG,
      carbsG: a.carbsG + d.carbsG,
      fatG: a.fatG + d.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  );
  return {
    loggedDays: loggedDays.length,
    calories: Math.round(sum.calories / n),
    proteinG: Math.round(sum.proteinG / n),
    carbsG: Math.round(sum.carbsG / n),
    fatG: Math.round(sum.fatG / n),
  };
}

/** Total grams of each macro across a window (for the breakdown chart). */
export function macroTotals(series: DailyTotals[]) {
  return series.reduce(
    (a, d) => ({
      proteinG: a.proteinG + d.proteinG,
      carbsG: a.carbsG + d.carbsG,
      fatG: a.fatG + d.fatG,
    }),
    { proteinG: 0, carbsG: 0, fatG: 0 },
  );
}

/**
 * Weight change over the trailing `days` window: latest weight minus the
 * earliest weight recorded within the window. Returns null if <2 points.
 */
export function weightChangeOverWindow(
  entries: WeightEntry[],
  fromISO: string,
): number | null {
  const within = entries.filter((e) => e.date >= fromISO);
  if (within.length < 2) return null;
  const sorted = [...within].sort((a, b) => a.date.localeCompare(b.date));
  return sorted[sorted.length - 1].weightKg - sorted[0].weightKg;
}
