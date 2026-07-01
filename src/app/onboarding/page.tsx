"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { authedFetch } from "@/lib/api";
import { ftInToCm, lbToKg } from "@/lib/units";
import { ACTIVITY_LABELS } from "@/lib/nutrition";
import type { ActivityLevel, Gender, GoalType } from "@/lib/types";
import { Button, Card, Input, Label, Select, Spinner } from "@/components/ui";

type Step = "role" | "coach" | "client";

export default function OnboardingPage() {
  const { user, profile, loading, logout } = useAuth();
  const router = useRouter();
  const [step, setStep] = React.useState<Step>("role");

  // Redirect away if not signed in, or already onboarded.
  React.useEffect(() => {
    if (loading) return;
    if (!user) router.replace("/login");
    else if (profile) router.replace(profile.role === "coach" ? "/dashboard" : "/me");
  }, [user, profile, loading, router]);

  if (loading || !user || profile) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <div className="mb-6 flex items-center justify-between">
        <span className="text-xl font-bold text-indigo-600">CoachFit</span>
        <button
          onClick={() => logout()}
          className="text-sm text-gray-500 hover:underline"
        >
          Sign out
        </button>
      </div>

      {step === "role" && <RoleStep onChoose={setStep} />}
      {step === "coach" && <CoachStep name={user.displayName ?? ""} onBack={() => setStep("role")} />}
      {step === "client" && <ClientStep name={user.displayName ?? ""} onBack={() => setStep("role")} />}
    </main>
  );
}

function RoleStep({ onChoose }: { onChoose: (s: Step) => void }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">How will you use CoachFit?</h1>
      <p className="mt-1 text-sm text-gray-500">You can choose one role for this account.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <button
          onClick={() => onChoose("client")}
          className="rounded-xl border border-gray-200 bg-surface p-5 text-left shadow-sm transition hover:border-indigo-400 hover:shadow"
        >
          <div className="text-lg font-semibold text-gray-900">I&apos;m a client</div>
          <p className="mt-1 text-sm text-gray-500">
            Track my nutrition, weight and progress with my coach.
          </p>
        </button>
        <button
          onClick={() => onChoose("coach")}
          className="rounded-xl border border-gray-200 bg-surface p-5 text-left shadow-sm transition hover:border-indigo-400 hover:shadow"
        >
          <div className="text-lg font-semibold text-gray-900">I&apos;m a coach</div>
          <p className="mt-1 text-sm text-gray-500">
            Manage my clients and their progress. Requires a coach password.
          </p>
        </button>
      </div>
    </div>
  );
}

