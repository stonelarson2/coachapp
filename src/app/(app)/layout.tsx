import { Guard } from "@/components/Guard";
import { AppShell } from "@/components/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <Guard>
      <AppShell>{children}</AppShell>
    </Guard>
  );
}
