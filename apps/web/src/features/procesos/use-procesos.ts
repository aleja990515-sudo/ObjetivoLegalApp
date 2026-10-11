'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { ListaProcesos } from './modelo';

export type EstadoLista =
  | { tipo: 'cargando' }
  | { tipo: 'lista'; datos: ListaProcesos }
  | { tipo: 'error' };

/** Carga `GET /api/procesos`. Un refresco fallido conserva la última lista. */
export function useProcesos() {
  const [estado, setEstado] = useState<EstadoLista>({ tipo: 'cargando' });

  const recargar = useCallback(async () => {
    try {
      const datos = await apiFetch<ListaProcesos>('/procesos');
      setEstado({ tipo: 'lista', datos });
    } catch {
      setEstado((previo) => (previo.tipo === 'lista' ? previo : { tipo: 'error' }));
    }
  }, []);

  useEffect(() => {
    void recargar();
  }, [recargar]);

  return { estado, recargar };
}
