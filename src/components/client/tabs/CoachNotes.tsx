"use client";

import * as React from "react";
import { useWorkspace } from "../context";
import { updateUserFields } from "@/lib/data";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@/components/ui";

/**
 * Private, coach-only notes about a client (injury history, preferences, what's
 * worked, etc.). Stored on the client's user doc as `coachNotes`. Only rendered
 * in the coach view, so the client never sees it.
 */
export function CoachNotes() {
  const { target } = useWorkspace();
  const [text, setText] = React.useState(target.coachNotes ?? "");
  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState("");

  // Keep the textarea in sync if the underlying doc changes elsewhere while the
  // field hasn't been touched (dirty edits are preserved).
  const saved = target.coachNotes ?? "";
  const dirty = text !== saved;

  async function save() {
    setBusy(true);
    setMsg("");
    try {
      await updateUserFields(target.uid, { coachNotes: text.trim() });
      setMsg("Saved");
      setTimeout(() => setMsg(""), 1500);
    } catch {
      setMsg("Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Private coach notes</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-gray-400">
          Only you can see these — {target.name.split(" ")[0]} never does.
        </p>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          placeholder="Injury history, preferences, what's worked, things to follow up on…"
          className="w-full rounded-lg border border-gray-200 bg-surface p-3 text-sm text-gray-900 outline-none focus:border-indigo-400"
        />
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save notes"}
          </Button>
          {msg && <span className="text-sm text-gray-500">{msg}</span>}
          {dirty && !msg && <span className="text-xs text-amber-600">Unsaved changes</span>}
        </div>
      </CardContent>
    </Card>
  );
}
