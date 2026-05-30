"use client";

import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const { profile } = useAuth();
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">
        Welcome, {profile?.name}
      </h1>
      <p className="mt-2 text-gray-600">
        Your coaching dashboard is coming together. Your invite code is{" "}
        <span className="font-mono font-semibold text-indigo-600">
          {profile?.inviteCode}
        </span>
        .
      </p>
    </div>
  );
}
