import type { ProcesoCargado, ProcesoEncontrado } from '../../domain/cpnu-data.js';

export type { ProcesoCargado, ProcesoEncontrado };

export const CPNU_PORT = Symbol('CPNU_PORT');

/** A document (PDF) attached to an actuación. */
export interface DocumentoActuacion {
  id: unknown;
  tipo: unknown;
  fechaCarga: unknown;
  nombre: string;
  url: string;
}

/**
 * Port to the Rama Judicial's Consulta Nacional Unificada (CPNU). Failures
 * reject with an `Error` whose message is user-facing Spanish copy, or with a
 * `TimeoutError` when CPNU does not answer in time.
 */
export interface CpnuPort {
  /** Instances of a 23-digit radicado (empty when not found). */
  searchRadicado(numero: string): Promise<ProcesoEncontrado[]>;
  /** Detail, parties and every actuación (most recent first) of a proceso. */
  loadProceso(idProceso: string): Promise<ProcesoCargado>;
  /** Documents of an actuación (empty when none). */
  listDocumentos(idActuacion: string): Promise<DocumentoActuacion[]>;
}
