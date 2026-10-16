// In-memory adapter of the estados detections port, keyed like the table
// (`procesoId:urlEstado`). Follows the same contract as the TypeORM adapter.
import {
  compararEstados,
  type EstadoProceso,
  type EstadoProcesoRepository,
} from '../domain/estado-proceso.repository.js';

export class InMemoryEstadoProcesoRepository implements EstadoProcesoRepository {
  readonly filas = new Map<string, EstadoProceso>();

  async guardar(estado: EstadoProceso): Promise<boolean> {
    const clave = `${estado.procesoId}:${estado.urlEstado}`;
    if (!this.filas.has(clave)) this.filas.set(clave, structuredClone(estado));
    return true;
  }

  async listarPorProceso(procesoId: string): Promise<EstadoProceso[]> {
    return this.seleccionar((e) => e.procesoId === procesoId);
  }

  async listarNoVistos(procesoIds: string[]): Promise<EstadoProceso[]> {
    return this.seleccionar((e) => !e.visto && procesoIds.includes(e.procesoId));
  }

  async contarNoVistos(): Promise<Map<string, number>> {
    const conteo = new Map<string, number>();
    for (const fila of this.filas.values()) {
      if (!fila.visto) conteo.set(fila.procesoId, (conteo.get(fila.procesoId) ?? 0) + 1);
    }
    return conteo;
  }

  async marcarVistos(procesoId: string): Promise<void> {
    for (const fila of this.filas.values()) {
      if (fila.procesoId === procesoId) fila.visto = true;
    }
  }

  private seleccionar(filtro: (estado: EstadoProceso) => boolean): EstadoProceso[] {
    return [...this.filas.values()]
      .filter(filtro)
      .sort(compararEstados)
      .map((e) => structuredClone(e));
  }
}
