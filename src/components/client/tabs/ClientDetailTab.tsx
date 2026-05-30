"use client";

import * as React from "react";
import { useWorkspace } from "../context";
import { updateUserFields } from "@/lib/data";
import {
  ACTIVITY_LABELS,
  calcBMR,
  calcCalorieTarget,
  calcMacroTargets,
  calcTDEE,
} from "@/lib/nutrition";
import { cmToFtIn, ftInToCm, kgToLb, lbToKg } from "@/lib/units";
import type { ActivityLevel, Gender, GoalType, Profile } from "@/lib/types";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
} from "@/components/ui";
import { cn } from "@/lib/cn";

export function ClientDetailTab() {
  const { target } = useWorkspace();
  const p = target.profile;

  const initFtIn = cmToFtIn(p?.heightCm ?? 170);
  const [age, setAge] = React.useState(String(p?.age ?? 30));
  const [gender, setGender] = React.useState<Gender>(p?.gender ?? "male");
  const [ft, setFt] = React.useState(String(initFtIn.ft));
  const [inches, setInches] = React.useState(String(initFtIn.inches));
  const [weightLb, setWeightLb] = React.useState(
    (p ? kgToLb(p.weightKg) : 160).toFixed(1),
  );
  const [activity, setActivity] = React.useState<ActivityLevel>(
    p?.activityLevel ?? "moderate",
  );
  const [goalType, setGoalType] = React.useState<GoalType>(
    target.goal?.type ?? "maintain",
  );
  const [rateLb, setRateLb] = React.useState(
    target.goal ? kgToLb(target.goal.targetRatePerWeekKg).toFixed(2) : "1",
  );
  const [selected, setSelected] = React.useState<number | null>(
    target.calorieTarget ?? null,
  );
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  const liveProfile: Profile = {
    age: Number(age) || 0,
    gender,
    heightCm: Math.round(ftInToCm(Number(ft) || 0, Number(inches) || 0)),
    weightKg: Number(lbToKg(Number(weightLb) || 0).toFixed(2)),
    activityLevel: activity,
  };

  const valid = liveProfile.age > 0 && liveProfile.heightCm > 0 && liveProfile.weightKg > 0;
  const rateKg = lbToKg(Number(rateLb) || 0);
  const bmr = valid ? Math.round(calcBMR(liveProfile)) : 0;
  const tdee = valid ? Math.round(calcTDEE(liveProfile)) : 0;

  const options = valid
    ? {
        cut: calcCalorieTarget(liveProfile, "cut", rateKg),
        maintain: calcCalorieTarget(liveProfile, "maintain", rateKg),
        bulk: calcCalorieTarget(liveProfile, "bulk", rateKg),
      }
    : { cut: 0, maintain: 0, bulk: 0 };

  // Recommended option follows the chosen goal.
  const recommended =
    goalType === "cut" ? options.cut : goalType === "bulk" ? options.bulk : options.maintain;

  async function save() {
    if (!valid) return;
    const calorieTarget = selected ?? recommended;
    setBusy(true);
    setMsg("");
    try {
      await updateUserFields(target.uid, {
        profile: liveProfile,
        goal: {
          type: goalType,
          targetRatePerWeekKg: goalType === "maintain" ? 0 : Number(rateKg.toFixed(3)),
        },
        calorieTarget,
        macroTargets: calcMacroTargets(calorieTarget, liveProfile.weightKg),
      });
      setMsg("Saved");
      setTimeout(() => setMsg(""), 1500);
    } catch {
      setMsg("Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="age">Age</Label>
              <Input id="age" type="number" value={age} onChange={(e) => setAge(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="g">Gender</Label>
              <Select id="g" value={gender} onChange={(e) => setGender(e.target.value as Gender)}>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="ft">Height (ft)</Label>
              <Input id="ft" type="number" value={ft} onChange={(e) => setFt(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="in">(in)</Label>
              <Input id="in" type="number" value={inches} onChange={(e) => setInches(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="wt">Weight (lb)</Label>
              <Input id="wt" type="number" step="0.1" value={weightLb} onChange={(e) => setWeightLb(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="act">Activity level</Label>
            <Select id="act" value={activity} onChange={(e) => setActivity(e.target.value as ActivityLevel)}>
              {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((k) => (
                <option key={k} value={k}>
                  {ACTIVITY_LABELS[k]}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-4 rounded-lg bg-gray-50 p-3 text-sm">
            <div>
              <div className="text-xs uppercase text-gray-500">BMR</div>
              <div className="font-semibold text-gray-900">{bmr} kcal</div>
            </div>
            <div>
              <div className="text-xs uppercase text-gray-500">TDEE</div>
              <div className="font-semibold text-gray-900">{tdee} kcal</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Goal & calorie target</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="goal">Goal</Label>
              <Select id="goal" value={goalType} onChange={(e) => setGoalType(e.target.value as GoalType)}>
                <option value="cut">Cut (lose weight)</option>
                <option value="maintain">Maintain</option>
                <option value="bulk">Bulk (gain weight)</option>
              </Select>
            </div>
            {goalType !== "maintain" && (
              <div>
                <Label htmlFor="rate">Target rate (lb/week)</Label>
                <Input id="rate" type="number" step="0.25" min="0.25" max="2" value={rateLb} onChange={(e) => setRateLb(e.target.value)} />
              </div>
            )}
          </div>

          <div>
            <Label>Recommended targets</Label>
            <div className="grid grid-cols-3 gap-2">
              <OptionCard
                label="Cut"
                kcal={options.cut}
                selected={selected === options.cut}
                recommended={goalType === "cut"}
                onClick={() => setSelected(options.cut)}
              />
              <OptionCard
                label="Maintain"
                kcal={options.maintain}
                selected={selected === options.maintain}
                recommended={goalType === "maintain"}
                onClick={() => setSelected(options.maintain)}
              />
              <OptionCard
                label="Bulk"
                kcal={options.bulk}
                selected={selected === options.bulk}
                recommended={goalType === "bulk"}
                onClick={() => setSelected(options.bulk)}
              />
            </div>
            <p className="mt-2 text-xs text-gray-500">
              Selected target:{" "}
              <span className="font-semibold text-gray-900">
                {selected ?? recommended} kcal/day
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={save} disabled={busy || !valid}>
              {busy ? "Saving…" : "Save details & target"}
            </Button>
            {msg && <span className="text-sm text-gray-500">{msg}</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OptionCard({
  label,
  kcal,
  selected,
  recommended,
  onClick,
}: {
  label: string;
  kcal: number;
  selected: boolean;
  recommended: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg border p-3 text-left transition",
        selected
          ? "border-indigo-600 bg-indigo-50"
          : "border-gray-200 bg-white hover:border-indigo-300",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {recommended && <span className="text-[10px] font-semibold text-indigo-600">REC</span>}
      </div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{kcal}</div>
      <div className="text-xs text-gray-400">kcal/day</div>
    </button>
  );
}
