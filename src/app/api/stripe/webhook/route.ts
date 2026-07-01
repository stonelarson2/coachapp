import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getAdminDb } from "@/lib/firebase/admin";
import { getStripe } from "@/lib/stripe/server";
import type { Billing, BillingStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** ISO date `months` from today. */
function addMonthsISO(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function unixToISO(seconds?: number | null): string | undefined {
  if (!seconds) return undefined;
  return new Date(seconds * 1000).toISOString().slice(0, 10);
}

type UserRef = FirebaseFirestore.DocumentReference;

/** Locate the client doc by explicit id, else by their Stripe customer id. */
async function findClient(
  db: FirebaseFirestore.Firestore,
  opts: { clientId?: string; customerId?: string },
): Promise<{ ref: UserRef; billing: Billing } | null> {
  if (opts.clientId) {
    const ref = db.collection("users").doc(opts.clientId);
    const snap = await ref.get();
    if (snap.exists) return { ref, billing: (snap.data()?.billing ?? {}) as Billing };
  }
  if (opts.customerId) {
    const q = await db
      .collection("users")
      .where("billing.stripeCustomerId", "==", opts.customerId)
      .limit(1)
      .get();
    if (!q.empty) {
      const doc = q.docs[0];
      return { ref: doc.ref, billing: (doc.data()?.billing ?? {}) as Billing };
    }
  }
  return null;
}

async function mergeBilling(ref: UserRef, prev: Billing, next: Partial<Billing>) {
  await ref.set(
    { billing: { ...prev, ...next, updatedAt: Date.now() } },
    { merge: true },
  );
}

export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const stripe = getStripe();
  const raw = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `Invalid signature: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  const db = getAdminDb();

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const m = s.metadata ?? {};
      const found = await findClient(db, {
        clientId: m.clientId,
        customerId: typeof s.customer === "string" ? s.customer : undefined,
      });
      if (!found) break;
      const months = Number(m.planMonths) || 0;
      const patch: Partial<Billing> = {
        status: "active",
        lastPaymentAt: Date.now(),
        stripeCustomerId:
          typeof s.customer === "string" ? s.customer : found.billing.stripeCustomerId,
      };
      if (s.mode === "subscription" && typeof s.subscription === "string") {
        patch.stripeSubscriptionId = s.subscription;
      }
      if (s.mode === "payment" && months) {
        // Upfront: access runs for the full term from today.
        patch.currentPeriodEnd = addMonthsISO(months);
      }
      await mergeBilling(found.ref, found.billing, patch);
      break;
    }

    case "invoice.paid": {
      const inv = event.data.object as Stripe.Invoice & { subscription?: string };
      if (!inv.subscription) break; // one-time payments handled by checkout.completed
      const sub = await stripe.subscriptions.retrieve(inv.subscription);
      const m = sub.metadata ?? {};
      const found = await findClient(db, {
        clientId: m.clientId,
        customerId: typeof inv.customer === "string" ? inv.customer : undefined,
      });
      if (!found) break;

      const paid = (found.billing.installmentsPaid ?? 0) + 1;
      const months = Number(m.planMonths) || 0;
      const patch: Partial<Billing> = {
        status: "active",
        installmentsPaid: paid,
        lastPaymentAt: Date.now(),
        stripeSubscriptionId: sub.id,
        currentPeriodEnd: unixToISO(
          (sub as unknown as { current_period_end?: number }).current_period_end,
        ),
      };
      // Final installment collected → let it lapse at period end.
      if (months && paid >= months) {
        await stripe.subscriptions
          .update(sub.id, { cancel_at_period_end: true })
          .catch(() => {});
      }
      await mergeBilling(found.ref, found.billing, patch);
      break;
    }

    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const found = await findClient(db, {
        customerId: typeof inv.customer === "string" ? inv.customer : undefined,
      });
      if (found) await mergeBilling(found.ref, found.billing, { status: "past_due" });
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const m = sub.metadata ?? {};
      const found = await findClient(db, {
        clientId: m.clientId,
        customerId: typeof sub.customer === "string" ? sub.customer : undefined,
      });
      if (!found) break;
      const months = Number(m.planMonths) || 0;
      const done = months > 0 && (found.billing.installmentsPaid ?? 0) >= months;
      const status: BillingStatus = done ? "completed" : "canceled";
      await mergeBilling(found.ref, found.billing, { status });
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
