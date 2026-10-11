import type { ReactNode } from 'react';
import { AppShell } from '@/components/app-shell/app-shell';
import { SessionGuard } from '@/features/session/session-guard';

/** Rutas con sesión: el guard comprueba `/api/yo` y el shell agrupa navegación y contenido. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SessionGuard>
      <AppShell>{children}</AppShell>
    </SessionGuard>
  );
}
