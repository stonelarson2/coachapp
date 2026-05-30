"use client";

import * as React from "react";
import { useWorkspace } from "../context";
import { useInsights } from "@/lib/data";
import { authedFetch } from "@/lib/api";
import type { InsightPeriod } from "@/lib/types";
import { Button, Card, CardContent, CardHeader, CardTitle, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";

const PERIODS: { id: InsightPeriod; label: string }[] = [
  { id: "week", label: "Past week" },
  { id: "2weeks", label: "Past 2 weeks" },
  { id: "month", label: "Past month" },
];

export function InsightTab() {
  const { target } = useWorkspace();
  const { insights } = useInsights(target.uid);
  const [period, setPeriod] = React.useState<InsightPeriod>("week");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");

  async function generate() {
    setBusy(true);
    setError("");
    try {
      await authedFetch("/api/insights", { clientId: target.uid, period });
      // The new insight arrives via the realtime useInsights subscription.
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Generate AI analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-sm text-gray-500">
            Analyze weight and nutrition data to highlight what&apos;s going well,
            what to improve, and concrete next steps.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex overflow-hidden rounded-lg border border-gray-300">
              {PERIODS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriod(p.id)}
                  className={cn(
                    "px-3 py-2 text-sm font-medium",
                    period === p.id
                      ? "bg-indigo-600 text-white"
                      : "bg-surface text-gray-700 hover:bg-gray-50",
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <Button onClick={generate} disabled={busy}>
              {busy ? "Analyzing…" : "Generate insight"}
            </Button>
            {busy && <Spinner />}
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </CardContent>
      </Card>

      {insights.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-surface p-10 text-center text-sm text-gray-400">
          No insights generated yet.
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map((ins) => (
            <Card key={ins.id}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span className="capitalize">
                    {PERIODS.find((p) => p.id === ins.period)?.label ?? ins.period}
                  </span>
                  <span className="text-xs font-normal text-gray-400">
                    {new Date(ins.createdAt).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Markdown text={ins.text} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/** Minimal markdown renderer for '## ' headings and '-'/'*' bullets. */
function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flush = (key: string) => {
    if (bullets.length) {
      blocks.push(
        <ul key={key} className="mb-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>,
      );
      bullets = [];
    }
  };

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (line.startsWith("## ")) {
      flush(`f-h-${i}`);
      blocks.push(
        <h4 key={`h-${i}`} className="mb-1 mt-3 text-sm font-semibold text-primary-soft-fg">
          {line.slice(3)}
        </h4>,
      );
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      bullets.push(line.slice(2));
    } else if (line.length > 0) {
      flush(`f-p-${i}`);
      blocks.push(
        <p key={`p-${i}`} className="mb-2 text-sm text-gray-700">
          {line}
        </p>,
      );
    }
  });
  flush("f-end");

  return <div>{blocks}</div>;
}
