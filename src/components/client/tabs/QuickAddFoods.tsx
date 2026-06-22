"use client";

import * as React from "react";
import {
  addFavorite,
  addFoodLog,
  recentFoods,
  removeFavorite,
  useFavorites,
  useFoodLogRange,
  type QuickFood,
} from "@/lib/data";
import { daysAgoISO, energyLabel } from "@/lib/units";
import { useWorkspace } from "../context";
import type { MealType } from "@/lib/types";
import { Select } from "@/components/ui";

const MEALS: { id: MealType; label: string }[] = [
  { id: "breakfast", label: "Breakfast" },
  { id: "lunch", label: "Lunch" },
  { id: "dinner", label: "Dinner" },
  { id: "snacks", label: "Snacks" },
];

/** Sensible default meal based on the time of day. */
function mealByHour(): MealType {
  const h = new Date().getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 21) return "dinner";
  return "snacks";
}

interface ChipItem {
  food: QuickFood;
  favId?: string; // present when this food is a saved favorite
}

export function QuickAddFoods({ userId, date }: { userId: string; date: string }) {
  const cal = energyLabel(useWorkspace().energyUnit);
  const [meal, setMeal] = React.useState<MealType>(mealByHour());
  const { favorites } = useFavorites(userId);
  const { entries } = useFoodLogRange(userId, daysAgoISO(45));

  const items = React.useMemo<ChipItem[]>(() => {
    const favNames = new Set(favorites.map((f) => f.name.trim().toLowerCase()));
    const favChips: ChipItem[] = favorites.map((f) => ({
      food: { name: f.name, calories: f.calories, proteinG: f.proteinG, carbsG: f.carbsG, fatG: f.fatG },
      favId: f.id,
    }));
    const recentChips: ChipItem[] = recentFoods(entries)
      .filter((r) => !favNames.has(r.name.trim().toLowerCase()))
      .map((r) => ({ food: r }));
    return [...favChips, ...recentChips];
  }, [favorites, entries]);

  if (items.length === 0) return null;

  async function add(food: QuickFood) {
    await addFoodLog(userId, date, {
      meal,
      name: food.name,
      calories: Math.round(food.calories),
      proteinG: Math.round(food.proteinG),
      carbsG: Math.round(food.carbsG),
      fatG: Math.round(food.fatG),
    });
  }

  async function toggleFav(item: ChipItem) {
    if (item.favId) await removeFavorite(item.favId);
    else await addFavorite(userId, item.food);
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-sm font-semibold text-gray-900">⚡ Quick add</span>
        <Select
          value={meal}
          onChange={(e) => setMeal(e.target.value as MealType)}
          className="ml-auto h-8 w-auto"
          aria-label="Meal to add to"
        >
          {MEALS.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </Select>
      </div>

      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <span
            key={item.favId ?? `r-${i}`}
            className="inline-flex items-center overflow-hidden rounded-full border border-gray-300 bg-surface text-sm"
          >
            <button
              type="button"
              onClick={() => add(item.food)}
              className="max-w-[14rem] truncate py-1 pl-3 pr-2 text-gray-900 hover:bg-gray-50"
              title={`Add ${item.food.name} to ${meal}`}
            >
              {item.food.name}
              <span className="ml-1.5 text-xs text-gray-400">
                {Math.round(item.food.calories)} {cal}
              </span>
            </button>
            <button
              type="button"
              onClick={() => toggleFav(item)}
              className={`px-2 py-1 hover:bg-gray-50 ${item.favId ? "text-amber-500" : "text-gray-300"}`}
              aria-label={item.favId ? "Remove favorite" : "Save as favorite"}
              title={item.favId ? "Remove favorite" : "Save as favorite"}
            >
              {item.favId ? "★" : "☆"}
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
