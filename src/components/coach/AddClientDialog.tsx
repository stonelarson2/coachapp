"use client";

import * as React from "react";
import { authedFetch } from "@/lib/api";
import { ftInToCm, lbToKg } from "@/lib/units";
import { ACTIVITY_LABELS } from "@/lib/nutrition";
import type { ActivityLevel, Gender, GoalType } from "@/lib/types";
import { Button, Card, Input, Label, Select } from "@/components/ui";

export function AddClientDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (name: string) => void;
}) {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [age, setAge] = React.useState("");
  const [gender, setGender] = React.useState<Gender>("male");
  const [heightFt, setHeightFt] = React.useState("");
  const [heightIn, setHeightIn] = React.useState("");
  const [weightLb, setWeightLb] = React.useState("");
  const [activity, setActivity] = React.useState<ActivityLevel>("moderate");
  const [goalType, setGoalType] = React.useState<GoalType>("maintain");
  const [rateLb, setRateLb] = React.useState("1");

  function reset() {
    setName("");
    setEmail("");
    setAge("");
    setGender("male");
    setHeightFt("");
    setHeightIn("");
    setWeightLb("");
    setActivity("moderate");
    setGoalType("maintain");
    setRateLb("1");
    setError("");
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const profile = {
        age: Number(age),
        gender,
        heightCm: Math.round(ftInToCm(Number(heightFt), Number(heightIn || 0))),
        weightKg: Number(lbToKg(Number(weightLb)).toFixed(2)),
        activityLevel: activity,
      };
      const goal = {
        type: goalType,
        targetRatePerWeekKg:
          goalType === "maintain" ? 0 : Number(lbToKg(Number(rateLb)).toFixed(3)),
      };
      await authedFetch("/api/clients", {
        mode: "manual",
        name: name.trim(),
        email: email.trim(),
        profile,
        goal,
      });
      onCreated?.(name.trim());
      reset();
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onMouseDown={close}
    >
      <Card
        className="w-full max-w-lg bg-elevated"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Add a client</h2>
          <button
            type="button"
            onClick={close}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          <div>
            <Label htmlFor="ac-name">Full name</Label>
            <Input
              id="ac-name"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Jordan Lee"
            />
          </div>

          <div>
            <Label htmlFor="ac-email">Email — an invite will be sent automatically</Label>
            <Input
              id="ac-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="client@example.com"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ac-age">Age</Label>
              <Input
                id="ac-age"
                type="number"
                min={13}
                max={100}
                required
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ac-gender">Gender</Label>
              <Select
                id="ac-gender"
                value={gender}
                onChange={(e) => setGender(e.target.value as Gender)}
              >
                <option value="male">Male</option>
                <option value="female">Female</option>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="ac-ft">Height (ft)</Label>
              <Input
                id="ac-ft"
                type="number"
                min={3}
                max={8}
                required
                value={heightFt}
                onChange={(e) => setHeightFt(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ac-in">(in)</Label>
              <Input
                id="ac-in"
                type="number"
                min={0}
                max={11}
                value={heightIn}
                onChange={(e) => setHeightIn(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="ac-wt">Weight (lb)</Label>
              <Input
                id="ac-wt"
                type="number"
                min={50}
                step="0.1"
                required
                value={weightLb}
                onChange={(e) => setWeightLb(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="ac-act">Activity level</Label>
            <Select
              id="ac-act"
              value={activity}
              onChange={(e) => setActivity(e.target.value as ActivityLevel)}
            >
              {(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((k) => (
                <option key={k} value={k}>
                  {ACTIVITY_LABELS[k]}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ac-goal">Goal</Label>
              <Select
                id="ac-goal"
                value={goalType}
                onChange={(e) => setGoalType(e.target.value as GoalType)}
              >
                <option value="cut">Cut (lose weight)</option>
                <option value="maintain">Maintain</option>
                <option value="bulk">Bulk (gain weight)</option>
              </Select>
            </div>
            {goalType !== "maintain" && (
              <div>
                <Label htmlFor="ac-rate">Target rate (lb/week)</Label>
                <Input
                  id="ac-rate"
                  type="number"
                  step="0.25"
                  min="0.25"
                  max="2"
                  value={rateLb}
                  onChange={(e) => setRateLb(e.target.value)}
                />
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="secondary" onClick={close} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy ? "Creating…" : "Create client"}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
