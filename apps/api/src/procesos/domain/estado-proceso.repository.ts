export const ESTADO_PROCESO_REPOSITORY = Symbol('ESTADO_PROCESO_REPOSITORY');

/**
 * One estado of a despacho in which a followed caso was found. The estados
 * channel does not inherit the reservation of a private case, so this is how the
 * office learns that a reserved case moved.
 */
export interface EstadoProceso {
  idProceso: string;
  /** Detail page of the estado; its identity within one proceso. */
  urlEstado: string;
  numeroEstado: string | null;
  /** `YYYY-MM-DD`. */
  fechaPublicacion: string | null;
  /** The radicado as it appeared in the LISTADO (a recurso can change the stored one). */
  radicadoEncontrado: string;
  /** Cleared when the office reads the proceso. */
  visto: boolean;
  /** ISO instant of the sweep that found it. */
  detectadoEn: string;
}

/** Persistence port of the estados detections (one row per `(proceso, estado)`). */
export interface EstadoProcesoRepository {
  /**
   * Insert only: a repeated `(proceso, estado)` stores nothing and keeps the
   * committed row, so `visto` is never reset. Returns `false` when the proceso no
   * longer exists.
   */
  guardar(estado: EstadoProceso): Promise<boolean>;
  /** Detections of one proceso, most recently detected first. */
  listarPorProceso(idProceso: string): Promise<EstadoProceso[]>;
}
