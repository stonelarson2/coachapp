"use client";

import * as React from "react";
import { useFoodLogRange } from "@/lib/data";
import { loggingStreak } from "@/lib/adherence";
import { isStreakMilestone, onFoodLogged, streakMessage } from "@/lib/streak";
import { daysAgoISO } from "@/lib/units";

interface Popup {
  key: number;
  streak: number;
  firstOfDay: boolean;
  /** True on milestone streak days — earns the full celebration (sparkles). */
  milestone: boolean;
}

// Fixed spark offsets (CSS vars consumed by the streak-spark animation).
const SPARKS = [
  { dx: "-70px", dy: "-40px", delay: "0ms", emoji: "✨" },
  { dx: "72px", dy: "-32px", delay: "60ms", emoji: "⭐" },
  { dx: "-48px", dy: "44px", delay: "120ms", emoji: "✨" },
  { dx: "60px", dy: "48px", delay: "90ms", emoji: "🎉" },
  { dx: "0px", dy: "-64px", delay: "150ms", emoji: "⭐" },
];

/**
 * Mount once for a signed-in client. Listens for food-logged events and pops an
 * animated streak toast each time the client logs food. Auto-dismisses.
 */
export function StreakCelebration({ userId }: { userId: string }) {
  // A rolling window of recent logs so we can tell if today was already logged
  // and compute the current consecutive-day streak.
  const { entries } = useFoodLogRange(userId, daysAgoISO(60));
  const loggedDates = React.useMemo(
    () => new Set(entries.map((e) => e.date)),
    [entries],
  );
  const loggedRef = React.useRef(loggedDates);
  React.useEffect(() => {
    loggedRef.current = loggedDates;
  }, [loggedDates]);

  const [popup, setPopup] = React.useState<Popup | null>(null);
  const [leaving, setLeaving] = React.useState(false);
  const timers = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const seq = React.useRef(0);

  React.useEffect(() => {
    return onFoodLogged((detail) => {
      if (detail.userId !== userId) return;

      const dates = new Set(loggedRef.current);
      const firstOfDay = !dates.has(detail.date);
      dates.add(detail.date);
      const streak = loggingStreak(dates);
      const milestone = firstOfDay && isStreakMilestone(streak);

      // Reset any pending dismiss timers and (re)show the popup.
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setLeaving(false);
      seq.current += 1;
      setPopup({ key: seq.current, streak, firstOfDay, milestone });

      timers.current.push(setTimeout(() => setLeaving(true), 2600));
      timers.current.push(setTimeout(() => setPopup(null), 3000));
    });
  }, [userId]);

  React.useEffect(() => () => timers.current.forEach(clearTimeout), []);

  if (!popup) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-20 z-[100] flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div
        key={popup.key}
        className={`relative ${leaving ? "animate-streak-out" : "animate-streak-pop"}`}
      >
        {/* Sparkles — the full celebration, only on milestone streak days. */}
        {popup.milestone &&
          SPARKS.map((s, i) => (
            <span
              key={i}
              className="animate-streak-spark absolute left-1/2 top-1/2 text-lg"
              style={
                {
                  "--dx": s.dx,
                  "--dy": s.dy,
                  animationDelay: s.delay,
                } as React.CSSProperties
              }
            >
              {s.emoji}
            </span>
          ))}

        <div className="flex items-center gap-4 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-500 px-6 py-4 text-white shadow-xl ring-1 ring-black/5">
          <span className="animate-streak-flame text-4xl leading-none">🔥</span>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold leading-none">{popup.streak}</span>
              <span className="text-sm font-semibold text-white/90">
                day{popup.streak === 1 ? "" : "s"} streak
              </span>
            </div>
            <div className="mt-0.5 text-xs font-medium text-white/85">
              {streakMessage(popup.streak, popup.firstOfDay, popup.milestone)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
