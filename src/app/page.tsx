"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { useAuth } from "@/context/AuthContext";
import { Button, Spinner } from "@/components/ui";
import { homePathFor } from "@/lib/routes";

export default function Home() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (loading) return;
    if (!user) return; // show splash
    if (!profile) {
      router.replace("/onboarding");
    } else {
      router.replace(homePathFor(profile));
    }
  }, [user, profile, loading, router]);

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between px-6 py-5">
        <span className="text-lg font-bold text-indigo-600">CoachFit</span>
        <div className="flex gap-2">
          <Link href="/login">
            <Button variant="secondary" size="sm">
              Log in
            </Button>
          </Link>
          <Link href="/signup">
            <Button size="sm">Sign up</Button>
          </Link>
        </div>
      </header>

      <section className="mx-auto flex max-w-3xl flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
          1:1 fitness coaching,
          <br />
          all in one place.
        </h1>
        <p className="mt-5 max-w-xl text-lg text-gray-600">
          Track nutrition, weight and progress. Coaches manage every client from a
          single dashboard, with AI-powered insights to keep goals on track.
        </p>
        <div className="mt-8 flex gap-3">
          <Link href="/signup">
            <Button size="lg">Get started</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary" size="lg">
              I have an account
            </Button>
          </Link>
        </div>
      </section>

      <footer className="px-6 py-6 text-center text-sm text-gray-400">
        CoachFit
      </footer>
    </main>
  );
}
