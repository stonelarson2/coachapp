"use client";

import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>{children}</AuthProvider>
      <ServiceWorkerRegister />
    </ThemeProvider>
  );
}
