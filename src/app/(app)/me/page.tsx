"use client";

import { useAuth } from "@/context/AuthContext";
import { Guard } from "@/components/Guard";
import { ClientWorkspace } from "@/components/client/ClientWorkspace";

export default function MyProgressPage() {
  const { profile } = useAuth();
  return (
    <Guard role="client">
      {profile && <ClientWorkspace userId={profile.uid} />}
    </Guard>
  );
}
