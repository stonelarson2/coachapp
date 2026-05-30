"use client";

import * as React from "react";
import { useWorkspace } from "../context";
import { updateUserFields } from "@/lib/data";
import {
  CALORIES_PER_G_CARB,
  CALORIES_PER_G_FAT,
  CALORIES_PER_G_PROTEIN,
  calcMacroTargets,
} from "@/lib/nutrition";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
} from "@/components/ui";

export function NutritionTab() {
  const { target } = useWorkspace();
  const weightKg = target.profile?.weightKg ?? target.currentWeightKg ?? 70;

  const [calories, setCalories] = React.useState(String(target.calorieTarget ?? 2000));
  const [protein, setProtein] = React.useState(String(target.macroTargets?.proteinG ?? 0));
  const [carbs, setCarbs] = React.useState(String(target.macroTargets?.carbsG ?? 0));
  const [fat, setFat] = React.useState(String(target.macroTargets?.fatG ?? 0));
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  const p = Number(protein) || 0;
  const c = Number(carbs) || 0;
  const f = Number(fat) || 0;
  const cal = Number(calories) || 0;

  const macroCalories =
    p * CALORIES_PER_G_PROTEIN + c * CALORIES_PER_G_CARB + f * CALORIES_PER_G_FAT;
  const diff = macroCalories - cal;

  function autoCalc() {
    const m = calcMacroTargets(cal, weightKg);
    setProtein(String(m.proteinG));
    setCarbs(String(m.carbsG));
    setFat(String(m.fatG));
  }

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      await updateUserFields(target.uid, {
        calorieTarget: cal,
        macroTargets: { proteinG: p, carbsG: c, fatG: f },
      });
      setMsg("Targets updated");
      setTimeout(() => setMsg(""), 1500);
    } catch {
      setMsg("Could not save");
    } finally {
      setBusy(false);
    }
  }

  function pct(grams: number, perGram: number) {
    if (macroCalories === 0) return 0;
    return Math.round(((grams * perGram) / macroCalories) * 100);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Nutrition targets</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="cal">Daily calorie target (kcal)</Label>
            <Input id="cal" type="number" value={calories} onChange={(e) => setCalories(e.target.value)} />
          </div>

          <div>
            <Button variant="secondary" size="sm" onClick={autoCalc}>
              Auto-calculate macros
            </Button>
            <p className="mt-1 text-xs text-gray-400">
              Protein from bodyweight, fat ~27% of calories, carbs fill the rest.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="p">Protein (g)</Label>
              <Input id="p" type="number" value={protein} onChange={(e) => setProtein(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="c">Carbs (g)</Label>
              <Input id="c" type="number" value={carbs} onChange={(e) => setCarbs(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="f">Fat (g)</Label>
              <Input id="f" type="number" value={fat} onChange={(e) => setFat(e.target.value)} />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={busy}>
              {busy ? "Saving…" : "Update targets"}
            </Button>
            {msg && <span className="text-sm text-gray-500">{msg}</span>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <MacroRow label="Protein" grams={p} pct={pct(p, CALORIES_PER_G_PROTEIN)} color="bg-indigo-500" />
          <MacroRow label="Carbs" grams={c} pct={pct(c, CALORIES_PER_G_CARB)} color="bg-amber-500" />
          <MacroRow label="Fat" grams={f} pct={pct(f, CALORIES_PER_G_FAT)} color="bg-emerald-500" />

          <div className="rounded-lg bg-gray-50 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Calories from macros</span>
              <span className="font-semibold text-gray-900">{Math.round(macroCalories)} kcal</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span className="text-gray-500">vs. target</span>
              <span
                className={
                  Math.abs(diff) <= 50
                    ? "font-semibold text-green-600"
                    : "font-semibold text-amber-600"
                }
              >
                {diff > 0 ? "+" : ""}
                {Math.round(diff)} kcal
              </span>
            </div>
            {Math.abs(diff) > 50 && (
              <p className="mt-1 text-xs text-amber-600">
                Macros don&apos;t match the calorie target — adjust grams or re-run
                auto-calculate.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MacroRow({
  label,
  grams,
  pct,
  color,
}: {
  label: string;
  grams: number;
  pct: number;
  color: string;
}) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-sm">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-500">
          {grams} g · {pct}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full ${color}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}
