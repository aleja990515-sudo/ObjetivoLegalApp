import type { CpnuPort, DocumentoActuacion } from '../application/ports/cpnu.port.js';
import type { ProcesoCargado, ProcesoEncontrado } from '../domain/cpnu-data.js';

/**
 * Programmable CPNU port for tests: set `radicados`/`procesos`/`documentos`, or
 * put an `Error` to make that call fail. Unknown ids load as CPNU 404 data.
 */
export class FakeCpnu implements CpnuPort {
  radicados = new Map<string, ProcesoEncontrado[] | Error>();
  procesos = new Map<string, ProcesoCargado | Error>();
  documentos = new Map<string, DocumentoActuacion[] | Error>();
  readonly calls: string[] = [];

  async searchRadicado(numero: string): Promise<ProcesoEncontrado[]> {
    this.calls.push(`search:${numero}`);
    return unwrap(this.radicados.get(numero) ?? []);
  }

  async loadProceso(idProceso: string): Promise<ProcesoCargado> {
    this.calls.push(`load:${idProceso}`);
    return structuredClone(unwrap(this.procesos.get(idProceso) ?? { detalle: {}, sujetos: null, actuaciones: null }));
  }

  async listDocumentos(idActuacion: string): Promise<DocumentoActuacion[]> {
    this.calls.push(`documentos:${idActuacion}`);
    return unwrap(this.documentos.get(idActuacion) ?? []);
  }
}

function unwrap<T>(value: T | Error): T {
  if (value instanceof Error) throw value;
  return value;
}

export function encontrado(idProceso: string, overrides: Partial<ProcesoEncontrado> = {}): ProcesoEncontrado {
  return {
    idProceso,
    despacho: `DESPACHO ${idProceso}`,
    sujetosProcesales: 'Demandante: A | Demandado: B',
    esPrivado: false,
    ...overrides,
  };
}
