// In-memory adapters of the procesos ports for unit tests. They follow the
// same contracts as the TypeORM adapters (see proceso.repository.ts).
import type { MetaRepository } from '../domain/meta.repository.js';
import type {
  Nota,
  Proceso,
  ProcesoCpnuState,
  ProcesoOfficeChanges,
  ProcesoRef,
  Tarea,
  TareaChanges,
} from '../domain/proceso.js';
import type { ProcesoRepository } from '../domain/proceso.repository.js';

const clone = <T>(value: T): T => structuredClone(value);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Postgres refuses to compare a `uuid` column with anything that is not a uuid
 * (22P02). The scoped owner lookup must do the same, otherwise an ownerless caller
 * passing `''` would silently filter to nothing here and blow up on the real
 * adapter with an error nobody had a unit test for.
 */
function ownerValido(usuarioId: string): string {
  if (!UUID.test(usuarioId)) {
    const error = new Error(`invalid input syntax for type uuid: "${usuarioId}"`) as Error & { code: string };
    error.code = '22P02';
    throw error;
  }
  return usuarioId;
}

export class InMemoryProcesoRepository implements ProcesoRepository {
  readonly procesos = new Map<string, Proceso>();

  constructor(initial: Proceso[] = []) {
    for (const p of initial) this.procesos.set(p.idProceso, clone(p));
  }

  async findAll(usuarioId: string): Promise<Proceso[]> {
    return [...this.procesos.values()].filter((p) => p.usuarioId === usuarioId).map(clone);
  }

  async findById(idProceso: string, usuarioId: string): Promise<Proceso | null> {
    const p = this.procesos.get(idProceso);
    return p?.usuarioId === usuarioId ? clone(p) : null;
  }

  async findByIdForReview(idProceso: string): Promise<Proceso | null> {
    const p = this.procesos.get(idProceso);
    return p ? clone(p) : null;
  }

  async listRefs(usuarioId: string): Promise<ProcesoRef[]> {
    const owner = ownerValido(usuarioId);
    return [...this.procesos.values()]
      .filter((p) => p.usuarioId === owner)
      .map(({ idProceso, radicado }) => ({ idProceso, radicado }));
  }

  async listRefsForReview(): Promise<ProcesoRef[]> {
    return [...this.procesos.values()].map(({ idProceso, radicado }) => ({ idProceso, radicado }));
  }

  async insert(proceso: Proceso): Promise<boolean> {
    if (this.procesos.has(proceso.idProceso)) return false;
    this.procesos.set(proceso.idProceso, clone(proceso));
    return true;
  }

  async delete(idProceso: string): Promise<boolean> {
    return this.procesos.delete(idProceso);
  }

  async updateCpnuState(
    idProceso: string,
    mutate: (current: ProcesoCpnuState) => ProcesoCpnuState,
  ): Promise<ProcesoCpnuState | null> {
    const p = this.procesos.get(idProceso);
    if (!p) return null;
    const { detalle, sujetos, actuaciones, noVistas, ultimaConsulta, error } = clone(p);
    const next = mutate({ detalle, sujetos, actuaciones, noVistas, ultimaConsulta, error });
    const unseen = new Set(next.noVistas);
    const pruned = [...new Set(next.actuaciones.filter((a) => unseen.has(a.id)).map((a) => a.id))];
    Object.assign(p, clone({ ...next, noVistas: pruned }));
    return clone({ ...next, noVistas: pruned });
  }

  async updateOffice(idProceso: string, changes: ProcesoOfficeChanges): Promise<boolean> {
    const p = this.procesos.get(idProceso);
    if (!p) return false;
    Object.assign(p, Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)));
    return true;
  }

  async markSeen(idProceso: string): Promise<boolean> {
    const p = this.procesos.get(idProceso);
    if (!p) return false;
    p.noVistas = [];
    p.nuevaInstancia = false;
    return true;
  }

  async addNota(idProceso: string, nota: Nota): Promise<boolean> {
    const p = this.procesos.get(idProceso);
    if (!p) return false;
    p.notas.unshift(clone(nota));
    return true;
  }

  async deleteNota(idProceso: string, idNota: string): Promise<boolean> {
    const p = this.procesos.get(idProceso);
    if (!p || !p.notas.some((n) => n.id === idNota)) return false;
    p.notas = p.notas.filter((n) => n.id !== idNota);
    return true;
  }

  async addTarea(idProceso: string, tarea: Tarea): Promise<boolean> {
    const p = this.procesos.get(idProceso);
    if (!p) return false;
    p.tareas.push(clone(tarea));
    return true;
  }

  async updateTarea(idProceso: string, idTarea: string, changes: TareaChanges): Promise<boolean> {
    const tarea = this.procesos.get(idProceso)?.tareas.find((t) => t.id === idTarea);
    if (!tarea) return false;
    Object.assign(tarea, Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined)));
    return true;
  }

  async deleteTarea(idProceso: string, idTarea: string): Promise<boolean> {
    const p = this.procesos.get(idProceso);
    if (!p || !p.tareas.some((t) => t.id === idTarea)) return false;
    p.tareas = p.tareas.filter((t) => t.id !== idTarea);
    return true;
  }
}

export class InMemoryMetaRepository implements MetaRepository {
  readonly values = new Map<string, string>();

  async get(clave: string): Promise<string | null> {
    return this.values.get(clave) ?? null;
  }

  async set(clave: string, valor: string): Promise<void> {
    this.values.set(clave, valor);
  }
}
