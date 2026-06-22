"use client";

import * as React from "react";
import { authedFetch } from "@/lib/api";
import { downscaleImage, type EncodedImage } from "@/lib/image";
import { addFoodLog } from "@/lib/data";
import type { MealType } from "@/lib/types";
import { Button, Input, Select } from "@/components/ui";
import { energyLabel } from "@/lib/units";
import { useWorkspace } from "../context";
import { CameraCapture } from "../CameraCapture";

interface EstimatedItem {
  name: string;
  quantity: string;
  gramsEstimate?: number;
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

// Editable working copy of an estimated item (all numeric fields are strings
// while being edited).
interface EditItem {
  include: boolean;
  name: string;
  quantity: string;
  grams: string;
  calories: string;
  proteinG: string;
  carbsG: string;
  fatG: string;
}

const MEALS: { id: MealType; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snacks", label: "Snacks" },
];

function toEdit(it: EstimatedItem): EditItem {
  return {
    include: true,
    name: it.name,
    quantity: it.quantity,
    grams: it.gramsEstimate ? String(Math.round(it.gramsEstimate)) : "",
    calories: String(Math.round(it.calories)),
    proteinG: String(Math.round(it.proteinG)),
    carbsG: String(Math.round(it.carbsG)),
    fatG: String(Math.round(it.fatG)),
  };
}

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
  const [items, setItems] = React.useState<EditItem[]>([]);
  const [meal, setMeal] = React.useState<MealType>("breakfast");

  // Photo mode
  const [images, setImages] = React.useState<EncodedImage[]>([]);
  const [clarifications, setClarifications] = React.useState("");
  const [cameraOpen, setCameraOpen] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Text mode
  const [description, setDescription] = React.useState("");
  const [amount, setAmount] = React.useState("");

  function resetResult() {
    setResult(null);
    setItems([]);
    setError("");
  }

  async function pickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    resetResult();
    try {
      const encoded = await Promise.all(files.map((f) => downscaleImage(f)));
      setImages((prev) => [...prev, ...encoded].slice(0, 4));
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function addCameraImage(img: EncodedImage) {
    resetResult();
    setImages((prev) => [...prev, img].slice(0, 4));
  }

  function applyResult(r: EstimateResult) {
    setResult(r);
    setItems(r.items.map(toEdit));
  }

  async function estimate() {
    setError("");
    setBusy(true);
    try {
      if (subMode === "photo") {
        if (images.length === 0) {
          setError("Add at least one food photo first.");
          return;
        }
        const r = await authedFetch<EstimateResult>("/api/food-estimate", {
          mode: "photo",
          images,
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

  function updateItem(i: number, patch: Partial<EditItem>) {
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  /** Multiply an item's grams + macros by a factor (portion scaling). */
  function scaleItem(i: number, factor: number) {
    setItems((prev) =>
      prev.map((it, idx) => {
        if (idx !== i) return it;
        const mul = (s: string) => String(Math.round((Number(s) || 0) * factor));
        return {
          ...it,
          grams: it.grams ? mul(it.grams) : it.grams,
          calories: mul(it.calories),
          proteinG: mul(it.proteinG),
          carbsG: mul(it.carbsG),
          fatG: mul(it.fatG),
        };
      }),
    );
  }

  const included = items.filter((it) => it.include);
  const totalCals = included.reduce((s, it) => s + (Number(it.calories) || 0), 0);

  async function addItems() {
    if (included.length === 0) return;
    setBusy(true);
    setError("");
    try {
      for (const it of included) {
        const name = it.quantity.trim() ? `${it.name.trim()} (${it.quantity.trim()})` : it.name.trim();
        await addFoodLog(userId, date, {
          meal,
          name,
          calories: Math.round(Number(it.calories) || 0),
          proteinG: Math.round(Number(it.proteinG) || 0),
          carbsG: Math.round(Number(it.carbsG) || 0),
          fatG: Math.round(Number(it.fatG) || 0),
        });
      }
      // Reset everything for the next estimate.
      resetResult();
      setImages([]);
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
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={pickFiles}
          />
          {images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {images.map((im, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`data:${im.mediaType};base64,${im.data}`}
                    alt={`Food ${i + 1}`}
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gray-800 text-xs text-white"
                    aria-label="Remove photo"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => setCameraOpen(true)}>
              📷 Camera
            </Button>
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()}>
              {images.length > 0 ? "Add photo" : "Choose photo"}
            </Button>
            {images.length > 0 && (
              <Button size="sm" onClick={estimate} disabled={busy}>
                {busy ? "Analyzing…" : `Estimate macros${images.length > 1 ? ` (${images.length})` : ""}`}
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
          <p className="text-xs text-gray-500">
            Review and tweak before adding — edit any number, or use ½ / 2× to rescale a portion.
          </p>

          <ul className="space-y-2">
            {items.map((it, i) => (
              <li key={i} className="rounded-lg bg-gray-50 p-3">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={it.include}
                    onChange={(e) => updateItem(i, { include: e.target.checked })}
                    className="h-4 w-4"
                  />
                  <Input
                    className="h-8 flex-1"
                    value={it.name}
                    onChange={(e) => updateItem(i, { name: e.target.value })}
                  />
                  <div className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      onClick={() => scaleItem(i, 0.5)}
                      className="rounded border border-gray-300 px-2 text-xs text-gray-600 hover:bg-gray-100"
                    >
                      ½
                    </button>
                    <button
                      type="button"
                      onClick={() => scaleItem(i, 2)}
                      className="rounded border border-gray-300 px-2 text-xs text-gray-600 hover:bg-gray-100"
                    >
                      2×
                    </button>
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
                  <LabeledNum label="qty" text value={it.quantity} onChange={(v) => updateItem(i, { quantity: v })} />
                  <LabeledNum label={cal} value={it.calories} onChange={(v) => updateItem(i, { calories: v })} />
                  <LabeledNum label="P (g)" value={it.proteinG} onChange={(v) => updateItem(i, { proteinG: v })} />
                  <LabeledNum label="C (g)" value={it.carbsG} onChange={(v) => updateItem(i, { carbsG: v })} />
                  <LabeledNum label="F (g)" value={it.fatG} onChange={(v) => updateItem(i, { fatG: v })} />
                </div>
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

          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
            <span className="text-sm text-gray-500">
              {Math.round(totalCals)} {cal} · add to
            </span>
            <Select value={meal} onChange={(e) => setMeal(e.target.value as MealType)} className="w-auto">
              {MEALS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </Select>
            <Button size="sm" onClick={addItems} disabled={busy || included.length === 0}>
              Add {included.length} item{included.length === 1 ? "" : "s"}
            </Button>
          </div>
        </div>
      )}

      <CameraCapture open={cameraOpen} onClose={() => setCameraOpen(false)} onCapture={addCameraImage} />
    </div>
  );
}

function LabeledNum({
  label,
  value,
  onChange,
  text,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  text?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-gray-400">{label}</span>
      <Input
        className="h-8"
        type={text ? "text" : "number"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
