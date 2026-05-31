"use client";

import * as React from "react";
import { useWorkspace } from "../context";
import { useCheckins, submitCheckin, replyToCheckin } from "@/lib/data";
import { authedFetch } from "@/lib/api";
import { Button, Card, CardContent, Spinner } from "@/components/ui";
import { formatDatePretty, formatWeight, fromKg, toKg, todayISO } from "@/lib/units";
import type { CheckinDoc, CheckinRatings } from "@/lib/types";
import { cn } from "@/lib/cn";

const RATING_FIELDS: { key: keyof CheckinRatings; label: string }[] = [
  { key: "nutrition", label: "Nutrition adherence" },
  { key: "training", label: "Training / activity" },
  { key: "sleep", label: "Sleep quality" },
  { key: "energy", label: "Energy" },
  { key: "mood", label: "Mood" },
  { key: "stress", label: "Stress (1 = high)" },
];

/** ISO date (YYYY-MM-DD) of the Monday on or before today. */
function mondayOfThisWeek(): string {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function CheckinTab() {
  const { target, isCoachView, unit } = useWorkspace();
  const { checkins, loading } = useCheckins(target.uid);
  const thisWeek = mondayOfThisWeek();
  const submittedThisWeek = checkins.some((c) => c.weekOf === thisWeek);

  if (loading) {
    return (
      <div className="flex justify-center p-10">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Client: submit this week's check-in */}
      {!isCoachView && !submittedThisWeek && (
        <CheckinForm
          userId={target.uid}
          coachId={target.coachId}
          weekOf={thisWeek}
          unit={unit}
          latestWeightKg={target.currentWeightKg ?? target.profile?.weightKg}
        />
      )}
      {!isCoachView && submittedThisWeek && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          You&apos;ve checked in for this week. Your coach will review it soon.
        </div>
      )}

      {checkins.length === 0 ? (
        <p className="text-sm text-gray-500">
          {isCoachView ? "No check-ins from this client yet." : "No check-ins yet."}
        </p>
      ) : (
        <div className="space-y-4">
          {checkins.map((c) => (
            <CheckinCard key={c.id} checkin={c} isCoachView={isCoachView} unit={unit} />
          ))}
        </div>
      )}
    </div>
  );
}

function CheckinForm({
  userId,
  coachId,
  weekOf,
  unit,
  latestWeightKg,
}: {
  userId: string;
  coachId?: string;
  weekOf: string;
  unit: "kg" | "lb";
  latestWeightKg?: number;
}) {
  const [weight, setWeight] = React.useState(
    latestWeightKg != null ? fromKg(latestWeightKg, unit).toFixed(1) : "",
  );
  const [ratings, setRatings] = React.useState<CheckinRatings>({
    nutrition: 3, training: 3, sleep: 3, energy: 3, mood: 3, stress: 3,
  });
  const [notes, setNotes] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const w = Number(weight);
      await submitCheckin(userId, coachId, {
        weekOf,
        weightKg: w > 0 ? toKg(w, unit) : undefined,
        ratings,
        notes: notes.trim(),
      });
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <h3 className="mb-1 font-semibold text-gray-900">Weekly check-in</h3>
        <p className="mb-4 text-sm text-gray-500">Week of {formatDatePretty(weekOf)}</p>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Current weight ({unit})
            </label>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-32 rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            {RATING_FIELDS.map((f) => (
              <RatingRow
                key={f.key}
                label={f.label}
                value={ratings[f.key]}
                onChange={(v) => setRatings((r) => ({ ...r, [f.key]: v }))}
              />
            ))}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Notes for your coach
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="How did the week go? Any wins, struggles, or questions?"
              className="w-full rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" disabled={busy}>
            {busy ? "Submitting…" : "Submit check-in"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function RatingRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-gray-700">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={cn(
              "h-8 w-8 rounded-md border text-sm font-medium",
              value === n
                ? "border-indigo-600 bg-indigo-600 text-white"
                : "border-gray-300 text-gray-500 hover:bg-gray-50",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

function CheckinCard({
  checkin,
  isCoachView,
  unit,
}: {
  checkin: CheckinDoc;
  isCoachView: boolean;
  unit: "kg" | "lb";
}) {
  const [reply, setReply] = React.useState(checkin.coachReply ?? "");
  const [busy, setBusy] = React.useState(false);
  const [drafting, setDrafting] = React.useState(false);
  const [error, setError] = React.useState("");

  async function saveReply() {
    setBusy(true);
    setError("");
    try {
      await replyToCheckin(checkin.id, reply.trim());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function draft() {
    setDrafting(true);
    setError("");
    try {
      const res = await authedFetch<{ text: string }>("/api/checkin-draft", {
        checkinId: checkin.id,
      });
      setReply(res.text);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDrafting(false);
    }
  }

  return (
    <Card>
      <CardContent>
        <div className="mb-3 flex items-center justify-between">
          <span className="font-semibold text-gray-900">
            Week of {formatDatePretty(checkin.weekOf)}
          </span>
          {checkin.weightKg != null && (
            <span className="text-sm text-gray-500">{formatWeight(checkin.weightKg, unit)}</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
          {RATING_FIELDS.map((f) => (
            <div key={f.key} className="flex items-center justify-between text-sm">
              <span className="text-gray-500">{f.label}</span>
              <span className="font-medium text-gray-900">{checkin.ratings[f.key]}/5</span>
            </div>
          ))}
        </div>

        {checkin.notes && (
          <p className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-sm text-gray-700">
            {checkin.notes}
          </p>
        )}

        {/* Coach reply */}
        {isCoachView ? (
          <div className="mt-4 border-t border-gray-100 pt-3">
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-gray-500">Coach reply</label>
              <Button size="sm" variant="ghost" onClick={draft} disabled={drafting}>
                {drafting ? "Drafting…" : "✨ Draft with AI"}
              </Button>
            </div>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={3}
              placeholder="Write feedback for this check-in…"
              className="w-full rounded-lg border border-gray-300 bg-surface px-3 py-2 text-sm"
            />
            {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
            <Button size="sm" className="mt-2" onClick={saveReply} disabled={busy || !reply.trim()}>
              {busy ? "Saving…" : checkin.coachReply ? "Update reply" : "Send reply"}
            </Button>
          </div>
        ) : (
          checkin.coachReply && (
            <div className="mt-4 rounded-lg bg-primary-soft p-3">
              <p className="text-xs font-medium text-primary-soft-fg">Coach reply</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-primary-soft-fg">
                {checkin.coachReply}
              </p>
            </div>
          )
        )}
      </CardContent>
    </Card>
  );
}
