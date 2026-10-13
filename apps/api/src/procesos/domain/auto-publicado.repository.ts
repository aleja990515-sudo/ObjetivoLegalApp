import type { ResultadoAuto } from './autos.js';

export const AUTO_PUBLICADO_REPOSITORY = Symbol('AUTO_PUBLICADO_REPOSITORY');

/** Stored result of the search of one providencia in Publicaciones Procesales. */
export interface AutoPublicado extends ResultadoAuto {
  idProceso: string;
  idActuacion: number;
  /** ISO instant of the last search. */
  buscadoEn: string;
  /** Searches done so far (1 after the first one). */
  intentos: number;
}

/** Persistence port of the autos results (one row per actuación of a proceso). */
export interface AutoPublicadoRepository {
  buscar(idProceso: string, idActuacion: number): Promise<AutoPublicado | null>;
  /** Inserts or replaces the row. Returns `false` (and stores nothing) when the proceso no longer exists. */
  guardar(auto: AutoPublicado): Promise<boolean>;
}
