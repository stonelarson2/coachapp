"use client";

import { useParams } from "next/navigation";
import { Guard } from "@/components/Guard";
import { ClientWorkspace } from "@/components/client/ClientWorkspace";

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>();
  return (
    <Guard role="coach">
      <ClientWorkspace userId={params.id} />
    </Guard>
  );
}
