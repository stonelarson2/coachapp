// A tiny browser-only pub/sub used to celebrate food-logging streaks. When a
// food entry is written (addFoodLog), we dispatch a window CustomEvent so a
// mounted <StreakCelebration> can pop an animated streak toast — without
// threading callbacks through every logging call site.

export interface FoodLoggedDetail {
  userId: string;
  /** ISO date (YYYY-MM-DD) the food was logged for. */
  date: string;
}

const EVENT = "coachfit:food-logged";

/** Fire after a successful food-log write. No-op during SSR. */
export function emitFoodLogged(detail: FoodLoggedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<FoodLoggedDetail>(EVENT, { detail }));
}

/** Subscribe to food-logged events. Returns an unsubscribe function. */
export function onFoodLogged(handler: (detail: FoodLoggedDetail) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const listener = (e: Event) => handler((e as CustomEvent<FoodLoggedDetail>).detail);
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

/**
 * Milestone streak days that earn the full celebration (sparkles + hype copy):
 * 1, 2, 3, 5, 10, 20, 30, then every increment of 10.
 */
export function isStreakMilestone(streak: number): boolean {
  if (streak === 1 || streak === 2 || streak === 3 || streak === 5) return true;
  return streak >= 10 && streak % 10 === 0;
}

/** A short celebratory line to show alongside the streak number. */
export function streakMessage(
  streak: number,
  firstOfDay: boolean,
  milestone: boolean,
): string {
  if (!firstOfDay) return "Another one logged — keep it rolling!";
  if (!milestone) return "Logged for today — nice work!";
  if (streak <= 1) return "First log — your streak starts now!";
  if (streak === 2) return "Two in a row. You're on your way!";
  if (streak === 3) return "Three-day streak — habit forming!";
  if (streak === 5) return "Five days strong. Keep it up!";
  if (streak === 10) return "Ten days! You're on fire! 🔥";
  if (streak === 20) return "Twenty days — seriously impressive!";
  if (streak === 30) return "A whole month of consistency!";
  return `${streak} days in a row. Unstoppable!`;
}
