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
  /** Preferred display unit for weight in the UI. */
  weightUnit?: "kg" | "lb";
  /** Denormalized weight snapshots (kg) for fast dashboard rendering. */
  startWeightKg?: number;
  currentWeightKg?: number;
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

export type InsightPeriod = "week" | "2weeks" | "month";

/** insights/{id} */
export interface InsightDoc {
  id: string;
  userId: string;
  period: InsightPeriod;
  text: string;
  createdAt: number;
}
