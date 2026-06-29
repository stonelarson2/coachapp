"use client";

import * as React from "react";
import { sumMacros, useFoodLogRange } from "@/lib/data";
import { daysAgoISO } from "@/lib/units";
import type { MacroTargets } from "@/lib/types";

const WINDOWS = [7, 14, 30] as const;
type WindowDays = (typeof WINDOWS)[number];

/**
 * Rolling multi-day food summary shown above the per-day log: how many days the
 * client logged in the window, plus average calories/macros per logged day
 * (compared to target when one is set). Helps a coach review adherence at a glance.
 */
export function FoodHistorySummary({
  userId,
  calorieTarget,
  macroTargets,
  cal,
}: {
  userId: string;
  calorieTarget?: number;
  macroTargets?: MacroTargets;
  cal: string;
}) {
  const [days, setDays] = React.useState<WindowDays>(7);
  const { entries } = useFoodLogRange(userId, daysAgoISO(days - 1));

  const stats = React.useMemo(() => {
    const loggedDates = new Set(entries.map((e) => e.date));
    const daysLogged = loggedDates.size;
    const totals = sumMacros(entries);
    const div = daysLogged || 1; // average per *logged* day, not per calendar day
    return {
      daysLogged,
      avgCalories: Math.round(totals.calories / div),
      avgProtein: Math.round(totals.proteinG / div),
      avgCarbs: Math.round(totals.carbsG / div),
      avgFat: Math.round(totals.fatG / div),
    };
  }, [entries]);

  const hasData = stats.daysLogged > 0;

  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">📊 Recent averages</span>
        <div className="ml-auto flex rounded-lg border border-gray-200 p-0.5 text-xs">
          {WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() => setDays(w)}
              className={`rounded-md px-2.5 py-1 ${
                days === w ? "bg-primary-soft text-primary-soft-fg" : "text-gray-500"
              }`}
            >
              {w}d
            </button>
          ))}
        </div>
      </div>

      {hasData ? (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <SummaryStat
              label="Days logged"
              value={`${stats.daysLogged}`}
              hint={`of ${days}`}
            />
            <SummaryStat
              label={`Avg ${cal}`}
              value={`${stats.avgCalories}`}
              hint={calorieTarget ? `target ${calorieTarget}` : "per logged day"}
              tone={toneFor(stats.avgCalories, calorieTarget)}
            />
            <SummaryStat
              label="Avg protein"
              value={`${stats.avgProtein} g`}
              hint={macroTargets ? `target ${macroTargets.proteinG} g` : undefined}
            />
            <SummaryStat
              label="Avg carbs"
              value={`${stats.avgCarbs} g`}
              hint={macroTargets ? `target ${macroTargets.carbsG} g` : undefined}
            />
            <SummaryStat
              label="Avg fat"
              value={`${stats.avgFat} g`}
              hint={macroTargets ? `target ${macroTargets.fatG} g` : undefined}
            />
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Averages are per day with at least one entry. Use ← Prev below to open any day.
          </p>
        </>
      ) : (
        <p className="text-sm text-gray-500">No food logged in the last {days} days.</p>
      )}
    </div>
  );
}

/** Color the average-calories value when it strays far from target. */
function toneFor(avg: number, target?: number): "ok" | "warn" | undefined {
  if (!target) return undefined;
  const pct = Math.abs(avg - target) / target;
  return pct > 0.15 ? "warn" : "ok";
}

function SummaryStat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "ok" | "warn";
}) {
  const valueColor =
    tone === "warn" ? "text-amber-600" : tone === "ok" ? "text-green-600" : "text-gray-900";
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className={`text-lg font-semibold ${valueColor}`}>{value}</div>
      {hint && <div className="text-[11px] text-gray-400">{hint}</div>}
    </div>
  );
}
