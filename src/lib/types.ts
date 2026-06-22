// Shared domain types for the coaching app.

export type Role = "coach" | "client";

export type Gender = "male" | "female";

export type ActivityLevel =
  | "sedentary"
  | "light"
  | "moderate"
  | "active"
  | "very_active";

export type GoalType = "cut" | "bulk" | "maintain";

export type MeetingFrequency = "weekly" | "biweekly" | "monthly" | "off";

export type MealType = "breakfast" | "lunch" | "dinner" | "snacks";

export interface Profile {
  age: number;
  heightCm: number;
  weightKg: number;
  gender: Gender;
  activityLevel: ActivityLevel;
}

export interface Goal {
  type: GoalType;
  /** Target rate of weight change per week, in kg (positive number; direction implied by goal type). */
  targetRatePerWeekKg: number;
}

export interface MacroTargets {
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface MeetingSettings {
  frequency: MeetingFrequency;
  zoomLink?: string;
  lastRemindedAt?: number; // epoch ms
}

export type PlanKey = "3mo" | "6mo" | "1yr";
export type PayKind = "upfront" | "installment";
export type BillingStatus = "none" | "pending" | "active" | "past_due" | "canceled" | "completed";

/** A client's billing state, updated server-side from Stripe webhooks. */
export interface Billing {
  status: BillingStatus;
  planKey?: PlanKey;
  payKind?: PayKind;
  stripeCustomerId?: string;
  /** Subscription id for installment plans. */
  stripeSubscriptionId?: string;
  /** ISO date the current access period ends (installments) or plan ends. */
  currentPeriodEnd?: string;
  /** Epoch ms of the last successful payment. */
  lastPaymentAt?: number;
  updatedAt?: number;
}

/** A user document stored at users/{uid}. */
export interface UserDoc {
  uid: string;
  role: Role;
  name: string;
  email: string;
  // Clients only
  coachId?: string;
  // Coaches only
  inviteCode?: string;
  profile?: Profile;
  goal?: Goal;
  calorieTarget?: number;
  macroTargets?: MacroTargets;
  meeting?: MeetingSettings;
  /** Billing state for clients (set server-side via Stripe webhooks). */
  billing?: Billing;
  /** Preferred display unit for weight in the UI. */
  weightUnit?: "kg" | "lb";
  /** Denormalized weight snapshots (kg) for fast dashboard rendering. */
  startWeightKg?: number;
  currentWeightKg?: number;
  /** True for the seeded demo client created via "Load example client". */
  isExample?: boolean;
  createdAt: number; // epoch ms
}

/** weightEntries/{id} */
export interface WeightEntry {
  id: string;
  userId: string;
  weightKg: number;
  /** ISO date string YYYY-MM-DD */
  date: string;
  createdAt: number;
}

/** foodLogs/{id} */
export interface FoodLogEntry {
  id: string;
  userId: string;
  /** ISO date string YYYY-MM-DD */
  date: string;
  meal: MealType;
  name: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  createdAt: number;
}

/** photos/{id} */
export interface PhotoDoc {
  id: string;
  userId: string;
  storagePath: string;
  url: string;
  /** ISO date string YYYY-MM-DD */
  date: string;
  note?: string;
  createdAt: number;
}

/** messages/{id} */
export interface MessageDoc {
  id: string;
  coachId: string;
  clientId: string;
  senderId: string;
  text: string;
  createdAt: number;
}

/** Weekly check-in 1-5 self-ratings. */
export interface CheckinRatings {
  nutrition: number;
  training: number;
  sleep: number;
  energy: number;
  mood: number;
  stress: number;
}

/** checkins/{id} — a client's weekly check-in, reviewed by their coach. */
export interface CheckinDoc {
  id: string;
  userId: string;
  coachId?: string;
  /** ISO date (Monday) identifying the week. */
  weekOf: string;
  weightKg?: number;
  ratings: CheckinRatings;
  notes: string;
  coachReply?: string;
  coachRepliedAt?: number;
  createdAt: number;
}

/** A named serving for a food (e.g. "1 cup" = 240 g). */
export interface FoodServing {
  label: string;
  grams: number;
}

/**
 * A normalized food returned by the food-database search (USDA FoodData Central
 * or Open Food Facts). Macros are always expressed per 100 g so the client can
 * scale to any amount; `servings` offers common portions when available.
 */
export interface FoodItem {
  source: "usda" | "off";
  /** fdcId (USDA) or barcode/code (Open Food Facts). */
  sourceId: string;
  name: string;
  brand?: string;
  per100g: {
    calories: number;
    proteinG: number;
    carbsG: number;
    fatG: number;
  };
  servings: FoodServing[];
}

export type InsightPeriod = "week" | "2weeks" | "month";

/** insights/{id} */
export interface InsightDoc {
  id: string;
  userId: string;
  period: InsightPeriod;
  text: string;
  createdAt: number;
}
