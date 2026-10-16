import type { Conteos } from '@/components/sidebar/sidebar';
import { apiFetch } from '@/lib/api';

interface ProcesoResumen {
  noVistas: number;
  estadosNoVistos?: number;
}

/** Cuentas de la barra lateral: novedades (longitud de `/api/novedades`) y actuaciones sin revisar. */
export async function fetchConteos(): Promise<Conteos> {
  const [novedades, { procesos }] = await Promise.all([
    apiFetch<unknown[]>('/novedades'),
    apiFetch<{ procesos: ProcesoResumen[] }>('/procesos'),
  ]);
  return {
    novedades: novedades.length,
    noVistas: procesos.reduce((suma, p) => suma + p.noVistas + (p.estadosNoVistos ?? 0), 0),
  };
}
