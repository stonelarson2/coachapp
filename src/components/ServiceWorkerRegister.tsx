"use client";

import * as React from "react";

/**
 * Registers the service worker (public/sw.js) once, in production, so CoachFit is
 * installable and has a basic offline fallback. No-ops during local dev.
 */
export function ServiceWorkerRegister() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration failures shouldn't break the app.
      });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
