"use client";

import * as React from "react";
import { useWorkspace } from "../context";
import { deletePhoto, uploadPhoto, usePhotos } from "@/lib/data";
import { formatDatePretty, todayISO } from "@/lib/units";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Spinner } from "@/components/ui";

export function PhotoTab() {
  const { target, isCoachView } = useWorkspace();
  const { photos, loading } = usePhotos(target.uid);

  return (
    <div className="space-y-6">
      {!isCoachView && <UploadCard userId={target.uid} />}

      {loading ? (
        <div className="flex justify-center p-10">
          <Spinner />
        </div>
      ) : photos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-10 text-center text-sm text-gray-400">
          {isCoachView
            ? "No progress photos uploaded yet."
            : "No photos yet — upload your first progress photo above."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {photos.map((photo) => (
            <div key={photo.id} className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photo.url}
                alt={`Progress ${photo.date}`}
                className="aspect-square w-full object-cover"
              />
              <div className="p-3">
                <div className="text-sm font-medium text-gray-900">
                  {formatDatePretty(photo.date)}
                </div>
                {photo.note && <div className="mt-0.5 text-xs text-gray-500">{photo.note}</div>}
                {!isCoachView && (
                  <button
                    onClick={() => deletePhoto(photo)}
                    className="mt-2 text-xs text-gray-400 hover:text-red-500"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UploadCard({ userId }: { userId: string }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [date, setDate] = React.useState(todayISO());
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      await uploadPhoto(userId, file, date, note.trim());
      setFile(null);
      setNote("");
      if (inputRef.current) inputRef.current.value = "";
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload a progress photo</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
          <div>
            <Label>Photo</Label>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block text-sm text-gray-600 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"
              required
            />
          </div>
          <div>
            <Label htmlFor="pdate">Date</Label>
            <Input
              id="pdate"
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className="w-44"
            />
          </div>
          <div className="min-w-[12rem] flex-1">
            <Label htmlFor="note">Note (optional)</Label>
            <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. front, 4 weeks in" />
          </div>
          <Button type="submit" disabled={busy || !file}>
            {busy ? "Uploading…" : "Upload"}
          </Button>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </CardContent>
    </Card>
  );
}
