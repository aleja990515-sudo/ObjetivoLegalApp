// In-memory adapter of the estados detections port, keyed like the table
// (`idProceso:urlEstado`). Follows the same contract as the TypeORM adapter.
import type { EstadoProceso, EstadoProcesoRepository } from '../domain/estado-proceso.repository.js';

export class InMemoryEstadoProcesoRepository implements EstadoProcesoRepository {
  readonly filas = new Map<string, EstadoProceso>();

  async guardar(estado: EstadoProceso): Promise<boolean> {
    const clave = `${estado.idProceso}:${estado.urlEstado}`;
    if (!this.filas.has(clave)) this.filas.set(clave, structuredClone(estado));
    return true;
  }

  async listarPorProceso(idProceso: string): Promise<EstadoProceso[]> {
    return [...this.filas.values()].filter((e) => e.idProceso === idProceso).map((e) => structuredClone(e));
  }
}
