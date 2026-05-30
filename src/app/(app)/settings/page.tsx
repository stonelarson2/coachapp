"use client";

import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { updateUserFields } from "@/lib/data";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default function SettingsPage() {
  const { profile } = useAuth();
  const [copied, setCopied] = React.useState(false);

  if (!profile) return null;

  async function setUnit(unit: "kg" | "lb") {
    if (!profile || profile.weightUnit === unit) return;
    await updateUserFields(profile.uid, { weightUnit: unit });
  }

  function copyCode() {
    if (!profile?.inviteCode) return;
    navigator.clipboard.writeText(profile.inviteCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Name" value={profile.name} />
          <Row label="Email" value={profile.email} />
          <Row label="Role" value={profile.role} capitalize />
        </CardContent>
      </Card>

      {profile.role === "coach" && (
        <Card>
          <CardHeader>
            <CardTitle>Invite code</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-gray-500">
              Share this code with new clients so they can link to you at signup.
            </p>
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-indigo-50 px-4 py-2 font-mono text-lg font-semibold tracking-widest text-indigo-700">
                {profile.inviteCode}
              </span>
              <Button variant="secondary" size="sm" onClick={copyCode}>
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Display units</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-gray-500">
            Choose how weights are displayed across the app.
          </p>
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-300">
            {(["lb", "kg"] as const).map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                className={
                  "px-4 py-2 text-sm font-medium " +
                  (profile.weightUnit === u
                    ? "bg-indigo-600 text-white"
                    : "bg-white text-gray-700 hover:bg-gray-50")
                }
              >
                {u === "lb" ? "Pounds (lb)" : "Kilograms (kg)"}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  capitalize,
}: {
  label: string;
  value?: string;
  capitalize?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className={"text-gray-900" + (capitalize ? " capitalize" : "")}>
        {value}
      </span>
    </div>
  );
}
