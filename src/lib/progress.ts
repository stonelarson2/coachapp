// Aggregation helpers for the Progress tab (pure functions).
import { addDays, startOfWeekMonday, todayISO } from "./units";
import type { FoodLogEntry, MacroTargets, WeightEntry } from "./types";

const CAL_PER_G = { protein: 4, carbs: 4, fat: 9 };

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

export interface WeekSummary {
  /** Monday ISO of the week. */
  weekStart: string;
  daysLogged: number;
  /** Averages over logged days only. */
  avgCalories: number;
  avgProteinG: number;
  avgCarbsG: number;
  avgFatG: number;
  /** Weight change across the week (latest − earliest weigh-in), null if <2. */
  weightChangeKg: number | null;
}

/**
 * Summarize the last `weeks` calendar weeks (Monday-start), most-recent first.
 * Nutrition averages are over logged days only; weight change uses weigh-ins
 * that fall inside each week.
 */
export function weeklySummaries(
  foods: FoodLogEntry[],
  weights: WeightEntry[],
  weeks: number,
  todayIso: string = todayISO(),
): WeekSummary[] {
  const thisMonday = startOfWeekMonday(todayIso);
  const out: WeekSummary[] = [];
  for (let w = 0; w < weeks; w++) {
    const weekStart = addDays(thisMonday, -7 * w);
    const weekEnd = addDays(weekStart, 6);
    const series = buildDailySeries(
      foods.filter((e) => e.date >= weekStart && e.date <= weekEnd),
      weekStart,
      7,
    );
    const avg = dailyAverages(series);
    out.push({
      weekStart,
      daysLogged: avg.loggedDays,
      avgCalories: avg.calories,
      avgProteinG: avg.proteinG,
      avgCarbsG: avg.carbsG,
      avgFatG: avg.fatG,
      weightChangeKg: weightChangeOverWindow(
        weights.filter((e) => e.date >= weekStart && e.date <= weekEnd),
        weekStart,
      ),
    });
  }
  return out;
}

export interface MacroSplit {
  /** Percent of total calories from each macro (0-100). */
  proteinPct: number;
  carbsPct: number;
  fatPct: number;
}

/** Convert macro grams into their share of total calories. */
export function macroCalorieSplit(grams: {
  proteinG: number;
  carbsG: number;
  fatG: number;
}): MacroSplit | null {
  const p = grams.proteinG * CAL_PER_G.protein;
  const c = grams.carbsG * CAL_PER_G.carbs;
  const f = grams.fatG * CAL_PER_G.fat;
  const total = p + c + f;
  if (total <= 0) return null;
  return {
    proteinPct: Math.round((p / total) * 100),
    carbsPct: Math.round((c / total) * 100),
    fatPct: Math.round((f / total) * 100),
  };
}

/** The target macro split from a client's macro targets, if set. */
export function targetMacroSplit(mt?: MacroTargets): MacroSplit | null {
  if (!mt?.proteinG || !mt?.carbsG || !mt?.fatG) return null;
  return macroCalorieSplit(mt);
}
