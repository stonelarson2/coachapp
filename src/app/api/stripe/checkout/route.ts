import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { verifyRequest } from "@/lib/server-auth";
import { getStripe } from "@/lib/stripe/server";
import { PLANS } from "@/lib/billing";
import type { PayKind, PlanKey, UserDoc } from "@/lib/types";

export const runtime = "nodejs";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://mycoachfit.xyz";

interface Body {
  clientId?: string;
  planKey?: PlanKey;
  payKind?: PayKind;
}

/**
 * Coach-only: create a Stripe Checkout Session for one of the coach's clients on
 * a chosen plan + payment kind, and return the hosted checkout URL to send them.
 */
export async function POST(req: Request) {
  let decoded;
  try {
    decoded = await verifyRequest(req);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const { clientId, planKey, payKind } = body;
  if (!clientId || !planKey || !payKind || !PLANS[planKey]) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const db = getAdminDb();
  const [coachSnap, clientSnap] = await Promise.all([
    db.collection("users").doc(decoded.uid).get(),
    db.collection("users").doc(clientId).get(),
  ]);
  const coach = coachSnap.data() as UserDoc | undefined;
  const client = clientSnap.data() as UserDoc | undefined;
  if (!coach || coach.role !== "coach") {
    return NextResponse.json({ error: "Only a coach can do this" }, { status: 403 });
  }
  if (!client || client.coachId !== decoded.uid) {
    return NextResponse.json({ error: "Not your client" }, { status: 403 });
  }

  const plan = PLANS[planKey];
  const priceId = payKind === "upfront" ? plan.upfrontPriceId : plan.installmentPriceId;
  if (!priceId) {
    return NextResponse.json(
      { error: "Stripe prices are not provisioned yet. Run scripts/provision-stripe.mjs." },
      { status: 500 },
    );
  }

  const stripe = getStripe();

  // Reuse the client's Stripe customer if we already made one.
  let customerId = client.billing?.stripeCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: client.email,
      name: client.name,
      metadata: { clientId, coachId: decoded.uid },
    });
    customerId = customer.id;
  }

  const metadata = {
    clientId,
    coachId: decoded.uid,
    planKey,
    payKind,
    planMonths: String(plan.months),
  };

  const session = await stripe.checkout.sessions.create({
    mode: payKind === "upfront" ? "payment" : "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata,
    ...(payKind === "installment"
      ? { subscription_data: { metadata } }
      : { payment_intent_data: { metadata } }),
    success_url: `${APP_URL}/me?billing=success`,
    cancel_url: `${APP_URL}/me?billing=cancel`,
  });

  // Record intent so the coach sees a "pending" status immediately.
  await db.collection("users").doc(clientId).set(
    {
      billing: {
        ...(client.billing ?? {}),
        status: "pending",
        planKey,
        payKind,
        stripeCustomerId: customerId,
        updatedAt: Date.now(),
      },
    },
    { merge: true },
  );

  return NextResponse.json({ url: session.url });
}
