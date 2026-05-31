"use client";

import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { useTheme, type Theme } from "@/context/ThemeContext";
import { updateUserFields } from "@/lib/data";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@/components/ui";

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export default function SettingsPage() {
  const { profile } = useAuth();
  const { theme, setTheme } = useTheme();
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
        <CardContent className="space-y-3 text-sm">
          <NameEditor uid={profile.uid} current={profile.name} />
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
              <span className="rounded-lg bg-primary-soft px-4 py-2 font-mono text-lg font-semibold tracking-widest text-primary-soft-fg">
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
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-gray-500">
            Choose a light or dark theme, or follow your device setting.
          </p>
          <div className="inline-flex overflow-hidden rounded-lg border border-gray-300">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={
                  "px-4 py-2 text-sm font-medium " +
                  (theme === opt.value
                    ? "bg-indigo-600 text-white"
                    : "bg-surface text-gray-700 hover:bg-gray-50")
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

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
                    : "bg-surface text-gray-700 hover:bg-gray-50")
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

function NameEditor({ uid, current }: { uid: string; current: string }) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState(current);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  React.useEffect(() => setValue(current), [current]);

  async function save() {
    const name = value.trim();
    if (!name) {
      setError("Name can't be empty.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await updateUserFields(uid, { name });
      setEditing(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-4">
        <span className="text-gray-500">Name</span>
        <span className="flex items-center gap-2">
          <span className="text-gray-900">{current}</span>
          <button
            onClick={() => { setValue(current); setEditing(true); }}
            className="text-xs font-medium text-indigo-600 hover:underline"
          >
            Edit
          </button>
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="text-gray-500">Name</span>
      <div className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Your name"
          autoFocus
        />
        <Button size="sm" onClick={save} disabled={busy || !value.trim() || value.trim() === current}>
          {busy ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => { setEditing(false); setError(""); }} disabled={busy}>
          Cancel
        </Button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
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
