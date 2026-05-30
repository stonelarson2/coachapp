"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@/components/ui";
import type { Role } from "@/lib/types";

/**
 * Client-side route guard. Ensures the user is signed in and onboarded.
 * Optionally enforces a specific role.
 */
export function Guard({
  role,
  children,
}: {
  role?: Role;
  children: React.ReactNode;
}) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (!profile) {
      router.replace("/onboarding");
    } else if (role && profile.role !== role) {
      router.replace(profile.role === "coach" ? "/dashboard" : "/me");
    }
  }, [user, profile, loading, role, router]);

  const ready = !loading && !!user && !!profile && (!role || profile.role === role);

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }
  return <>{children}</>;
}
