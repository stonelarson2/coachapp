"use client";

import * as React from "react";
import { useWorkspace } from "../context";
import { sendMessage, useMessages } from "@/lib/data";
import { Button, Card, Input, Spinner } from "@/components/ui";
import { cn } from "@/lib/cn";

export function MessageTab() {
  const { target, viewerId } = useWorkspace();
  const coachId = target.coachId;
  const clientId = target.uid;
  const { messages, loading } = useMessages(coachId, clientId);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || !coachId) return;
    setBusy(true);
    setText("");
    try {
      await sendMessage(coachId, clientId, viewerId, t);
    } finally {
      setBusy(false);
    }
  }

  if (!coachId) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-surface p-10 text-center text-sm text-gray-400">
        Messaging is available once a client is linked to a coach.
      </div>
    );
  }

  return (
    <Card className="flex h-[60vh] flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {loading ? (
          <div className="flex justify-center pt-6">
            <Spinner />
          </div>
        ) : messages.length === 0 ? (
          <p className="pt-6 text-center text-sm text-gray-400">
            No messages yet. Say hello!
          </p>
        ) : (
          messages.map((m) => {
            const mine = m.senderId === viewerId;
            return (
              <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[75%] rounded-2xl px-3.5 py-2 text-sm",
                    mine
                      ? "bg-indigo-600 text-white"
                      : "bg-gray-100 text-gray-900",
                  )}
                >
                  <div className="whitespace-pre-wrap break-words">{m.text}</div>
                  <div className={cn("mt-1 text-[10px]", mine ? "text-indigo-200" : "text-gray-400")}>
                    {new Date(m.createdAt).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-gray-200 p-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Type a message…"
        />
        <Button type="submit" disabled={busy || !text.trim()}>
          Send
        </Button>
      </form>
    </Card>
  );
}
