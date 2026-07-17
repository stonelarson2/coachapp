// Unit conversion + date helpers. Weight is stored internally in kg.

export const KG_PER_LB = 0.45359237;

export function kgToLb(kg: number): number {
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  return lb * KG_PER_LB;
}

export function cmToFtIn(cm: number): { ft: number; inches: number } {
  const totalInches = cm / 2.54;
  const ft = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - ft * 12);
  return { ft, inches };
}

export function ftInToCm(ft: number, inches: number): number {
  return (ft * 12 + inches) * 2.54;
}

/** Format a weight (stored in kg) for display in the user's preferred unit. */
export function formatWeight(kg: number, unit: "kg" | "lb"): string {
  if (unit === "lb") return `${kgToLb(kg).toFixed(1)} lb`;
  return `${kg.toFixed(1)} kg`;
}

/** Convert a displayed weight value back to kg for storage. */
export function toKg(value: number, unit: "kg" | "lb"): number {
  return unit === "lb" ? lbToKg(value) : value;
}

/** Display a stored-kg weight as a number in the chosen unit (no suffix). */
export function fromKg(kg: number, unit: "kg" | "lb"): number {
  return unit === "lb" ? kgToLb(kg) : kg;
}

export type EnergyUnit = "cal" | "kcal";

/**
 * The energy label to show in the UI. Calorie numbers are unchanged (food-label
 * "calories" are already kilocalories); this only swaps the displayed suffix.
 * Defaults to "cal".
 */
export function energyLabel(unit: EnergyUnit | undefined): string {
  return unit === "kcal" ? "kcal" : "cal";
}

// ---- Date helpers (work in local time, ISO YYYY-MM-DD keys) ----

export function todayISO(): string {
  return toISODate(new Date());
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const d = fromISODate(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

/** Monday (local) of the week containing `iso`. */
export function startOfWeekMonday(iso: string): string {
  const dow = fromISODate(iso).getDay(); // 0 Sun … 6 Sat
  return addDays(iso, -((dow + 6) % 7));
}

/** ISO date `days` ago from today (inclusive window start when days=N-1). */
export function daysAgoISO(days: number): string {
  return addDays(todayISO(), -days);
}

export function formatDatePretty(iso: string): string {
  return fromISODate(iso).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
