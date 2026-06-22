"use client";

import * as React from "react";
import { useWorkspace } from "../context";
import {
  addFoodLog,
  deleteFoodLog,
  importFoodLogs,
  sumMacros,
  useFoodLog,
  type FoodLogInput,
} from "@/lib/data";
import { parseMfpCsv } from "@/lib/mfpImport";
import { FoodAiEstimator } from "./FoodAiEstimator";
import { FoodSearch } from "./FoodSearch";
import { addDays, formatDatePretty, todayISO } from "@/lib/units";
import type { FoodLogEntry, MealType } from "@/lib/types";
import { Button, Card, CardContent, Input, Stat } from "@/components/ui";

const MEALS: { id: MealType; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snacks", label: "Snacks" },
];

export function FoodLogTab() {
  const { target } = useWorkspace();
  const [date, setDate] = React.useState(todayISO());
  const { entries } = useFoodLog(target.uid, date);
  const [importState, setImportState] = React.useState<
    | { phase: "idle" }
    | { phase: "preview"; rows: import("@/lib/mfpImport").MfpRow[]; skipped: number }
    | { phase: "importing" }
    | { phase: "done"; count: number }
    | { phase: "error"; message: string }
  >({ phase: "idle" });
  const fileRef = React.useRef<HTMLInputElement>(null);

  const totals = sumMacros(entries);
  const calTarget = target.calorieTarget;
  const macroTarget = target.macroTargets;
  const isToday = date === todayISO();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { rows, skipped } = parseMfpCsv(text);
      if (rows.length === 0) {
        setImportState({ phase: "error", message: "No food entries found in this CSV." });
      } else {
        setImportState({ phase: "preview", rows, skipped });
      }
    } catch (err) {
      setImportState({ phase: "error", message: String(err) });
    }
    e.target.value = "";
  }

  async function confirmImport() {
    if (importState.phase !== "preview") return;
    const { rows } = importState;
    setImportState({ phase: "importing" });
    try {
      await importFoodLogs(target.uid, rows);
      setImportState({ phase: "done", count: rows.length });
    } catch (err) {
      setImportState({ phase: "error", message: String(err) });
    }
  }

  return (
    <div className="space-y-6">
      {/* MFP import banner */}
      {importState.phase === "idle" && (
        <div className="flex items-center justify-between rounded-lg border border-dashed border-gray-300 bg-surface px-4 py-3">
          <span className="text-sm text-gray-500">Import from MyFitnessPal CSV</span>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
            Upload CSV
          </Button>
        </div>
      )}
      {importState.phase === "preview" && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3">
          <p className="text-sm font-medium text-indigo-900">
            Ready to import {importState.rows.length} entries
            {importState.skipped > 0 && ` (${importState.skipped} summary rows skipped)`}
          </p>
          <div className="mt-2 flex gap-2">
            <Button size="sm" onClick={confirmImport}>Import</Button>
            <Button size="sm" variant="secondary" onClick={() => setImportState({ phase: "idle" })}>Cancel</Button>
          </div>
        </div>
      )}
      {importState.phase === "importing" && (
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-700">
          Importing…
        </div>
      )}
      {importState.phase === "done" && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Imported {importState.count} entries successfully.{" "}
          <button className="underline" onClick={() => setImportState({ phase: "idle" })}>Dismiss</button>
        </div>
      )}
      {importState.phase === "error" && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {importState.message}{" "}
          <button className="underline" onClick={() => setImportState({ phase: "idle" })}>Dismiss</button>
        </div>
      )}
      {/* Day navigation */}
      <div className="flex items-center justify-between">
        <Button variant="secondary" size="sm" onClick={() => setDate(addDays(date, -1))}>
          ← Prev
        </Button>
        <div className="text-center">
          <div className="text-sm font-semibold text-gray-900">
            {formatDatePretty(date)}
          </div>
          {!isToday && (
            <button
              onClick={() => setDate(todayISO())}
              className="text-xs text-indigo-600 hover:underline"
            >
              Jump to today
            </button>
          )}
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setDate(addDays(date, 1))}
          disabled={isToday}
        >
          Next →
        </Button>
      </div>

      {/* Food database search + barcode scan */}
      <FoodSearch userId={target.uid} date={date} />

      {/* AI macro estimator (photo scan + text describe) */}
      <FoodAiEstimator userId={target.uid} date={date} />

      {/* Daily summary */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat
          label="Calories"
          value={Math.round(totals.calories)}
          hint={calTarget ? `of ${calTarget} kcal` : "kcal"}
        />
        <Stat
          label="Protein"
          value={`${Math.round(totals.proteinG)} g`}
          hint={macroTarget ? `of ${macroTarget.proteinG} g` : undefined}
        />
        <Stat
          label="Carbs"
          value={`${Math.round(totals.carbsG)} g`}
          hint={macroTarget ? `of ${macroTarget.carbsG} g` : undefined}
        />
        <Stat
          label="Fat"
          value={`${Math.round(totals.fatG)} g`}
          hint={macroTarget ? `of ${macroTarget.fatG} g` : undefined}
        />
      </div>

      {/* Meal sections */}
      <div className="space-y-4">
        {MEALS.map((m) => (
          <MealSection
            key={m.id}
            meal={m.id}
            label={m.label}
            userId={target.uid}
            date={date}
            entries={entries.filter((e) => e.meal === m.id)}
          />
        ))}
      </div>
    </div>
  );
}

