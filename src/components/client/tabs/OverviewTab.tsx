"use client";

import * as React from "react";
import { useWorkspace } from "../context";
import { WeeklyRecap } from "./WeeklyRecap";
import { useWeightEntries, logWeight } from "@/lib/data";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Stat } from "@/components/ui";
import { energyLabel, formatWeight, fromKg, toKg, todayISO } from "@/lib/units";

export function OverviewTab() {
  const { target, unit, energyUnit } = useWorkspace();
  const { entries } = useWeightEntries(target.uid);

  const start = target.startWeightKg ?? target.profile?.weightKg ?? 0;
  const current = target.currentWeightKg ?? start;
  const changeKg = current - start;
  const goalLabel = target.goal?.type ?? "maintain";

  return (
    <div className="space-y-6">
      <WeeklyRecap />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Current weight" value={formatWeight(current, unit)} />
        <Stat
          label="Total change"
          value={
            <span
              className={
                Math.abs(changeKg) < 0.05
                  ? "text-gray-900"
                  : changeKg < 0
                    ? "text-green-600"
                    : "text-amber-600"
              }
            >
              {changeKg <= -0.05 ? "−" : changeKg >= 0.05 ? "+" : ""}
              {formatWeight(Math.abs(changeKg), unit)}
            </span>
          }
          hint={`from ${formatWeight(start, unit)} start`}
        />
        <Stat
          label="Target calories"
          value={target.calorieTarget ? `${target.calorieTarget}` : "—"}
          hint={`${energyLabel(energyUnit)} / day`}
        />
        <Stat label="Goal" value={<span className="capitalize">{goalLabel}</span>} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Log weight</CardTitle>
        </CardHeader>
        <CardContent>
          <WeightLogger
            userId={target.uid}
            unit={unit}
            entriesCount={entries.length}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function WeightLogger({
  userId,
  unit,
  entriesCount,
}: {
  userId: string;
  unit: "kg" | "lb";
  entriesCount: number;
}) {
  const { target } = useWorkspace();
  const { entries } = useWeightEntries(userId);
  // Prefill with the most recent weight (in display unit), computed once.
  const [value, setValue] = React.useState(() => {
    const latest = target.currentWeightKg ?? target.profile?.weightKg;
    return latest != null ? fromKg(latest, unit).toFixed(1) : "";
  });
  const [date, setDate] = React.useState(todayISO());
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(value);
    if (!num || num <= 0) return;
    setBusy(true);
    setMsg("");
    try {
      await logWeight(userId, toKg(num, unit), date, entries);
      setMsg("Saved");
      setTimeout(() => setMsg(""), 1500);
    } catch {
      setMsg("Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">
          Weight ({unit})
        </label>
        <Input
          type="number"
          step="0.1"
          min="1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-32"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-500">Date</label>
        <Input
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value)}
          className="w-44"
        />
      </div>
      <Button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Log weight"}
      </Button>
      {msg && <span className="text-sm text-gray-500">{msg}</span>}
      <span className="ml-auto text-xs text-gray-400">
        {entriesCount} entr{entriesCount === 1 ? "y" : "ies"} logged
      </span>
    </form>
  );
}
