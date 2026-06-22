import "server-only";
import type { FoodItem, FoodServing } from "@/lib/types";

// Food-database access shared by the /api/foods route and the AI estimator's
// database cross-check. Searches USDA FoodData Central (when a key is set) and
// Open Food Facts, normalizing both to FoodItem (macros per 100 g + servings).

// Open Food Facts asks API consumers to identify themselves with a User-Agent.
const OFF_UA = "CoachFit/1.0 (https://mycoachfit.xyz)";
const OFF_FIELDS = "code,product_name,brands,nutriments,serving_size,serving_quantity";

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

// ---- USDA FoodData Central ----

interface UsdaNutrient {
  nutrientNumber?: string;
  value?: number;
}
interface UsdaMeasure {
  disseminationText?: string;
  gramWeight?: number;
}
interface UsdaFood {
  fdcId: number;
  description?: string;
  brandName?: string;
  brandOwner?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: UsdaNutrient[];
  foodMeasures?: UsdaMeasure[];
}

function usdaNutrient(food: UsdaFood, number: string): number {
  const n = food.foodNutrients?.find((x) => x.nutrientNumber === number);
  return typeof n?.value === "number" ? n.value : 0;
}

function normalizeUsda(food: UsdaFood): FoodItem | null {
  const calories = usdaNutrient(food, "208");
  const proteinG = usdaNutrient(food, "203");
  const carbsG = usdaNutrient(food, "205");
  const fatG = usdaNutrient(food, "204");
  if (!food.description || (calories === 0 && proteinG === 0 && carbsG === 0 && fatG === 0)) {
    return null;
  }

  const servings: FoodServing[] = [];
  if (food.servingSize && (food.servingSizeUnit === "g" || food.servingSizeUnit === "G")) {
    const label = food.householdServingFullText?.trim() || `${food.servingSize} g serving`;
    servings.push({ label, grams: food.servingSize });
  }
  for (const m of food.foodMeasures ?? []) {
    if (m.gramWeight && m.disseminationText && servings.length < 6) {
      servings.push({ label: m.disseminationText, grams: round1(m.gramWeight) });
    }
  }

  return {
    source: "usda",
    sourceId: String(food.fdcId),
    name: food.description,
    brand: food.brandName || food.brandOwner || undefined,
    per100g: {
      calories: round1(calories),
      proteinG: round1(proteinG),
      carbsG: round1(carbsG),
      fatG: round1(fatG),
    },
    servings,
  };
}

async function searchUsda(query: string): Promise<FoodItem[]> {
  const apiKey = process.env.USDA_FDC_API_KEY;
  if (!apiKey) return []; // USDA is optional; Open Food Facts still works without a key.
  try {
    const res = await fetch(
      `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          pageSize: 20,
          dataType: ["Foundation", "SR Legacy", "Branded"],
        }),
      },
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { foods?: UsdaFood[] };
    return (data.foods ?? []).map(normalizeUsda).filter((f): f is FoodItem => f !== null);
  } catch {
    return [];
  }
}

// ---- Open Food Facts ----

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

function offNum(v: number | string | undefined): number {
  const n = typeof v === "string" ? parseFloat(v) : v;
  return typeof n === "number" && isFinite(n) ? n : 0;
}

function normalizeOff(p: OffProduct): FoodItem | null {
  const name = (p.product_name || "").trim();
  if (!name || !p.code) return null;
  const nut = p.nutriments ?? {};

  let calories = offNum(nut["energy-kcal_100g"]);
  if (calories === 0) {
    const kj = offNum(nut["energy-kj_100g"]) || offNum(nut["energy_100g"]);
    if (kj > 0) calories = kj / 4.184;
  }
  const proteinG = offNum(nut["proteins_100g"]);
  const carbsG = offNum(nut["carbohydrates_100g"]);
  const fatG = offNum(nut["fat_100g"]);
  if (calories === 0 && proteinG === 0 && carbsG === 0 && fatG === 0) return null;

  const servings: FoodServing[] = [];
  const servingG = offNum(p.serving_quantity);
  if (servingG > 0) {
    servings.push({ label: p.serving_size?.trim() || "1 serving", grams: round1(servingG) });
  }

  return {
    source: "off",
    sourceId: p.code,
    name,
    brand: p.brands?.split(",")[0]?.trim() || undefined,
    per100g: {
      calories: round1(calories),
      proteinG: round1(proteinG),
      carbsG: round1(carbsG),
      fatG: round1(fatG),
    },
    servings,
  };
}

async function searchOff(query: string): Promise<FoodItem[]> {
  try {
    const url =
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
      `&search_simple=1&action=process&json=1&page_size=20&fields=${OFF_FIELDS}`;
    const res = await fetch(url, { headers: { "User-Agent": OFF_UA } });
    if (!res.ok) return [];
    const data = (await res.json()) as { products?: OffProduct[] };
    return (data.products ?? []).map(normalizeOff).filter((f): f is FoodItem => f !== null);
  } catch {
    return [];
  }
}

export async function lookupBarcode(barcode: string): Promise<FoodItem | null> {
  const code = barcode.replace(/\D/g, "");
  if (!code) return null;
  try {
    const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${OFF_FIELDS}`;
    const res = await fetch(url, { headers: { "User-Agent": OFF_UA } });
    if (!res.ok) return null;
    const data = (await res.json()) as { status?: number; product?: OffProduct };
    if (data.status !== 1 || !data.product) return null;
    return normalizeOff(data.product);
  } catch {
    return null;
  }
}

/** Interleave two lists so both sources are represented near the top. */
function interleave(a: FoodItem[], b: FoodItem[]): FoodItem[] {
  const out: FoodItem[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    if (i < a.length) out.push(a[i]);
    if (i < b.length) out.push(b[i]);
  }
  return out;
}

/** Text search across USDA + Open Food Facts, interleaved. */
export async function searchFoods(query: string): Promise<FoodItem[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const [usda, off] = await Promise.all([searchUsda(q), searchOff(q)]);
  return interleave(usda, off);
}