function MealSection({
  meal,
  label,
  userId,
  date,
  entries,
}: {
  meal: MealType;
  label: string;
  userId: string;
  date: string;
  entries: FoodLogEntry[];
}) {
  const [adding, setAdding] = React.useState(false);
  const mealCals = entries.reduce((s, e) => s + e.calories, 0);

  return (
    <Card>
      <CardContent>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <span className="font-semibold text-gray-900">{label}</span>
            <span className="ml-2 text-sm text-gray-400">
              {Math.round(mealCals)} kcal
            </span>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setAdding((v) => !v)}>
            {adding ? "Cancel" : "+ Add"}
          </Button>
        </div>

        {entries.length > 0 && (
          <ul className="mb-2 divide-y divide-gray-100">
            {entries.map((e) => (
              <li key={e.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-gray-900">{e.name}</span>
                <span className="flex items-center gap-3 text-gray-500">
                  <span>{Math.round(e.calories)} kcal</span>
                  <span className="text-xs">
                    P{Math.round(e.proteinG)} C{Math.round(e.carbsG)} F{Math.round(e.fatG)}
                  </span>
                  <button
                    onClick={() => deleteFoodLog(e.id)}
                    className="text-gray-300 hover:text-red-500"
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}

        {adding && (
          <AddFoodForm
            onAdd={async (input) => {
              await addFoodLog(userId, date, { ...input, meal });
              setAdding(false);
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function AddFoodForm({
  onAdd,
}: {
  onAdd: (input: Omit<FoodLogInput, "meal">) => Promise<void>;
}) {
  const [name, setName] = React.useState("");
  const [calories, setCalories] = React.useState("");
  const [protein, setProtein] = React.useState("");
  const [carbs, setCarbs] = React.useState("");
  const [fat, setFat] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await onAdd({
        name: name.trim(),
        calories: Number(calories) || 0,
        proteinG: Number(protein) || 0,
        carbsG: Number(carbs) || 0,
        fatG: Number(fat) || 0,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="rounded-lg bg-gray-50 p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        <Input
          className="col-span-2 sm:col-span-2"
          placeholder="Food name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <Input type="number" placeholder="kcal" value={calories} onChange={(e) => setCalories(e.target.value)} />
        <Input type="number" placeholder="P (g)" value={protein} onChange={(e) => setProtein(e.target.value)} />
        <Input type="number" placeholder="C (g)" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
        <Input type="number" placeholder="F (g)" value={fat} onChange={(e) => setFat(e.target.value)} />
      </div>
      <div className="mt-2 flex justify-end">
        <Button size="sm" type="submit" disabled={busy}>
          {busy ? "Adding…" : "Add"}
        </Button>
      </div>
    </form>
  );
}
