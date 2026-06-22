"use client";

import * as React from "react";
import { encodeVideoFrame, type EncodedImage } from "@/lib/image";
import { Button, Card } from "@/components/ui";

/**
 * Live in-app camera. Streams the rear camera, lets the user snap one or more
 * frames (e.g. different angles of a plate), and returns each as an encoded
 * JPEG. Closing ends the stream.
 */
export function CameraCapture({
  open,
  onClose,
  onCapture,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (image: EncodedImage) => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const [error, setError] = React.useState("");
  const [count, setCount] = React.useState(0);
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setError("");
      setCount(0);
      setReady(false);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
          setReady(true);
        }
      } catch (err) {
        const name = (err as Error).name;
        if (name === "NotAllowedError") {
          setError("Camera permission denied. Allow camera access and try again.");
        } else if (name === "NotFoundError") {
          setError("No camera found on this device.");
        } else {
          setError((err as Error).message || "Could not start the camera.");
        }
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  function snap() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    try {
      onCapture(encodeVideoFrame(video));
      setCount((c) => c + 1);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={onClose}
    >
      <Card className="w-full max-w-md bg-elevated" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Camera</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="p-5">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <>
              <div className="overflow-hidden rounded-lg bg-black">
                <video ref={videoRef} className="h-72 w-full object-cover" playsInline muted />
              </div>
              <p className="mt-3 text-center text-xs text-gray-500">
                Snap one or more angles of your food, then tap Done.
                {count > 0 && <span className="ml-1 font-medium text-gray-700">{count} captured</span>}
              </p>
              <div className="mt-4 flex items-center justify-between gap-2">
                <Button variant="secondary" size="sm" onClick={onClose}>
                  {count > 0 ? "Done" : "Cancel"}
                </Button>
                <Button size="sm" onClick={snap} disabled={!ready}>
                  📸 Capture
                </Button>
              </div>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
