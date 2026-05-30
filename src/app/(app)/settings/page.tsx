"use client";

import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

export default function SettingsPage() {
  const { profile } = useAuth();
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Name" value={profile?.name} />
          <Row label="Email" value={profile?.email} />
          <Row label="Role" value={profile?.role} />
          {profile?.role === "coach" && (
            <Row label="Invite code" value={profile?.inviteCode} mono />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value?: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-gray-500">{label}</span>
      <span className={mono ? "font-mono font-semibold text-indigo-600" : "text-gray-900 capitalize"}>
        {value}
      </span>
    </div>
  );
}
