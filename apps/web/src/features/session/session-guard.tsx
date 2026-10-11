'use client';

import { useRouter } from 'next/navigation';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, apiFetch } from '@/lib/api';

/** Usuario de la sesión, tal como lo devuelve `GET /api/yo`. */
export interface SessionUser {
  nombre: string;
}

const SessionContext = createContext<SessionUser | null>(null);

type Estado = { tipo: 'cargando' } | { tipo: 'lista'; usuario: SessionUser } | { tipo: 'error' };

/**
 * Comprueba la sesión con `/api/yo`. Sin sesión (401) redirige a /login;
 * otros fallos muestran un mensaje sin cerrar la sesión.
 */
export function SessionGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });

  useEffect(() => {
    let activo = true;
    apiFetch<SessionUser>('/yo')
      .then((usuario) => {
        if (activo) setEstado({ tipo: 'lista', usuario });
      })
      .catch((error: unknown) => {
        if (!activo) return;
        if (error instanceof ApiError && error.status === 401) {
          router.replace('/login');
          return;
        }
        setEstado({ tipo: 'error' });
      });
    return () => {
      activo = false;
    };
  }, [router]);

  if (estado.tipo === 'cargando') {
    return (
      <div role="status" aria-live="polite" className="grid gap-3 p-7">
        <span className="sr-only">Cargando…</span>
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
    );
  }
  if (estado.tipo === 'error') {
    return (
      <p role="alert" className="p-7 text-sm text-destructive">
        No se pudo verificar la sesión. Recarga la página para intentarlo de nuevo.
      </p>
    );
  }
  return <SessionContext.Provider value={estado.usuario}>{children}</SessionContext.Provider>;
}

/** Usuario de la sesión actual. Solo válido dentro de `SessionGuard`. */
export function useSession(): SessionUser {
  const usuario = useContext(SessionContext);
  if (!usuario) throw new Error('useSession debe usarse dentro de SessionGuard');
  return usuario;
}
