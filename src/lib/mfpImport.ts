// Parses a MyFitnessPal "Export Data" CSV into food log entries.
//
// MFP CSV columns: Date, Meal, Food Name, Calories, Carbohydrates (g), Fat (g), Protein (g), ...
// Summary rows ("Totals", "Daily Totals") are skipped.

import type { MealType } from "./types";

export interface MfpRow {
  date: string; // YYYY-MM-DD
  meal: MealType;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

const MEAL_MAP: Record<string, MealType> = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
  snacks: "snacks",
  snack: "snacks",
};

function parseMfpDate(raw: string): string | null {
  const trimmed = raw.trim();
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // MM/DD/YYYY
  const mdy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) return `${mdy[3]}-${mdy[1].padStart(2, "0")}-${mdy[2].padStart(2, "0")}`;
  return null;
}

function parseNum(s: string): number {
  const n = parseFloat(s.replace(/,/g, "").trim());
  return isNaN(n) ? 0 : n;
}

// Minimal CSV parser — handles quoted fields with commas inside.
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      fields.push(cur); cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

export function parseMfpCsv(csvText: string): { rows: MfpRow[]; skipped: number } {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { rows: [], skipped: 0 };

  // Find header row — look for a line containing "Food Name" or "Meal"
  let headerIdx = lines.findIndex(
    (l) => l.toLowerCase().includes("food name") || l.toLowerCase().includes("meal"),
  );
  if (headerIdx === -1) headerIdx = 0;

  const headers = parseCsvLine(lines[headerIdx]).map((h) => h.trim().toLowerCase());

  const col = (name: string) => headers.findIndex((h) => h.includes(name));
  const iDate = col("date");
  const iMeal = col("meal");
  const iName = col("food name");
  const iCal = col("calories");
  const iCarb = col("carbohydrate");
  const iFat = col("fat");
  const iProt = col("protein");

  if (iDate === -1 || iMeal === -1 || iName === -1) {
    throw new Error("Could not find required columns (Date, Meal, Food Name) in the CSV.");
  }

  const rows: MfpRow[] = [];
  let skipped = 0;

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const fields = parseCsvLine(lines[i]);
    const rawName = (fields[iName] ?? "").trim();
    const rawMeal = (fields[iMeal] ?? "").trim().toLowerCase();

    // Skip summary rows
    if (!rawName || rawName.toLowerCase() === "totals" || rawName.toLowerCase() === "daily totals") {
      skipped++;
      continue;
    }

    const date = parseMfpDate(fields[iDate] ?? "");
    if (!date) { skipped++; continue; }

    const meal = MEAL_MAP[rawMeal];
    if (!meal) { skipped++; continue; }

    rows.push({
      date,
      meal,
      name: rawName,
      calories: parseNum(fields[iCal] ?? "0"),
      carbsG: parseNum(fields[iCarb] ?? "0"),
      fatG: parseNum(fields[iFat] ?? "0"),
      proteinG: parseNum(fields[iProt] ?? "0"),
    });
  }

  return { rows, skipped };
}
