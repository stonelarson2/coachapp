"use client";

// Theme (light / dark / system) with localStorage persistence.
// The actual `.dark` class is first applied by an inline script in the root
// layout (see layout.tsx) to avoid a flash of the wrong theme before hydration.
// Here we read the preference via useSyncExternalStore (SSR-safe) and keep the
// <html> class in sync — without ever calling setState inside an effect.
import * as React from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

const listeners = new Set<() => void>();

function getStored(): Theme {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    if (t === "light" || t === "dark" || t === "system") return t;
  } catch {
    // localStorage unavailable — fall through to default.
  }
  return "system";
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

// External store for the OS color-scheme, so `resolved` updates reactively
// without any setState-in-effect.
function subscribeSystem(cb: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}

interface ThemeContextValue {
  theme: Theme;
  /** The theme actually in effect right now. */
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
}

const ThemeContext = React.createContext<ThemeContextValue | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = React.useSyncExternalStore<Theme>(
    subscribe,
    getStored,
    () => "system",
  );
  const systemDark = React.useSyncExternalStore(
    subscribeSystem,
    systemPrefersDark,
    () => false,
  );
  const resolved: "light" | "dark" =
    theme === "system" ? (systemDark ? "dark" : "light") : theme;

  // Keep <html>.dark in sync with the resolved theme. This only writes to the
  // DOM (no setState).
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", resolved === "dark");
  }, [resolved]);

  const setTheme = React.useCallback((t: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // ignore persistence failures
    }
    listeners.forEach((l) => l());
  }, []);

  const value = React.useMemo(
    () => ({ theme, resolved, setTheme }),
    [theme, resolved, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
