// Calorie & macro calculations.
// Calorie targets use the Mifflin-St Jeor equation.

import type { ActivityLevel, Gender, GoalType, MacroTargets, Profile } from "./types";

/** Activity multipliers applied to BMR to estimate TDEE. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: "Sedentary (little/no exercise)",
  light: "Light (1-3 days/week)",
  moderate: "Moderate (3-5 days/week)",
  active: "Active (6-7 days/week)",
  very_active: "Very active (hard exercise / physical job)",
};

/** Calories per kg of body mass (~7700 kcal per kg, ~3500 kcal per lb). */
export const KCAL_PER_KG = 7700;

/** Macro tuning constants — exposed so they can be adjusted in one place. */
export const PROTEIN_G_PER_KG = 2.0; // ~0.9 g/lb
export const FAT_PCT_OF_CALORIES = 0.27; // ~27%
export const CALORIES_PER_G_PROTEIN = 4;
export const CALORIES_PER_G_CARB = 4;
export const CALORIES_PER_G_FAT = 9;

/** Mifflin-St Jeor Basal Metabolic Rate. */
export function calcBMR(profile: Profile): number {
  const { weightKg, heightCm, age, gender } = profile;
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return gender === "male" ? base + 5 : base - 161;
}

/** Total Daily Energy Expenditure = BMR * activity factor. */
export function calcTDEE(profile: Profile): number {
  return calcBMR(profile) * ACTIVITY_FACTORS[profile.activityLevel];
}

/**
 * Daily calorie target given a goal and a target rate of weight change per week.
 * A weekly change of `ratePerWeekKg` requires a daily deficit/surplus of
 * (ratePerWeekKg * KCAL_PER_KG) / 7.
 */
export function calcCalorieTarget(
  profile: Profile,
  goal: GoalType,
  ratePerWeekKg: number,
): number {
  const tdee = calcTDEE(profile);
  const dailyAdjustment = (Math.abs(ratePerWeekKg) * KCAL_PER_KG) / 7;
  if (goal === "maintain") return Math.round(tdee);
  if (goal === "cut") return Math.round(tdee - dailyAdjustment);
  return Math.round(tdee + dailyAdjustment); // bulk
}

export interface CalorieOptions {
  maintain: number;
  cut: number;
  bulk: number;
}

/**
 * Quick maintain/cut/bulk options for the calculator UI.
 * Cut/bulk default to ~0.5 kg/week (~1 lb/week).
 */
export function calcCalorieOptions(
  profile: Profile,
  ratePerWeekKg = 0.5,
): CalorieOptions {
  return {
    maintain: calcCalorieTarget(profile, "maintain", ratePerWeekKg),
    cut: calcCalorieTarget(profile, "cut", ratePerWeekKg),
    bulk: calcCalorieTarget(profile, "bulk", ratePerWeekKg),
  };
}

/**
 * Auto-calculate macro targets from a calorie target and body weight.
 * Protein scales with bodyweight, fat is a % of calories, carbs fill the rest.
 */
export function calcMacroTargets(calories: number, weightKg: number): MacroTargets {
  const proteinG = Math.round(weightKg * PROTEIN_G_PER_KG);
  const fatG = Math.round((calories * FAT_PCT_OF_CALORIES) / CALORIES_PER_G_FAT);
  const remaining =
    calories - proteinG * CALORIES_PER_G_PROTEIN - fatG * CALORIES_PER_G_FAT;
  const carbsG = Math.max(0, Math.round(remaining / CALORIES_PER_G_CARB));
  return { proteinG, carbsG, fatG };
}
