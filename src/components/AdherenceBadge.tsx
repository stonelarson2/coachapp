"use client";

import { useFoodLogRange } from "@/lib/data";
import { daysAgoISO } from "@/lib/units";
import { adherenceBand, computeAdherence } from "@/lib/adherence";
import { Badge } from "@/components/ui";
import type { MacroTargets } from "@/lib/types";

/**
 * A colored adherence pill for a single user, computed live from their food logs
 * over the trailing `days` window. Used on the coach dashboard (per client) and
 * on the client overview.
 */
export function AdherenceBadge({
  userId,
  calorieTarget,
  macroTargets,
  days = 14,
  showLabel = true,
}: {
  userId: string;
  calorieTarget?: number;
  macroTargets?: MacroTargets;
  days?: number;
  showLabel?: boolean;
}) {
  const { entries, loading } = useFoodLogRange(userId, daysAgoISO(days - 1));

  if (loading) return <span className="text-xs text-gray-400">…</span>;

  const res = computeAdherence(entries, days, calorieTarget, macroTargets);
  const band = adherenceBand(res.score);

  if (res.daysLogged === 0) {
    return <Badge color="gray">No logs</Badge>;
  }

  return (
    <Badge color={band.color}>
      {res.score}%{showLabel ? ` · ${band.label}` : ""}
    </Badge>
  );
}
