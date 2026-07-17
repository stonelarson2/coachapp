"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useWorkspace } from "../context";
import { useTheme } from "@/context/ThemeContext";
import { useFoodLogRange, useWeightEntries } from "@/lib/data";
import {
  buildDailySeries,
  dailyAverages,
  macroCalorieSplit,
  macroTotals,
  targetMacroSplit,
  weeklySummaries,
  weightChangeOverWindow,
} from "@/lib/progress";
import { daysAgoISO, energyLabel, formatWeight, fromISODate, fromKg } from "@/lib/units";
import { Card, CardContent, CardHeader, CardTitle, Stat } from "@/components/ui";

const WINDOW_DAYS = 14;
const COMPARE_WEEKS = 6;
const MACRO_COLORS = { protein: "#6366f1", carbs: "#f59e0b", fat: "#10b981" };
const CAL_ON_TARGET = "#10b981"; // within ±15% of target
const CAL_OVER = "#f59e0b"; // more than 15% over
const CAL_UNDER = "#6366f1"; // more than 15% under
const CAL_TREND = "#ef4444"; // 7-day trailing average line

function shortDate(iso: string): string {
  const d = fromISODate(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** Bar color for a day's calories relative to the target (gray = not logged). */
function calorieColor(
  calories: number,
  logged: boolean,
  target: number | undefined,
  dark: boolean,
): string {
  if (!logged) return dark ? "#3a3a3a" : "#e5e7eb";
  if (!target) return "#6366f1";
  const diff = (calories - target) / target;
  if (Math.abs(diff) <= 0.15) return CAL_ON_TARGET;
  return diff > 0 ? CAL_OVER : CAL_UNDER;
}

/** Recharts colors that adapt to the active theme. */
function chartTheme(dark: boolean) {
  return {
    axis: dark ? "#a0a0a0" : "#6b7280",
    grid: dark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)",
    tooltip: {
      backgroundColor: dark ? "#2a2a2a" : "#ffffff",
      border: `1px solid ${dark ? "#404040" : "#e5e7eb"}`,
      borderRadius: 8,
      color: dark ? "#e1e1e1" : "#212529",
    } as React.CSSProperties,
    tooltipItem: { color: dark ? "#e1e1e1" : "#212529" } as React.CSSProperties,
    tooltipLabel: { color: dark ? "#e1e1e1" : "#212529" } as React.CSSProperties,
  };
}

export function ProgressTab() {
  const { target, unit, energyUnit } = useWorkspace();
  const cal = energyLabel(energyUnit);
  const { resolved } = useTheme();
  const ct = chartTheme(resolved === "dark");
  const { entries: weights } = useWeightEntries(target.uid);
  const start = daysAgoISO(WINDOW_DAYS - 1);
  const { entries: foods } = useFoodLogRange(target.uid, start);

  const series = React.useMemo(
    () => buildDailySeries(foods, start, WINDOW_DAYS),
    [foods, start],
  );
  const averages = React.useMemo(() => dailyAverages(series), [series]);
  const macros = React.useMemo(() => macroTotals(series), [series]);

  // Multi-week comparison (uses its own wider window of food logs).
  const compStart = daysAgoISO(COMPARE_WEEKS * 7 - 1);
  const { entries: compFoods } = useFoodLogRange(target.uid, compStart);
  const weeks = React.useMemo(
    () => weeklySummaries(compFoods, weights, COMPARE_WEEKS),
    [compFoods, weights],
  );

  // Macro split (actual vs target) over the 2-week window.
  const actualSplit = React.useMemo(() => macroCalorieSplit(macros), [macros]);
  const targetSplit = React.useMemo(
    () => targetMacroSplit(target.macroTargets),
    [target.macroTargets],
  );

  // Weight series in display unit.
  const weightData = weights.map((w) => ({
    date: shortDate(w.date),
    weight: Number(fromKg(w.weightKg, unit).toFixed(1)),
  }));

  // Current week (trailing 7 days).
  const weekStart = daysAgoISO(6);
  const weekChangeKg = weightChangeOverWindow(weights, weekStart);
  const weekSeries = series.slice(WINDOW_DAYS - 7);
  const weekAvg = dailyAverages(weekSeries);

  const targetCal = target.calorieTarget;

  // Daily calories with a 7-day trailing average (over logged days only) so the
  // trend line reads clearly across gaps where nothing was logged.
  const calorieData = React.useMemo(() => {
    const logged = series.map((d) => (d.logged ? Math.round(d.calories) : null));
    return series.map((d, i) => {
      let sum = 0;
      let n = 0;
      for (let j = Math.max(0, i - 6); j <= i; j++) {
        const v = logged[j];
        if (v != null) {
          sum += v;
          n += 1;
        }
      }
      return {
        date: shortDate(d.date),
        calories: d.logged ? Math.round(d.calories) : 0,
        logged: d.logged,
        trend: n ? Math.round(sum / n) : null,
      };
    });
  }, [series]);

  const hasMacros = macros.proteinG + macros.carbsG + macros.fatG > 0;
  // Actual macro split (by share of calories) for the donut; the muted outer
  // ring shows the target split when the client has macro targets set.
  const splitPie = actualSplit
    ? [
        { name: "Protein", value: actualSplit.proteinPct, grams: Math.round(macros.proteinG), color: MACRO_COLORS.protein },
        { name: "Carbs", value: actualSplit.carbsPct, grams: Math.round(macros.carbsG), color: MACRO_COLORS.carbs },
        { name: "Fat", value: actualSplit.fatPct, grams: Math.round(macros.fatG), color: MACRO_COLORS.fat },
      ]
    : [];
  const targetPie = targetSplit
    ? [
        { name: "Protein", value: targetSplit.proteinPct, color: MACRO_COLORS.protein },
        { name: "Carbs", value: targetSplit.carbsPct, color: MACRO_COLORS.carbs },
        { name: "Fat", value: targetSplit.fatPct, color: MACRO_COLORS.fat },
      ]
    : [];

  const avgBars = [
    { name: "Protein", grams: averages.proteinG, calories: 0 },
    { name: "Carbs", grams: averages.carbsG, calories: 0 },
    { name: "Fat", grams: averages.fatG, calories: 0 },
    { name: "Calories", grams: 0, calories: averages.calories },
  ];

  return (
    <div className="space-y-6">
      {/* Current week summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="This week's weight"
          value={
            weekChangeKg == null ? (
              "—"
            ) : (
              <span className={weekChangeKg < 0 ? "text-green-600" : "text-amber-600"}>
                {weekChangeKg <= -0.05 ? "−" : weekChangeKg >= 0.05 ? "+" : ""}
                {formatWeight(Math.abs(weekChangeKg), unit)}
              </span>
            )
          }
          hint="last 7 days"
        />
        <Stat label="Avg calories" value={weekAvg.calories || "—"} hint="this week" />
        <Stat label="Avg protein" value={`${weekAvg.proteinG} g`} hint="this week" />
        <Stat label="Days logged" value={`${weekAvg.loggedDays}/7`} hint="this week" />
      </div>

      {/* Weight over time */}
      <Card>
        <CardHeader>
          <CardTitle>Weight over time ({unit})</CardTitle>
        </CardHeader>
        <CardContent>
          {weightData.length < 2 ? (
            <Empty text="Log at least two weigh-ins to see the trend." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="date" stroke={ct.axis} tick={{ fontSize: 12, fill: ct.axis }} />
                  <YAxis domain={["auto", "auto"]} stroke={ct.axis} tick={{ fontSize: 12, fill: ct.axis }} />
                  <Tooltip
                    contentStyle={ct.tooltip}
                    itemStyle={ct.tooltipItem}
                    labelStyle={ct.tooltipLabel}
                  />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily calories past 2 weeks */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Daily calories (past 2 weeks)</CardTitle>
          {targetCal ? (
            <span className="text-xs text-gray-400">Target {targetCal} {cal}</span>
          ) : null}
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={calorieData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                <XAxis dataKey="date" stroke={ct.axis} tick={{ fontSize: 11, fill: ct.axis }} />
                <YAxis stroke={ct.axis} tick={{ fontSize: 12, fill: ct.axis }} />
                <Tooltip
                  cursor={{ fill: ct.grid }}
                  contentStyle={ct.tooltip}
                  itemStyle={ct.tooltipItem}
                  labelStyle={ct.tooltipLabel}
                />
                {targetCal ? (
                  <ReferenceLine
                    y={targetCal}
                    stroke={ct.axis}
                    strokeDasharray="4 4"
                    ifOverflow="extendDomain"
                  />
                ) : null}
                <Bar dataKey="calories" name={cal} radius={[3, 3, 0, 0]}>
                  {calorieData.map((d, i) => (
                    <Cell
                      key={i}
                      fill={calorieColor(d.calories, d.logged, targetCal, resolved === "dark")}
                    />
                  ))}
                </Bar>
                <Line
                  type="monotone"
                  dataKey="trend"
                  name="7-day avg"
                  stroke={CAL_TREND}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          {targetCal ? (
            <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[11px] text-gray-400">
              <LegendDot color={CAL_ON_TARGET} label="On target (±15%)" />
              <LegendDot color={CAL_OVER} label="Over" />
              <LegendDot color={CAL_UNDER} label="Under" />
              <LegendDot color={CAL_TREND} label="7-day avg" />
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Macro split (actual vs target) */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Macro split (past 2 weeks)</CardTitle>
            {targetSplit ? (
              <span className="text-xs text-gray-400">outer ring = target</span>
            ) : null}
          </CardHeader>
          <CardContent>
            {!hasMacros ? (
              <Empty text="No food logged in the last two weeks." />
            ) : (
              <>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      {targetPie.length > 0 && (
                        <Pie
                          data={targetPie}
                          dataKey="value"
                          nameKey="name"
                          innerRadius={78}
                          outerRadius={92}
                          stroke="none"
                          isAnimationActive={false}
                        >
                          {targetPie.map((m) => (
                            <Cell key={m.name} fill={m.color} fillOpacity={0.3} />
                          ))}
                        </Pie>
                      )}
                      <Pie
                        data={splitPie}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={45}
                        outerRadius={72}
                        stroke="none"
                        label={(e) => `${e.value}%`}
                      >
                        {splitPie.map((m) => (
                          <Cell key={m.name} fill={m.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v) => `${v}%`}
                        contentStyle={ct.tooltip}
                        itemStyle={ct.tooltipItem}
                        labelStyle={ct.tooltipLabel}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-2 space-y-1">
                  {splitPie.map((m, i) => {
                    const t = targetPie[i]?.value;
                    return (
                      <div key={m.name} className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-gray-600">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: m.color }} />
                          {m.name}
                        </span>
                        <span className="text-gray-500">
                          <span className="font-medium text-gray-900">{m.value}%</span>
                          <span className="text-gray-400"> · {m.grams}g</span>
                          {t != null && <span className="text-gray-400"> · target {t}%</span>}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Daily averages */}
        <Card>
          <CardHeader>
            <CardTitle>Daily averages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={avgBars} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={ct.grid} />
                  <XAxis dataKey="name" stroke={ct.axis} tick={{ fontSize: 12, fill: ct.axis }} />
                  <YAxis yAxisId="g" stroke={ct.axis} tick={{ fontSize: 12, fill: ct.axis }} />
                  <YAxis yAxisId="cal" orientation="right" stroke={ct.axis} tick={{ fontSize: 12, fill: ct.axis }} />
                  <Tooltip
                    cursor={{ fill: ct.grid }}
                    contentStyle={ct.tooltip}
                    itemStyle={ct.tooltipItem}
                    labelStyle={ct.tooltipLabel}
                  />
                  <Legend />
                  <Bar yAxisId="g" dataKey="grams" name="grams" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="cal" dataKey="calories" name={cal} fill="#f59e0b" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-center text-xs text-gray-400">
              Averaged over {averages.loggedDays} logged day
              {averages.loggedDays === 1 ? "" : "s"}.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Week-by-week comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Week-by-week comparison</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <WeeklyComparison weeks={weeks} unit={unit} cal={cal} targetCal={targetCal} />
        </CardContent>
      </Card>
    </div>
  );
}

function WeeklyComparison({
  weeks,
  unit,
  cal,
  targetCal,
}: {
  weeks: ReturnType<typeof weeklySummaries>;
  unit: "kg" | "lb";
  cal: string;
  targetCal?: number;
}) {
  const rows = weeks.filter((w) => w.daysLogged > 0 || w.weightChangeKg != null);
  if (rows.length === 0) {
    return <Empty text="Log a few weeks of food to compare them here." />;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
            <th className="px-4 py-3 font-medium">Week of</th>
            <th className="px-4 py-3 text-right font-medium">Logged</th>
            <th className="px-4 py-3 text-right font-medium">Avg {cal}</th>
            <th className="px-4 py-3 text-right font-medium">Avg protein</th>
            <th className="px-4 py-3 text-right font-medium">Weight Δ</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w, i) => {
            const isCurrent = i === 0;
            const calCls =
              w.daysLogged && targetCal
                ? Math.abs((w.avgCalories - targetCal) / targetCal) <= 0.15
                  ? "text-green-600"
                  : w.avgCalories > targetCal
                    ? "text-amber-600"
                    : "text-indigo-600"
                : "text-gray-900";
            return (
              <tr
                key={w.weekStart}
                className={`border-b border-gray-100 last:border-0 ${isCurrent ? "bg-primary-soft/40" : ""}`}
              >
                <td className="px-4 py-3">
                  {weekOfLabel(w.weekStart)}
                  {isCurrent && <span className="ml-2 text-xs text-primary-soft-fg">current</span>}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">{w.daysLogged}/7</td>
                <td className={`px-4 py-3 text-right font-medium ${calCls}`}>
                  {w.daysLogged ? w.avgCalories.toLocaleString() : "—"}
                </td>
                <td className="px-4 py-3 text-right text-gray-600">
                  {w.daysLogged ? `${w.avgProteinG} g` : "—"}
                </td>
                <td className="px-4 py-3 text-right">
                  {w.weightChangeKg == null ? (
                    <span className="text-gray-300">—</span>
                  ) : (
                    <span className={w.weightChangeKg < 0 ? "text-green-600" : "text-amber-600"}>
                      {w.weightChangeKg <= -0.05 ? "−" : w.weightChangeKg >= 0.05 ? "+" : ""}
                      {formatWeight(Math.abs(w.weightChangeKg), unit)}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function weekOfLabel(iso: string): string {
  const d = fromISODate(iso);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-gray-400">
      {text}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
