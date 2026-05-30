"use client";

import * as React from "react";
import { useWorkspace } from "../context";
import {
  addFoodLog,
  deleteFoodLog,
  sumMacros,
  useFoodLog,
  type FoodLogInput,
} from "@/lib/data";
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

  const totals = sumMacros(entries);
  const calTarget = target.calorieTarget;
  const macroTarget = target.macroTargets;
  const isToday = date === todayISO();

  return (
    <div className="space-y-6">
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
          className="sm:col-span-2"
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
