"use client";

import * as React from "react";
import { useWorkspace } from "../context";
import { useFoodLogRange, useWeightEntries } from "@/lib/data";
import {
  adherenceBand,
  computeAdherence,
  loggingStreak,
  totalsByDay,
  weeklyRecap,
} from "@/lib/adherence";
import { daysAgoISO, energyLabel, formatWeight } from "@/lib/units";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

/**
 * Client-facing weekly recap: current logging streak, last-7-day averages and
 * target hits, a 14-day adherence score, and a couple of encouraging milestone
 * badges. Shown at the top of the Overview tab.
 */
export function WeeklyRecap() {
  const { target, unit, energyUnit, isCoachView } = useWorkspace();
  const cal = energyLabel(energyUnit);
  const { entries: week } = useFoodLogRange(target.uid, daysAgoISO(6));
  const { entries: fortnight } = useFoodLogRange(target.uid, daysAgoISO(13));
  const { entries: weights } = useWeightEntries(target.uid);

  const recap = React.useMemo(
    () => weeklyRecap(week, target.calorieTarget, target.macroTargets),
    [week, target.calorieTarget, target.macroTargets],
  );
  const streak = React.useMemo(
    () => loggingStreak(new Set([...totalsByDay(fortnight).keys()])),
    [fortnight],
  );
  const adherence = React.useMemo(
    () => computeAdherence(fortnight, 14, target.calorieTarget, target.macroTargets),
    [fortnight, target.calorieTarget, target.macroTargets],
  );

  // Weight change across the last 7 days (first vs last entry in that window).
  const weekWeights = weights.filter((w) => w.date >= daysAgoISO(6));
  const weightChangeKg =
    weekWeights.length >= 2
      ? weekWeights[weekWeights.length - 1].weightKg - weekWeights[0].weightKg
      : null;

  const band = adherenceBand(adherence.score);
  const who = isCoachView ? target.name.split(" ")[0] : "You";
  const verb = isCoachView ? "has" : "have";

  const milestones: string[] = [];
  if (streak >= 3) milestones.push(`🔥 ${streak}-day logging streak`);
  if (recap.proteinDaysHit != null && recap.proteinDaysHit >= 5)
    milestones.push(`💪 Protein hit ${recap.proteinDaysHit}/7 days`);
  if (recap.daysLogged === 7) milestones.push("✅ Logged all 7 days");
  if (recap.calorieDaysHit != null && recap.calorieDaysHit >= 5)
    milestones.push(`🎯 On target ${recap.calorieDaysHit}/7 days`);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>This week</CardTitle>
        <Badge color={band.color}>{adherence.score}% · {band.label}</Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <RecapStat label="Streak" value={streak > 0 ? `${streak} day${streak === 1 ? "" : "s"}` : "—"} />
          <RecapStat label="Days logged" value={`${recap.daysLogged}/7`} />
          <RecapStat
            label={`Avg ${cal}`}
            value={recap.daysLogged ? `${recap.avgCalories}` : "—"}
            hint={target.calorieTarget ? `target ${target.calorieTarget}` : undefined}
          />
          <RecapStat
            label="7-day weight"
            value={
              weightChangeKg == null
                ? "—"
                : `${weightChangeKg <= -0.05 ? "−" : weightChangeKg >= 0.05 ? "+" : ""}${formatWeight(Math.abs(weightChangeKg), unit)}`
            }
          />
        </div>

        {milestones.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {milestones.map((m) => (
              <span
                key={m}
                className="rounded-full bg-primary-soft px-3 py-1 text-xs font-medium text-primary-soft-fg"
              >
                {m}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            {recap.daysLogged === 0
              ? `${who} ${verb}n't logged any food this week yet.`
              : "Keep logging to unlock streak and target milestones."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RecapStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="text-xs text-gray-400">{label}</div>
      <div className="text-lg font-semibold text-gray-900">{value}</div>
      {hint && <div className="text-[11px] text-gray-400">{hint}</div>}
    </div>
  );
}
