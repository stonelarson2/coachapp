"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useWorkspace } from "../context";
import { useFoodLogRange, useWeightEntries } from "@/lib/data";
import {
  buildDailySeries,
  dailyAverages,
  macroTotals,
  weightChangeOverWindow,
} from "@/lib/progress";
import { daysAgoISO, fromISODate, fromKg, formatWeight } from "@/lib/units";
import { Card, CardContent, CardHeader, CardTitle, Stat } from "@/components/ui";

const WINDOW_DAYS = 14;
const MACRO_COLORS = { protein: "#6366f1", carbs: "#f59e0b", fat: "#10b981" };

function shortDate(iso: string): string {
  const d = fromISODate(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function ProgressTab() {
  const { target, unit } = useWorkspace();
  const { entries: weights } = useWeightEntries(target.uid);
  const start = daysAgoISO(WINDOW_DAYS - 1);
  const { entries: foods } = useFoodLogRange(target.uid, start);

  const series = React.useMemo(
    () => buildDailySeries(foods, start, WINDOW_DAYS),
    [foods, start],
  );
  const averages = React.useMemo(() => dailyAverages(series), [series]);
  const macros = React.useMemo(() => macroTotals(series), [series]);

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

  const calorieData = series.map((d) => ({
    date: shortDate(d.date),
    calories: Math.round(d.calories),
  }));

  const macroPie = [
    { name: "Protein", value: Math.round(macros.proteinG), color: MACRO_COLORS.protein },
    { name: "Carbs", value: Math.round(macros.carbsG), color: MACRO_COLORS.carbs },
    { name: "Fat", value: Math.round(macros.fatG), color: MACRO_COLORS.fat },
  ];
  const hasMacros = macroPie.some((m) => m.value > 0);

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
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis domain={["auto", "auto"]} tick={{ fontSize: 12 }} />
                  <Tooltip />
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
        <CardHeader>
          <CardTitle>Daily calories (past 2 weeks)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={calorieData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="calories" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Macro breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Macro breakdown (past 2 weeks)</CardTitle>
          </CardHeader>
          <CardContent>
            {!hasMacros ? (
              <Empty text="No food logged in the last two weeks." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={macroPie}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={50}
                      outerRadius={90}
                      label={(e) => `${e.name}: ${e.value}g`}
                    >
                      {macroPie.map((m) => (
                        <Cell key={m.name} fill={m.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
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
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="g" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="cal" orientation="right" tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="g" dataKey="grams" name="grams" fill="#6366f1" radius={[3, 3, 0, 0]} />
                  <Bar yAxisId="cal" dataKey="calories" name="kcal" fill="#f59e0b" radius={[3, 3, 0, 0]} />
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
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-gray-400">
      {text}
    </div>
  );
}
