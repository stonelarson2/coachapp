"use client";

import Link from "next/link";
import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { useClients } from "@/lib/data";
import { authedFetch } from "@/lib/api";
import { Guard } from "@/components/Guard";
import { AddClientDialog } from "@/components/coach/AddClientDialog";
import { Badge, Button, Card, Spinner, Stat } from "@/components/ui";
import { formatWeight } from "@/lib/units";
import type { UserDoc } from "@/lib/types";

interface ExampleResult {
  name: string;
  email: string;
  password: string;
}

export default function DashboardPage() {
  return (
    <Guard role="coach">
      <DashboardInner />
    </Guard>
  );
}

function DashboardInner() {
  const { profile } = useAuth();
  const { clients, loading } = useClients(profile?.uid);
  const unit = profile?.weightUnit ?? "lb";

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [exampleBusy, setExampleBusy] = React.useState(false);
  const [example, setExample] = React.useState<ExampleResult | null>(null);
  const [error, setError] = React.useState("");

  const hasExample = clients.some((c) => c.isExample);

  async function loadExample() {
    setError("");
    setExampleBusy(true);
    try {
      const res = await authedFetch<ExampleResult>("/api/clients", { mode: "example" });
      setExample(res);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setExampleBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">
            Your clients at a glance. Click a client to dive in.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            onClick={loadExample}
            disabled={exampleBusy || hasExample}
            title={hasExample ? "An example client already exists" : undefined}
          >
            {exampleBusy ? "Loading…" : "Load example client"}
          </Button>
          <Button onClick={() => setDialogOpen(true)}>Add client</Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {example && (
        <Card className="border-primary-soft-fg/20 bg-primary-soft p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm text-primary-soft-fg">
              <p className="font-semibold">Example client created: {example.name}</p>
              <p className="mt-1">
                It comes pre-loaded with weigh-ins and food logs. To explore the
                client&apos;s own view, log in (in a separate/incognito window) with:
              </p>
              <p className="mt-2 font-mono text-xs">
                {example.email}
                <br />
                {example.password}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExample(null)}
              className="text-primary-soft-fg/70 hover:text-primary-soft-fg"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <Stat label="Total clients" value={loading ? "…" : clients.length} />
        <Stat
          label="Your invite code"
          value={
            <span className="font-mono tracking-widest text-indigo-600">
              {profile?.inviteCode}
            </span>
          }
          hint="Share with new clients"
        />
      </div>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-10">
            <Spinner />
          </div>
        ) : clients.length === 0 ? (
          <div className="p-10 text-center text-sm text-gray-500">
            No clients yet. Share your invite code{" "}
            <span className="font-mono font-semibold text-indigo-600">
              {profile?.inviteCode}
            </span>{" "}
            so clients can join.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Goal</th>
                  <th className="px-5 py-3">Current weight</th>
                  <th className="px-5 py-3">Change</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {clients.map((c) => (
                  <ClientRow key={c.uid} client={c} unit={unit} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <AddClientDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </div>
  );
}

function ClientRow({ client, unit }: { client: UserDoc; unit: "kg" | "lb" }) {
  const start = client.startWeightKg ?? client.profile?.weightKg ?? 0;
  const current = client.currentWeightKg ?? start;
  const changeKg = current - start;
  const goal = client.goal?.type ?? "maintain";

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/clients/${client.uid}`}
            className="font-medium text-indigo-600 hover:underline"
          >
            {client.name}
          </Link>
          {client.isExample && <Badge color="indigo">Example</Badge>}
        </div>
        <div className="text-xs text-gray-400">{client.email}</div>
      </td>
      <td className="px-5 py-3">
        <Badge
          color={goal === "cut" ? "amber" : goal === "bulk" ? "indigo" : "gray"}
        >
          {goal}
        </Badge>
      </td>
      <td className="px-5 py-3 text-gray-900">{formatWeight(current, unit)}</td>
      <td className="px-5 py-3">
        <ChangeCell changeKg={changeKg} unit={unit} />
      </td>
    </tr>
  );
}

function ChangeCell({ changeKg, unit }: { changeKg: number; unit: "kg" | "lb" }) {
  const eps = 0.05;
  if (Math.abs(changeKg) < eps) {
    return <span className="text-gray-400">—</span>;
  }
  const down = changeKg < 0;
  const formatted = formatWeight(Math.abs(changeKg), unit);
  return (
    <span className={down ? "text-green-600" : "text-amber-600"}>
      {down ? "▼" : "▲"} {formatted}
    </span>
  );
}
