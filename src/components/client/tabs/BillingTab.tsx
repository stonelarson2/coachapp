"use client";

import * as React from "react";
import { useWorkspace } from "../context";
import { authedFetch } from "@/lib/api";
import { PLAN_LIST, formatUsd } from "@/lib/billing";
import type { BillingStatus, PayKind, PlanKey } from "@/lib/types";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

const STATUS_META: Record<BillingStatus, { label: string; color: "gray" | "green" | "amber" | "red" | "indigo" }> = {
  none: { label: "No plan", color: "gray" },
  pending: { label: "Awaiting payment", color: "amber" },
  active: { label: "Active", color: "green" },
  past_due: { label: "Past due", color: "red" },
  canceled: { label: "Canceled", color: "gray" },
  completed: { label: "Completed", color: "indigo" },
};

export function BillingTab() {
  const { target, isCoachView } = useWorkspace();
  const billing = target.billing;
  const status = billing?.status ?? "none";
  const meta = STATUS_META[status];
  const planLabel = billing?.planKey
    ? PLAN_LIST.find((p) => p.key === billing.planKey)?.label
    : undefined;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Billing status</CardTitle>
          <Badge color={meta.color}>{meta.label}</Badge>
        </CardHeader>
        <CardContent className="space-y-1 text-sm text-gray-600">
          {planLabel ? (
            <p>
              Plan: <span className="font-medium text-gray-900">{planLabel}</span>
              {billing?.payKind === "installment" ? " (monthly installments)" : " (paid upfront)"}
            </p>
          ) : (
            <p>No plan set up yet.</p>
          )}
          {billing?.currentPeriodEnd && <p>Access through {billing.currentPeriodEnd}.</p>}
          {billing?.payKind === "installment" && billing?.installmentsPaid != null && (
            <p>{billing.installmentsPaid} payment(s) collected.</p>
          )}
        </CardContent>
      </Card>

      {isCoachView ? (
        <CoachBilling clientId={target.uid} />
      ) : (
        <p className="text-sm text-gray-500">
          Your coach manages your plan. If you have a checkout link, open it to pay.
        </p>
      )}
    </div>
  );
}

function CoachBilling({ clientId }: { clientId: string }) {
  const [payKind, setPayKind] = React.useState<PayKind>("upfront");
  const [busy, setBusy] = React.useState<PlanKey | null>(null);
  const [link, setLink] = React.useState<string>("");
  const [error, setError] = React.useState("");
  const [copied, setCopied] = React.useState(false);

  async function generate(planKey: PlanKey) {
    setError("");
    setLink("");
    setCopied(false);
    setBusy(planKey);
    try {
      const res = await authedFetch<{ url: string }>("/api/stripe/checkout", {
        clientId,
        planKey,
        payKind,
      });
      setLink(res.url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a checkout link</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="inline-flex rounded-lg border border-gray-200 p-0.5 text-sm">
          <button
            onClick={() => setPayKind("upfront")}
            className={`rounded-md px-3 py-1.5 ${payKind === "upfront" ? "bg-primary-soft text-primary-soft-fg" : "text-gray-500"}`}
          >
            Pay upfront
          </button>
          <button
            onClick={() => setPayKind("installment")}
            className={`rounded-md px-3 py-1.5 ${payKind === "installment" ? "bg-primary-soft text-primary-soft-fg" : "text-gray-500"}`}
          >
            Monthly installments
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {PLAN_LIST.map((plan) => (
            <div key={plan.key} className="rounded-lg border border-gray-200 bg-surface p-4">
              <div className="text-sm font-semibold text-gray-900">{plan.label}</div>
              <div className="mt-1 text-2xl font-bold text-gray-900">
                {payKind === "upfront"
                  ? formatUsd(plan.upfrontCents)
                  : `${formatUsd(plan.installmentMonthlyCents)}`}
              </div>
              <div className="text-xs text-gray-400">
                {payKind === "upfront"
                  ? "one-time"
                  : `/mo × ${plan.months} (${formatUsd(plan.installmentMonthlyCents * plan.months)} total)`}
              </div>
              <Button
                size="sm"
                className="mt-3 w-full"
                onClick={() => generate(plan.key)}
                disabled={busy !== null}
              >
                {busy === plan.key ? "Creating…" : "Generate link"}
              </Button>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        {link && (
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <p className="text-sm font-medium text-green-800">
              Checkout link ready — send it to your client:
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                readOnly
                value={link}
                className="flex-1 rounded-md border border-gray-200 bg-surface px-2 py-1.5 text-xs text-gray-700"
                onFocus={(e) => e.target.select()}
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(link).catch(() => {});
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
              >
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
