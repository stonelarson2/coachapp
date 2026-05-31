// Coaching plan catalog. Prices are in USD cents.
//
// Each plan can be paid two ways:
//   - "upfront":      a single one-time payment (best price)
//   - "installment":  monthly payments over the plan length, at a +10% premium
//
// Stripe price IDs are filled in by scripts/provision-stripe.mjs after the
// products are created, and pasted back here (price IDs are not secret).

export type PlanKey = "3mo" | "6mo" | "1yr";
export type PayKind = "upfront" | "installment";

export interface PlanDef {
  key: PlanKey;
  label: string;
  months: number;
  /** One-time upfront total, in cents. */
  upfrontCents: number;
  /** Per-month installment amount, in cents (already includes the +10% premium). */
  installmentMonthlyCents: number;
  /** Stripe price IDs — populated after provisioning. */
  upfrontPriceId?: string;
  installmentPriceId?: string;
}

const INSTALLMENT_PREMIUM = 1.1;

function monthly(upfrontCents: number, months: number): number {
  return Math.round((upfrontCents * INSTALLMENT_PREMIUM) / months);
}

export const PLANS: Record<PlanKey, PlanDef> = {
  "3mo": {
    key: "3mo",
    label: "3-Month Coaching",
    months: 3,
    upfrontCents: 60000,
    installmentMonthlyCents: monthly(60000, 3), // $220.00
    upfrontPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_3MO_UPFRONT,
    installmentPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_3MO_INSTALLMENT,
  },
  "6mo": {
    key: "6mo",
    label: "6-Month Coaching",
    months: 6,
    upfrontCents: 100000,
    installmentMonthlyCents: monthly(100000, 6), // $183.33
    upfrontPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_6MO_UPFRONT,
    installmentPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_6MO_INSTALLMENT,
  },
  "1yr": {
    key: "1yr",
    label: "1-Year Coaching",
    months: 12,
    upfrontCents: 180000,
    installmentMonthlyCents: monthly(180000, 12), // $165.00
    upfrontPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_1YR_UPFRONT,
    installmentPriceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_1YR_INSTALLMENT,
  },
};

export const PLAN_LIST: PlanDef[] = [PLANS["3mo"], PLANS["6mo"], PLANS["1yr"]];

export function formatUsd(cents: number): string {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
