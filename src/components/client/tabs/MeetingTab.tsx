"use client";

import * as React from "react";
import { useWorkspace } from "../context";
import { updateUserFields } from "@/lib/data";
import { addDays, formatDatePretty, todayISO, toISODate } from "@/lib/units";
import type { MeetingFrequency } from "@/lib/types";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Select } from "@/components/ui";

const FREQ_DAYS: Record<Exclude<MeetingFrequency, "off">, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

const FREQ_LABELS: Record<MeetingFrequency, string> = {
  weekly: "Weekly",
  biweekly: "Every 2 weeks",
  monthly: "Monthly",
  off: "No reminders",
};

/** Next reminder date: step forward from a base date by the interval until in the future. */
function nextReminder(frequency: MeetingFrequency, baseEpoch: number): string | null {
  if (frequency === "off") return null;
  const interval = FREQ_DAYS[frequency];
  const today = todayISO();
  let date = toISODate(new Date(baseEpoch));
  let guard = 0;
  while (date < today && guard < 1000) {
    date = addDays(date, interval);
    guard++;
  }
  return date;
}

export function MeetingTab() {
  const { target, isCoachView } = useWorkspace();
  const meeting = target.meeting ?? { frequency: "off" as MeetingFrequency };
  const next = nextReminder(
    meeting.frequency,
    meeting.lastRemindedAt ?? target.createdAt,
  );

  return isCoachView ? (
    <CoachMeetingEditor />
  ) : (
    <div className="max-w-lg space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Coaching calls</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Reminder schedule</span>
            <span className="font-medium text-gray-900">
              {FREQ_LABELS[meeting.frequency]}
            </span>
          </div>
          {next && (
            <div className="flex justify-between">
              <span className="text-gray-500">Next check-in</span>
              <span className="font-medium text-gray-900">{formatDatePretty(next)}</span>
            </div>
          )}
          {meeting.zoomLink ? (
            <a href={meeting.zoomLink} target="_blank" rel="noopener noreferrer">
              <Button className="mt-2 w-full">Join Zoom call</Button>
            </a>
          ) : (
            <p className="text-gray-400">
              Your coach hasn&apos;t added a meeting link yet.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function CoachMeetingEditor() {
  const { target } = useWorkspace();
  const [frequency, setFrequency] = React.useState<MeetingFrequency>(
    target.meeting?.frequency ?? "off",
  );
  const [zoomLink, setZoomLink] = React.useState(target.meeting?.zoomLink ?? "");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      await updateUserFields(target.uid, {
        meeting: {
          frequency,
          zoomLink: zoomLink.trim(),
          lastRemindedAt: target.meeting?.lastRemindedAt,
        },
      });
      setMsg("Saved");
      setTimeout(() => setMsg(""), 1500);
    } catch {
      setMsg("Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Coaching call reminders</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-500">
          Set how often {target.name} is reminded to book a coaching call, and the
          Zoom link they&apos;ll use.
        </p>
        <div>
          <Label htmlFor="freq">Reminder frequency</Label>
          <Select
            id="freq"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as MeetingFrequency)}
          >
            <option value="off">No reminders</option>
            <option value="weekly">Weekly</option>
            <option value="biweekly">Every 2 weeks</option>
            <option value="monthly">Monthly</option>
          </Select>
        </div>
        <div>
          <Label htmlFor="zoom">Zoom link (optional)</Label>
          <Input
            id="zoom"
            type="url"
            placeholder="https://zoom.us/j/…"
            value={zoomLink}
            onChange={(e) => setZoomLink(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
          {msg && <span className="text-sm text-gray-500">{msg}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
