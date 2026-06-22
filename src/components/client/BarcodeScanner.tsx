"use client";

import * as React from "react";
import { Button, Card } from "@/components/ui";

/**
 * Camera-based barcode scanner modal. Uses @zxing/browser (loaded lazily so it
 * never ships in the initial bundle). Calls onDetected with the raw barcode
 * once a code is read, then closes.
 */
export function BarcodeScanner({
  open,
  onClose,
  onDetected,
}: {
  open: boolean;
  onClose: () => void;
  onDetected: (barcode: string) => void;
}) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    let stopped = false;
    // IScannerControls from @zxing/browser; typed loosely to avoid an eager import.
    let controls: { stop: () => void } | undefined;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const video = videoRef.current;
        if (!video) return;
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: "environment" } },
          video,
          (result) => {
            if (result && !stopped) {
              stopped = true;
              controls?.stop();
              onDetected(result.getText());
            }
          },
        );
        if (stopped) controls.stop(); // unmounted while starting up
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
      stopped = true;
      controls?.stop();
    };
  }, [open, onDetected]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={onClose}
    >
      <Card className="w-full max-w-md bg-elevated" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Scan barcode</h2>
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
              <div className="relative overflow-hidden rounded-lg bg-black">
                <video ref={videoRef} className="h-64 w-full object-cover" playsInline muted />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-24 w-3/4 rounded-lg border-2 border-white/80" />
                </div>
              </div>
              <p className="mt-3 text-center text-xs text-gray-500">
                Point your camera at the product barcode.
              </p>
            </>
          )}
          <div className="mt-4 flex justify-end">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
