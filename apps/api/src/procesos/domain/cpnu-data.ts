import type { Actuacion, Sujeto } from './proceso.js';

/** A proceso (instance) returned by the CPNU radicado search. */
export interface ProcesoEncontrado {
  idProceso: string;
  despacho: string | null;
  sujetosProcesales: string | null;
  esPrivado: boolean;
}

/**
 * Current CPNU data of one proceso. `sujetos`/`actuaciones` are `null` when
 * CPNU failed to return them (it answers 500 for procesos without them): the
 * previous values must then be kept.
 */
export interface ProcesoCargado {
  detalle: Record<string, unknown>;
  sujetos: Sujeto[] | null;
  actuaciones: Actuacion[] | null;
}
