"use client";

import * as React from "react";
import { useFoodLogRange } from "@/lib/data";
import { loggingStreak } from "@/lib/adherence";
import { daysAgoISO } from "@/lib/units";

/**
 * A compact 🔥 badge showing a user's current consecutive-day food-logging
 * streak. Renders nothing until there's an active streak. Shown in the client
 * header (coach sees the client's streak; a client sees their own).
 */
export function StreakBadge({ userId }: { userId: string }) {
  const { entries } = useFoodLogRange(userId, daysAgoISO(60));
  const streak = React.useMemo(
    () => loggingStreak(new Set(entries.map((e) => e.date))),
    [entries],
  );

  if (streak < 1) return null;

  return (
    <span
      title={`${streak}-day logging streak`}
      className="inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm"
    >
      <span aria-hidden>🔥</span>
      {streak} day{streak === 1 ? "" : "s"}
    </span>
  );
}
