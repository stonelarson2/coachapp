"use client";

import { useWorkspace } from "../context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui";
import type { Intake } from "@/lib/types";

const FIELDS: { key: keyof Intake; label: string }[] = [
  { key: "primaryGoal", label: "Primary goal" },
  { key: "experience", label: "Experience" },
  { key: "allergies", label: "Allergies / intolerances" },
  { key: "dislikes", label: "Food dislikes" },
  { key: "injuries", label: "Injuries / medical" },
  { key: "schedule", label: "Weekly schedule" },
  { key: "notes", label: "Other notes" },
];

/**
 * Read-only display of a client's intake questionnaire answers, shown to the
 * coach on the Client Detail tab.
 */
export function IntakeSummary() {
  const { target } = useWorkspace();
  const intake = target.intake;
  const answered = FIELDS.filter((f) => intake?.[f.key]?.trim());

  return (
    <Card>
      <CardHeader>
        <CardTitle>Intake questionnaire</CardTitle>
      </CardHeader>
      <CardContent>
        {answered.length === 0 ? (
          <p className="text-sm text-gray-500">
            {target.name.split(" ")[0]} hasn&apos;t filled out an intake questionnaire.
          </p>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-2">
            {answered.map((f) => (
              <div key={f.key}>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-400">
                  {f.label}
                </dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-900">
                  {intake![f.key]}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </CardContent>
    </Card>
  );
}
