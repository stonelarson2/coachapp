"use client";

import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useClients } from "@/lib/data";
import { Guard } from "@/components/Guard";
import { Badge, Card, Spinner, Stat } from "@/components/ui";
import { formatWeight } from "@/lib/units";
import type { UserDoc } from "@/lib/types";

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Your clients at a glance. Click a client to dive in.
        </p>
      </div>

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
        <Link
          href={`/clients/${client.uid}`}
          className="font-medium text-indigo-600 hover:underline"
        >
          {client.name}
        </Link>
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
