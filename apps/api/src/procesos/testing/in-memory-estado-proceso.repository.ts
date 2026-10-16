// In-memory adapter of the estados detections port, keyed like the table
// (`idProceso:urlEstado`). Follows the same contract as the TypeORM adapter.
import {
  compararEstados,
  type EstadoProceso,
  type EstadoProcesoRepository,
} from '../domain/estado-proceso.repository.js';

export class InMemoryEstadoProcesoRepository implements EstadoProcesoRepository {
  readonly filas = new Map<string, EstadoProceso>();

  async guardar(estado: EstadoProceso): Promise<boolean> {
    const clave = `${estado.idProceso}:${estado.urlEstado}`;
    if (!this.filas.has(clave)) this.filas.set(clave, structuredClone(estado));
    return true;
  }

  async listarPorProceso(idProceso: string): Promise<EstadoProceso[]> {
    return this.seleccionar((e) => e.idProceso === idProceso);
  }

  async listarNoVistos(): Promise<EstadoProceso[]> {
    return this.seleccionar((e) => !e.visto);
  }

  async contarNoVistos(): Promise<Map<string, number>> {
    const conteo = new Map<string, number>();
    for (const fila of this.filas.values()) {
      if (!fila.visto) conteo.set(fila.idProceso, (conteo.get(fila.idProceso) ?? 0) + 1);
    }
    return conteo;
  }

  async marcarVistos(idProceso: string): Promise<void> {
    for (const fila of this.filas.values()) {
      if (fila.idProceso === idProceso) fila.visto = true;
    }
  }

  private seleccionar(filtro: (estado: EstadoProceso) => boolean): EstadoProceso[] {
    return [...this.filas.values()]
      .filter(filtro)
      .sort(compararEstados)
      .map((e) => structuredClone(e));
  }
}
