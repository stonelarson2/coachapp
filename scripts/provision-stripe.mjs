// Provision the 6 Stripe prices for CoachFit's coaching plans.
//
// Usage (TEST mode first):
//   STRIPE_SECRET_KEY=sk_test_xxx node scripts/provision-stripe.mjs
//
// It creates one Product per plan and two Prices each (upfront one-time +
// monthly installment), then prints the NEXT_PUBLIC_STRIPE_PRICE_* env lines to
// paste into .env.local / Vercel. Safe to re-run: it reuses products by name.

import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY is not set. Run with STRIPE_SECRET_KEY=sk_test_...");
  process.exit(1);
}
if (!key.startsWith("sk_test_")) {
  console.warn("⚠️  This key is NOT a test key. Provisioning in LIVE mode. Ctrl-C to abort.\n");
}

const stripe = new Stripe(key);
const PREMIUM = 1.1;
const monthly = (upfront, months) => Math.round((upfront * PREMIUM) / months);

const PLANS = [
  { key: "3MO", label: "3-Month Coaching", months: 3, upfront: 60000 },
  { key: "6MO", label: "6-Month Coaching", months: 6, upfront: 100000 },
  { key: "1YR", label: "1-Year Coaching", months: 12, upfront: 180000 },
];

async function findOrCreateProduct(label, planKey) {
  const existing = await stripe.products.search({
    query: `metadata['coachfitPlan']:'${planKey}'`,
  });
  if (existing.data.length) return existing.data[0];
  return stripe.products.create({
    name: label,
    metadata: { coachfitPlan: planKey },
  });
}

async function run() {
  const lines = [];
  for (const plan of PLANS) {
    const product = await findOrCreateProduct(plan.label, plan.key);

    const upfront = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: plan.upfront,
      nickname: `${plan.label} — upfront`,
      metadata: { coachfitPlan: plan.key, payKind: "upfront" },
    });

    const installment = await stripe.prices.create({
      product: product.id,
      currency: "usd",
      unit_amount: monthly(plan.upfront, plan.months),
      recurring: { interval: "month" },
      nickname: `${plan.label} — installment`,
      metadata: { coachfitPlan: plan.key, payKind: "installment" },
    });

    lines.push(`NEXT_PUBLIC_STRIPE_PRICE_${plan.key}_UPFRONT=${upfront.id}`);
    lines.push(`NEXT_PUBLIC_STRIPE_PRICE_${plan.key}_INSTALLMENT=${installment.id}`);
    console.log(`✓ ${plan.label}: upfront ${upfront.id}, installment ${installment.id}`);
  }

  console.log("\n--- Add these to .env.local and Vercel (Production) ---\n");
  console.log(lines.join("\n"));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
