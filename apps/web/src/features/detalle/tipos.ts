import type { ProcesoDetalle } from '@/features/procesos/modelo';

/** Resultado de una mutación: la vista nueva del proceso (si cambió) y un aviso para el usuario. */
export interface ResultadoAccion {
  proceso?: ProcesoDetalle;
  aviso?: string;
}

/** Ejecuta una mutación con estado ocupado y muestra su aviso o su error. */
export type Ejecutar = (operacion: () => Promise<ResultadoAccion>) => Promise<void>;
