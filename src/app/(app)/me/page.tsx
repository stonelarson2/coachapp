"use client";

import { useAuth } from "@/context/AuthContext";

export default function MyProgressPage() {
  const { profile } = useAuth();
  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-900">
        Hi {profile?.name}
      </h1>
      <p className="mt-2 text-gray-600">
        Your progress dashboard is coming soon.
      </p>
    </div>
  );
}
