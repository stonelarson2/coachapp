"use client";

import * as React from "react";
import { authedFetch } from "@/lib/api";
import { addFoodLog } from "@/lib/data";
import type { FoodItem, MealType } from "@/lib/types";
import { Button, Input, Select, Spinner } from "@/components/ui";
import { energyLabel } from "@/lib/units";
import { useWorkspace } from "../context";
import { BarcodeScanner } from "../BarcodeScanner";

const MEALS: { id: MealType; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snacks", label: "Snacks" },
];

interface SearchResponse {
  items: FoodItem[];
  error?: string;
}

export function FoodSearch({
  userId,
  date,
  onAdded,
}: {
  userId: string;
  date: string;
  onAdded?: () => void;
}) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<FoodItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");
  const [selected, setSelected] = React.useState<FoodItem | null>(null);
  const [scannerOpen, setScannerOpen] = React.useState(false);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const cal = energyLabel(useWorkspace().energyUnit);

  // Debounced text search, driven from the input's change handler.
  function onQueryChange(value: string) {
    setQuery(value);
    setSelected(null);
    setError("");
    if (timerRef.current) clearTimeout(timerRef.current);

    const q = value.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await authedFetch<SearchResponse>("/api/foods", { query: q });
        setResults(res.items);
        setError(res.items.length === 0 ? "No foods found. Try a different search." : "");
      } catch (err) {
        setError((err as Error).message);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);
  }

  React.useEffect(() => () => clearTimeout(timerRef.current), []);

  async function handleBarcode(barcode: string) {
    setScannerOpen(false);
    setError("");
    setLoading(true);
    try {
      const res = await authedFetch<SearchResponse>("/api/foods", { barcode });
      if (res.items.length > 0) {
        setQuery("");
        setResults(res.items);
        setSelected(res.items[0]); // open the scanned product straight away
      } else {
        setError(res.error || "No product found for that barcode.");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">🔍 Search foods</span>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Search a food, e.g. greek yogurt"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
        />
        <Button variant="secondary" size="md" onClick={() => setScannerOpen(true)}>
          📷 Scan
        </Button>
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {loading && (
        <div className="mt-4 flex justify-center">
          <Spinner />
        </div>
      )}

      {!loading && results.length > 0 && (
        <ul className="mt-3 max-h-72 divide-y divide-gray-100 overflow-y-auto">
          {results.map((item) => (
            <li key={`${item.source}-${item.sourceId}`}>
              <button
                type="button"
                onClick={() => setSelected(item)}
                className={`flex w-full items-center justify-between gap-3 px-1 py-2 text-left text-sm hover:bg-gray-50 ${
                  selected?.sourceId === item.sourceId && selected?.source === item.source
                    ? "bg-gray-50"
                    : ""
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-gray-900">{item.name}</span>
                  {item.brand && (
                    <span className="block truncate text-xs text-gray-400">{item.brand}</span>
                  )}
                </span>
                <span className="whitespace-nowrap text-xs text-gray-500">
                  {Math.round(item.per100g.calories)} {cal}/100g
                </span>
              </button>
              {selected?.sourceId === item.sourceId && selected?.source === item.source && (
                <FoodAmountEditor
                  food={item}
                  cal={cal}
                  onAdd={async (entry) => {
                    await addFoodLog(userId, date, entry);
                    setSelected(null);
                    setQuery("");
                    setResults([]);
                    onAdded?.();
                  }}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={handleBarcode}
      />
    </div>
  );
}

function FoodAmountEditor({
  food,
  cal,
  onAdd,
}: {
  food: FoodItem;
  cal: string;
  onAdd: (entry: {
    meal: MealType;
    name: string;
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  }) => Promise<void>;
}) {
  // Portion options: each named serving, plus a raw grams option.
  const GRAMS = "__grams__";
  const [portion, setPortion] = React.useState<string>(
    food.servings.length > 0 ? "0" : GRAMS,
  );
  const [count, setCount] = React.useState("1");
  const [grams, setGrams] = React.useState("100");
  const [meal, setMeal] = React.useState<MealType>("breakfast");
  const [busy, setBusy] = React.useState(false);

  const isGrams = portion === GRAMS;
  const serving = isGrams ? null : food.servings[Number(portion)];

  const totalGrams = isGrams
    ? Number(grams) || 0
    : (serving?.grams ?? 0) * (Number(count) || 0);

  const factor = totalGrams / 100;
  const scaled = {
    calories: food.per100g.calories * factor,
    proteinG: food.per100g.proteinG * factor,
    carbsG: food.per100g.carbsG * factor,
    fatG: food.per100g.fatG * factor,
  };

  function portionLabel(): string {
    if (isGrams) return `${Math.round(totalGrams)} g`;
    const c = Number(count) || 0;
    return c === 1 ? serving!.label : `${count} × ${serving!.label}`;
  }

  async function submit() {
    if (totalGrams <= 0) return;
    setBusy(true);
    try {
      const base = food.brand ? `${food.name} (${food.brand})` : food.name;
      await onAdd({
        meal,
        name: `${base} — ${portionLabel()}`,
        calories: Math.round(scaled.calories),
        proteinG: Math.round(scaled.proteinG),
        carbsG: Math.round(scaled.carbsG),
        fatG: Math.round(scaled.fatG),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-1 rounded-lg bg-gray-50 p-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="sm:col-span-2">
          <Select value={portion} onChange={(e) => setPortion(e.target.value)}>
            {food.servings.map((s, i) => (
              <option key={i} value={String(i)}>
                {s.label} ({Math.round(s.grams)} g)
              </option>
            ))}
            <option value={GRAMS}>Grams</option>
          </Select>
        </div>
        {isGrams ? (
          <Input
            type="number"
            min="0"
            step="1"
            value={grams}
            onChange={(e) => setGrams(e.target.value)}
            aria-label="Grams"
          />
        ) : (
          <Input
            type="number"
            min="0"
            step="0.5"
            value={count}
            onChange={(e) => setCount(e.target.value)}
            aria-label="Number of servings"
          />
        )}
        <Select value={meal} onChange={(e) => setMeal(e.target.value as MealType)}>
          {MEALS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </Select>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm text-gray-600">
          <span className="font-medium text-gray-900">{Math.round(scaled.calories)} {cal}</span>
          <span className="ml-2 text-xs text-gray-400">
            P{Math.round(scaled.proteinG)} C{Math.round(scaled.carbsG)} F{Math.round(scaled.fatG)}
          </span>
        </span>
        <Button size="sm" onClick={submit} disabled={busy || totalGrams <= 0}>
          {busy ? "Adding…" : "Add to log"}
        </Button>
      </div>
    </div>
  );
}
