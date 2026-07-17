"use client";

import * as React from "react";
import { useWorkspace } from "../context";
import { useFoodLogRange } from "@/lib/data";
import { buildDailySeries, dailyAverages } from "@/lib/progress";
import type { DailyTotals } from "@/lib/progress";
import type { MacroTargets } from "@/lib/types";
import {
  addDays,
  energyLabel,
  fromISODate,
  startOfWeekMonday,
  todayISO,
} from "@/lib/units";
import { Button, Card, CardContent, CardHeader, CardTitle, Stat } from "@/components/ui";

const MACRO_COLORS = { protein: "#6366f1", carbs: "#f59e0b", fat: "#10b981" };

function weekdayLabel(iso: string): string {
  return fromISODate(iso).toLocaleDateString(undefined, { weekday: "short" });
}

function dayNumberLabel(iso: string): string {
  const d = fromISODate(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

type View = "day" | "total";
type Avgs = ReturnType<typeof dailyAverages>;

/**
 * "This week" tab: the current (Monday-start) week's nutrition, viewable either
 * as a per-day breakdown (calories + macro target rings for each day) or a
 * single weekly total/average summary with week-over-week deltas.
 */
export function WeekTab() {
  const { target, energyUnit } = useWorkspace();
  const cal = energyLabel(energyUnit);
  const [view, setView] = React.useState<View>("day");

  const today = todayISO();
  const weekStart = startOfWeekMonday(today);
  const lastWeekStart = addDays(weekStart, -7);
  // Pull two weeks so we can compute week-over-week deltas.
  const { entries } = useFoodLogRange(target.uid, lastWeekStart);

  const series = React.useMemo(
    () => buildDailySeries(entries.filter((e) => e.date >= weekStart), weekStart, 7),
    [entries, weekStart],
  );
  const lastSeries = React.useMemo(
    () =>
      buildDailySeries(
        entries.filter((e) => e.date >= lastWeekStart && e.date < weekStart),
        lastWeekStart,
        7,
      ),
    [entries, lastWeekStart, weekStart],
  );
  const averages = React.useMemo(() => dailyAverages(series), [series]);
  const lastAverages = React.useMemo(() => dailyAverages(lastSeries), [lastSeries]);

  const totals = React.useMemo(
    () =>
      series.reduce(
        (a, d) => ({
          calories: a.calories + d.calories,
          proteinG: a.proteinG + d.proteinG,
          carbsG: a.carbsG + d.carbsG,
          fatG: a.fatG + d.fatG,
        }),
        { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
      ),
    [series],
  );

  const targetCal = target.calorieTarget;
  const mt = target.macroTargets;
  const weekEnd = addDays(weekStart, 6);
  const rangeLabel = `${dayNumberLabel(weekStart)} – ${dayNumberLabel(weekEnd)}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">This week</h2>
          <p className="text-sm text-gray-500">
            {rangeLabel} · {averages.loggedDays}/7 days logged
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-300 p-0.5">
          <Button
            size="sm"
            variant={view === "day" ? "primary" : "ghost"}
            onClick={() => setView("day")}
          >
            By day
          </Button>
          <Button
            size="sm"
            variant={view === "total" ? "primary" : "ghost"}
            onClick={() => setView("total")}
          >
            Weekly total
          </Button>
        </div>
      </div>

      {view === "total" ? (
        <WeeklyTotalView
          totals={totals}
          averages={averages}
          lastAverages={lastAverages}
          cal={cal}
          targetCal={targetCal}
          mt={mt}
        />
      ) : (
        <ByDayView series={series} today={today} cal={cal} targetCal={targetCal} mt={mt} />
      )}
    </div>
  );
}

/** Signed delta chip: this week vs last week (green when moving toward target). */
function Delta({
  current,
  previous,
  suffix = "",
  goodDown = false,
}: {
  current: number;
  previous: number;
  suffix?: string;
  goodDown?: boolean;
}) {
  if (!previous) return null;
  const diff = Math.round(current - previous);
  if (diff === 0) return <span className="text-xs text-gray-400">— vs last wk</span>;
  const up = diff > 0;
  const good = goodDown ? !up : up;
  return (
    <span className={`text-xs ${good ? "text-green-600" : "text-amber-600"}`}>
      {up ? "▲" : "▼"} {Math.abs(diff).toLocaleString()}
      {suffix} vs last wk
    </span>
  );
}

function WeeklyTotalView({
  totals,
  averages,
  lastAverages,
  cal,
  targetCal,
  mt,
}: {
  totals: { calories: number; proteinG: number; carbsG: number; fatG: number };
  averages: Avgs;
  lastAverages: Avgs;
  cal: string;
  targetCal?: number;
  mt?: MacroTargets;
}) {
  const weeklyCalTarget = targetCal ? targetCal * 7 : undefined;
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Week totals</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat
              label={`Total ${cal}`}
              value={Math.round(totals.calories).toLocaleString()}
              hint={weeklyCalTarget ? `target ${weeklyCalTarget.toLocaleString()}` : undefined}
            />
            <Stat
              label="Total protein"
              value={`${Math.round(totals.proteinG)} g`}
              hint={mt?.proteinG ? `target ${mt.proteinG * 7} g` : undefined}
            />
            <Stat
              label="Total carbs"
              value={`${Math.round(totals.carbsG)} g`}
              hint={mt?.carbsG ? `target ${mt.carbsG * 7} g` : undefined}
            />
            <Stat
              label="Total fat"
              value={`${Math.round(totals.fatG)} g`}
              hint={mt?.fatG ? `target ${mt.fatG * 7} g` : undefined}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Daily averages</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <AvgStat
              label={`Avg ${cal}`}
              logged={averages.loggedDays}
              value={averages.calories.toLocaleString()}
              current={averages.calories}
              previous={lastAverages.calories}
              targetHint={targetCal ? `target ${targetCal.toLocaleString()}` : undefined}
            />
            <AvgStat
              label="Avg protein"
              logged={averages.loggedDays}
              value={`${averages.proteinG} g`}
              current={averages.proteinG}
              previous={lastAverages.proteinG}
              suffix="g"
              targetHint={mt?.proteinG ? `target ${mt.proteinG} g` : undefined}
            />
            <AvgStat
              label="Avg carbs"
              logged={averages.loggedDays}
              value={`${averages.carbsG} g`}
              current={averages.carbsG}
              previous={lastAverages.carbsG}
              suffix="g"
              targetHint={mt?.carbsG ? `target ${mt.carbsG} g` : undefined}
            />
            <AvgStat
              label="Avg fat"
              logged={averages.loggedDays}
              value={`${averages.fatG} g`}
              current={averages.fatG}
              previous={lastAverages.fatG}
              suffix="g"
              targetHint={mt?.fatG ? `target ${mt.fatG} g` : undefined}
            />
          </div>
          <p className="mt-3 text-xs text-gray-400">
            Averaged over {averages.loggedDays} logged day
            {averages.loggedDays === 1 ? "" : "s"}.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

/** A daily-average Stat with an optional target hint and a week-over-week delta. */
function AvgStat({
  label,
  logged,
  value,
  current,
  previous,
  suffix,
  targetHint,
}: {
  label: string;
  logged: number;
  value: string;
  current: number;
  previous: number;
  suffix?: string;
  targetHint?: string;
}) {
  return (
    <Stat
      label={label}
      value={logged ? value : "—"}
      hint={
        <span className="flex flex-col gap-0.5">
          {targetHint && <span>{targetHint}</span>}
          {logged > 0 && <Delta current={current} previous={previous} suffix={suffix} />}
        </span>
      }
    />
  );
}

function ByDayView({
  series,
  today,
  cal,
  targetCal,
  mt,
}: {
  series: DailyTotals[];
  today: string;
  cal: string;
  targetCal?: number;
  mt?: MacroTargets;
}) {
  const hasMacroTargets = !!(mt?.proteinG && mt?.carbsG && mt?.fatG);
  return (
    <Card>
      <CardContent className="divide-y divide-gray-100 p-0">
        {series.map((d) => {
          const isToday = d.date === today;
          const isFuture = d.date > today;
          return (
            <div
              key={d.date}
              className={`flex flex-wrap items-center justify-between gap-4 px-4 py-3 ${isToday ? "bg-primary-soft/40" : ""}`}
            >
              <div className="min-w-[80px]">
                <span className="font-medium text-gray-900">{weekdayLabel(d.date)}</span>{" "}
                <span className="text-gray-400">{dayNumberLabel(d.date)}</span>
                {isToday && <div className="text-xs text-primary-soft-fg">today</div>}
              </div>

              {d.logged ? (
                <div className="flex flex-1 flex-wrap items-center justify-end gap-x-6 gap-y-2">
                  <div className="text-right">
                    <CalorieValue calories={d.calories} targetCal={targetCal} />
                    <div className="text-[11px] text-gray-400">{cal}</div>
                  </div>
                  {hasMacroTargets ? (
                    <div className="flex gap-3">
                      <MacroRing letter="P" grams={d.proteinG} target={mt!.proteinG} color={MACRO_COLORS.protein} />
                      <MacroRing letter="C" grams={d.carbsG} target={mt!.carbsG} color={MACRO_COLORS.carbs} />
                      <MacroRing letter="F" grams={d.fatG} target={mt!.fatG} color={MACRO_COLORS.fat} />
                    </div>
                  ) : (
                    <div className="flex gap-4 text-sm text-gray-600">
                      <span>{Math.round(d.proteinG)}g P</span>
                      <span>{Math.round(d.carbsG)}g C</span>
                      <span>{Math.round(d.fatG)}g F</span>
                    </div>
                  )}
                </div>
              ) : (
                <span className="text-sm text-gray-300">{isFuture ? "—" : "not logged"}</span>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

/** Calorie number tinted green/amber/indigo relative to the target. */
function CalorieValue({ calories, targetCal }: { calories: number; targetCal?: number }) {
  const value = Math.round(calories).toLocaleString();
  if (!targetCal) return <div className="text-lg font-semibold text-gray-900">{value}</div>;
  const diff = (calories - targetCal) / targetCal;
  const cls =
    Math.abs(diff) <= 0.15
      ? "text-green-600"
      : diff > 0
        ? "text-amber-600"
        : "text-indigo-600";
  return <div className={`text-lg font-semibold ${cls}`}>{value}</div>;
}

/** Circular progress ring for one macro vs its daily target. */
function MacroRing({
  letter,
  grams,
  target,
  color,
}: {
  letter: string;
  grams: number;
  target: number;
  color: string;
}) {
  const r = 15;
  const circ = 2 * Math.PI * r;
  const pct = target > 0 ? Math.min(grams / target, 1) : 0;
  const rounded = Math.round(grams);
  const pctLabel = target > 0 ? Math.round((grams / target) * 100) : 0;
  return (
    <div
      className="flex flex-col items-center gap-1"
      title={`${letter}: ${rounded}g / ${target}g (${pctLabel}%)`}
    >
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r={r} fill="none" strokeWidth="4" className="stroke-gray-200" />
        <circle
          cx="20"
          cy="20"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - pct)}
          transform="rotate(-90 20 20)"
        />
        <text
          x="20"
          y="20"
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-gray-700 text-[11px] font-semibold"
        >
          {letter}
        </text>
      </svg>
      <span className="text-[11px] text-gray-500">{rounded}g</span>
    </div>
  );
}