function CoachStep({ name, onBack }: { name: string; onBack: () => void }) {
  const router = useRouter();
  const [coachPassword, setCoachPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await authedFetch("/api/onboarding", { role: "coach", name, coachPassword });
      router.replace("/dashboard");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <h1 className="text-xl font-semibold text-gray-900">Coach access</h1>
      <p className="mt-1 text-sm text-gray-500">
        Enter the coach password to set up your coaching account.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <Label htmlFor="cpw">Coach password</Label>
          <Input
            id="cpw"
            type="password"
            required
            value={coachPassword}
            onChange={(e) => setCoachPassword(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onBack} disabled={busy}>
            Back
          </Button>
          <Button type="submit" className="flex-1" disabled={busy}>
            {busy ? "Verifying…" : "Create coach account"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function ClientStep({ name, onBack }: { name: string; onBack: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  const [inviteCode, setInviteCode] = React.useState("");
  const [age, setAge] = React.useState("");
  const [gender, setGender] = React.useState<Gender>("male");
  const [heightFt, setHeightFt] = React.useState("");
  const [heightIn, setHeightIn] = React.useState("");
  const [weightLb, setWeightLb] = React.useState("");
  const [activity, setActivity] = React.useState<ActivityLevel>("moderate");
  const [goalType, setGoalType] = React.useState<GoalType>("maintain");
  const [rateLb, setRateLb] = React.useState("1");

  // Optional intake questionnaire (shared with the coach).
  const [primaryGoal, setPrimaryGoal] = React.useState("");
  const [experience, setExperience] = React.useState("");
  const [allergies, setAllergies] = React.useState("");
  const [dislikes, setDislikes] = React.useState("");
  const [injuries, setInjuries] = React.useState("");
  const [schedule, setSchedule] = React.useState("");
  const [intakeNotes, setIntakeNotes] = React.useState("");

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
      const intake = {
        primaryGoal,
        experience,
        allergies,
        dislikes,
        injuries,
        schedule,
        notes: intakeNotes,
      };
      await authedFetch("/api/onboarding", {
        role: "client",
        name,
        inviteCode: inviteCode.trim().toUpperCase(),
        profile,
        goal,
        intake,
      });
      router.replace("/me");
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      <h1 className="text-xl font-semibold text-gray-900">Set up your profile</h1>
      <p className="mt-1 text-sm text-gray-500">
        Enter your coach&apos;s invite code and a few details so we can calculate your
        targets.
      </p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <Label htmlFor="code">Coach invite code</Label>
          <Input
            id="code"
            required
            placeholder="e.g. ABC234"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
            className="uppercase tracking-widest"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="age">Age</Label>
            <Input
              id="age"
              type="number"
              min={13}
              max={100}
              required
              value={age}
              onChange={(e) => setAge(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="gender">Gender</Label>
            <Select
              id="gender"
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
            <Label htmlFor="ft">Height (ft)</Label>
            <Input
              id="ft"
              type="number"
              min={3}
              max={8}
              required
              value={heightFt}
              onChange={(e) => setHeightFt(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="in">(in)</Label>
            <Input
              id="in"
              type="number"
              min={0}
              max={11}
              value={heightIn}
              onChange={(e) => setHeightIn(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="wt">Weight (lb)</Label>
            <Input
              id="wt"
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
          <Label htmlFor="act">Activity level</Label>
          <Select
            id="act"
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
            <Label htmlFor="goal">Goal</Label>
            <Select
              id="goal"
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
              <Label htmlFor="rate">Target rate (lb/week)</Label>
              <Input
                id="rate"
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

        <div className="space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <div>
            <p className="text-sm font-semibold text-gray-900">A bit about you</p>
            <p className="text-xs text-gray-500">
              Optional, but it helps your coach tailor your plan.
            </p>
          </div>
          <IntakeField
            label="Your main goal"
            placeholder="e.g. Lose 15 lb for a wedding in October"
            value={primaryGoal}
            onChange={setPrimaryGoal}
          />
          <IntakeField
            label="Training / dieting experience"
            placeholder="e.g. Lifted for 2 years, first time tracking macros"
            value={experience}
            onChange={setExperience}
          />
          <IntakeField
            label="Allergies or intolerances"
            placeholder="e.g. Lactose intolerant, tree nut allergy"
            value={allergies}
            onChange={setAllergies}
          />
          <IntakeField
            label="Foods you dislike / avoid"
            placeholder="e.g. Don't like fish, vegetarian"
            value={dislikes}
            onChange={setDislikes}
          />
          <IntakeField
            label="Injuries or medical considerations"
            placeholder="e.g. Bad left knee, managing blood pressure"
            value={injuries}
            onChange={setInjuries}
          />
          <IntakeField
            label="Typical weekly schedule"
            placeholder="e.g. Work 9-5, gym mornings, travel most weekends"
            value={schedule}
            onChange={setSchedule}
          />
          <IntakeField
            label="Anything else your coach should know?"
            placeholder="Optional"
            value={intakeNotes}
            onChange={setIntakeNotes}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={onBack} disabled={busy}>
            Back
          </Button>
          <Button type="submit" className="flex-1" disabled={busy}>
            {busy ? "Saving…" : "Finish setup"}
          </Button>
        </div>
      </form>
    </Card>
  );
}

function IntakeField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <textarea
        rows={2}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={1000}
        className="w-full rounded-lg border border-gray-300 bg-surface p-2.5 text-sm text-gray-900 placeholder:text-gray-400 outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      />
    </div>
  );
}
