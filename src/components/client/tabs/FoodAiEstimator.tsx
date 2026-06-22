"use client";

import * as React from "react";
import { authedFetch } from "@/lib/api";
import { downscaleImage, type EncodedImage } from "@/lib/image";
import { addFoodLog } from "@/lib/data";
import type { MealType } from "@/lib/types";
import { Button, Input, Select } from "@/components/ui";
import { energyLabel } from "@/lib/units";
import { useWorkspace } from "../context";

interface EstimatedItem {
  name: string;
  quantity: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}
interface EstimateResult {
  items: EstimatedItem[];
  assumptions: string[];
  questions: string[];
  confidence: "low" | "medium" | "high";
}

const MEALS: { id: MealType; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snacks", label: "Snacks" },
];

export function FoodAiEstimator({
  userId,
  date,
  onAdded,
}: {
  userId: string;
  date: string;
  onAdded?: () => void;
}) {
  const cal = energyLabel(useWorkspace().energyUnit);
  const [subMode, setSubMode] = React.useState<"photo" | "text">("photo");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [result, setResult] = React.useState<EstimateResult | null>(null);
  const [selected, setSelected] = React.useState<Set<number>>(new Set());
  const [meal, setMeal] = React.useState<MealType>("breakfast");

  // Photo mode
  const [encoded, setEncoded] = React.useState<EncodedImage | null>(null);
  const [preview, setPreview] = React.useState<string>("");
  const [clarifications, setClarifications] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Text mode
  const [description, setDescription] = React.useState("");
  const [amount, setAmount] = React.useState("");

  function resetResult() {
    setResult(null);
    setSelected(new Set());
    setError("");
  }

  async function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    resetResult();
    setClarifications("");
    try {
      const enc = await downscaleImage(file);
      setEncoded(enc);
      setPreview(`data:${enc.mediaType};base64,${enc.data}`);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function applyResult(r: EstimateResult) {
    setResult(r);
    // Default to including every item.
    setSelected(new Set(r.items.map((_, i) => i)));
  }

  async function estimate() {
    setError("");
    setBusy(true);
    try {
      if (subMode === "photo") {
        if (!encoded) {
          setError("Choose a food photo first.");
          return;
        }
        const r = await authedFetch<EstimateResult>("/api/food-estimate", {
          mode: "photo",
          image: encoded,
          clarifications: clarifications.trim() || undefined,
        });
        applyResult(r);
      } else {
        if (!description.trim()) {
          setError("Enter a food description.");
          return;
        }
        const r = await authedFetch<EstimateResult>("/api/food-estimate", {
          mode: "text",
          description: description.trim(),
          amount: amount.trim() || undefined,
        });
        applyResult(r);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function toggle(i: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function addSelected() {
    if (!result) return;
    setBusy(true);
    setError("");
    try {
      const chosen = result.items.filter((_, i) => selected.has(i));
      for (const it of chosen) {
        await addFoodLog(userId, date, {
          meal,
          name: it.quantity ? `${it.name} (${it.quantity})` : it.name,
          calories: Math.round(it.calories),
          proteinG: Math.round(it.proteinG),
          carbsG: Math.round(it.carbsG),
          fatG: Math.round(it.fatG),
        });
      }
      // Reset for the next estimate.
      setResult(null);
      setSelected(new Set());
      setEncoded(null);
      setPreview("");
      setClarifications("");
      setDescription("");
      setAmount("");
      onAdded?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">✨ AI estimate</span>
        <div className="ml-auto flex rounded-lg border border-gray-200 p-0.5 text-xs">
          <button
            onClick={() => { setSubMode("photo"); resetResult(); }}
            className={`rounded-md px-2.5 py-1 ${subMode === "photo" ? "bg-primary-soft text-primary-soft-fg" : "text-gray-500"}`}
          >
            Scan photo
          </button>
          <button
            onClick={() => { setSubMode("text"); resetResult(); }}
            className={`rounded-md px-2.5 py-1 ${subMode === "text" ? "bg-primary-soft text-primary-soft-fg" : "text-gray-500"}`}
          >
            Describe
          </button>
        </div>
      </div>

      {subMode === "photo" ? (
        <div className="space-y-3">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={pickFile} />
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Food" className="max-h-48 rounded-lg object-contain" />
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              {preview ? "Change photo" : "Choose photo"}
            </Button>
            {encoded && (
              <Button size="sm" onClick={estimate} disabled={busy}>
                {busy ? "Analyzing…" : "Estimate macros"}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Input
              className="sm:col-span-2"
              placeholder="e.g. Grilled chicken breast"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <Input
              placeholder="Amount, e.g. 200 g"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <Button size="sm" onClick={estimate} disabled={busy}>
            {busy ? "Estimating…" : "Estimate macros"}
          </Button>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {result && (
        <div className="mt-4 space-y-3 border-t border-gray-100 pt-3">
          <ul className="space-y-1.5">
            {result.items.map((it, i) => (
              <li key={i} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggle(i)}
                  className="h-4 w-4"
                />
                <span className="flex-1 text-gray-900">
                  {it.name} <span className="text-gray-400">{it.quantity}</span>
                </span>
                <span className="text-gray-500">{Math.round(it.calories)} {cal}</span>
                <span className="text-xs text-gray-400">
                  P{Math.round(it.proteinG)} C{Math.round(it.carbsG)} F{Math.round(it.fatG)}
                </span>
              </li>
            ))}
          </ul>

          {result.assumptions.length > 0 && (
            <p className="text-xs text-gray-500">
              <span className="font-medium">Assumptions:</span> {result.assumptions.join("; ")}
            </p>
          )}

          {result.questions.length > 0 && subMode === "photo" && (
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xs font-medium text-amber-900">
                To improve accuracy{result.confidence === "low" ? " (low confidence)" : ""}:
              </p>
              <ul className="mt-1 list-disc pl-4 text-xs text-amber-800">
                {result.questions.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
              <textarea
                value={clarifications}
                onChange={(e) => setClarifications(e.target.value)}
                placeholder="Answer here, then re-estimate…"
                className="mt-2 w-full rounded-md border border-amber-200 bg-surface p-2 text-sm"
                rows={2}
              />
              <Button size="sm" variant="secondary" className="mt-2" onClick={estimate} disabled={busy}>
                {busy ? "Re-estimating…" : "Re-estimate with answers"}
              </Button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-500">Add to</span>
            <Select value={meal} onChange={(e) => setMeal(e.target.value as MealType)} className="w-auto">
              {MEALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </Select>
            <Button size="sm" onClick={addSelected} disabled={busy || selected.size === 0}>
              Add {selected.size} item{selected.size === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
