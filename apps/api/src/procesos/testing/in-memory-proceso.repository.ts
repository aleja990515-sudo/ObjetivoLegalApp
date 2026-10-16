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
  /** Keyed by the surrogate `id`: two users may follow the same `idProceso`. */
  readonly procesos = new Map<string, Proceso>();

  constructor(initial: Proceso[] = []) {
    for (const p of initial) this.procesos.set(p.id, clone(p));
  }

  async findAll(usuarioId: string): Promise<Proceso[]> {
    return [...this.procesos.values()].filter((p) => p.usuarioId === usuarioId).map(clone);
  }

  async findById(idProceso: string, usuarioId: string): Promise<Proceso | null> {
    const p = this.estaSeguido(idProceso, usuarioId);
    return p ? clone(p) : null;
  }

  async findByIdForReview(id: string): Promise<Proceso | null> {
    const p = this.procesos.get(id);
    return p ? clone(p) : null;
  }

  /**
   * Test-only lookup by CPNU id. `id_proceso` stopped being a key, so a spec that
   * knows only the id has to go through here instead of `findByIdForReview`.
   */
  async porIdProceso(idProceso: string, usuarioId?: string | null): Promise<Proceso | null> {
    const p = [...this.procesos.values()].find(
      (x) => x.idProceso === idProceso && (usuarioId === undefined || x.usuarioId === usuarioId),
    );
    return p ? clone(p) : null;
  }

  async listRefs(usuarioId: string): Promise<ProcesoRef[]> {
    const owner = ownerValido(usuarioId);
    return [...this.procesos.values()].filter((p) => p.usuarioId === owner).map(toRef);
  }

  async listRefsForReview(): Promise<ProcesoRef[]> {
    return [...this.procesos.values()].map(toRef);
  }

  async insert(proceso: Proceso): Promise<boolean> {
    // Mirrors the two database keys: `UNIQUE (usuario_id, id_proceso)` plus the
    // partial index over the orphans, which a plain unique index would leave
    // unconstrained because it compares NULLs as distinct.
    if (this.estaSeguido(proceso.idProceso, proceso.usuarioId)) return false;
    this.procesos.set(proceso.id, clone(proceso));
    return true;
  }

  async delete(id: string): Promise<boolean> {
    return this.procesos.delete(id);
  }

  async updateCpnuState(
    id: string,
    mutate: (current: ProcesoCpnuState) => ProcesoCpnuState,
  ): Promise<ProcesoCpnuState | null> {
    const p = this.procesos.get(id);
    if (!p) return null;
    const { detalle, sujetos, actuaciones, noVistas, ultimaConsulta, error } = clone(p);
    const next = mutate({ detalle, sujetos, actuaciones, noVistas, ultimaConsulta, error });
    const unseen = new Set(next.noVistas);
    const pruned = [...new Set(next.actuaciones.filter((a) => unseen.has(a.id)).map((a) => a.id))];
    Object.assign(p, clone({ ...next, noVistas: pruned }));
    return clone({ ...next, noVistas: pruned });
  }

  async updateOffice(id: string, changes: ProcesoOfficeChanges): Promise<boolean> {
    const p = this.procesos.get(id);
    if (!p) return false;
    Object.assign(p, clone(Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined))));
    return true;
  }

  async markSeen(id: string): Promise<boolean> {
    const p = this.procesos.get(id);
    if (!p) return false;
    p.noVistas = [];
    p.nuevaInstancia = false;
    return true;
  }

  async addNota(id: string, nota: Nota): Promise<boolean> {
    const p = this.procesos.get(id);
    if (!p) return false;
    p.notas.unshift(clone(nota));
    return true;
  }

  async deleteNota(id: string, idNota: string): Promise<boolean> {
    const p = this.procesos.get(id);
    if (!p || !p.notas.some((n) => n.id === idNota)) return false;
    p.notas = p.notas.filter((n) => n.id !== idNota);
    return true;
  }

  async addTarea(id: string, tarea: Tarea): Promise<boolean> {
    const p = this.procesos.get(id);
    if (!p) return false;
    p.tareas.push(clone(tarea));
    return true;
  }

  async updateTarea(id: string, idTarea: string, changes: TareaChanges): Promise<boolean> {
    const tarea = this.procesos.get(id)?.tareas.find((t) => t.id === idTarea);
    if (!tarea) return false;
    Object.assign(tarea, clone(Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined))));
    return true;
  }

  async deleteTarea(id: string, idTarea: string): Promise<boolean> {
    const p = this.procesos.get(id);
    if (!p || !p.tareas.some((t) => t.id === idTarea)) return false;
    p.tareas = p.tareas.filter((t) => t.id !== idTarea);
    return true;
  }

  /** An ownerless row dedupes on `id_proceso` alone, the way `procesos_huerfano_uniq` does. */
  private estaSeguido(idProceso: string, usuarioId: string | null): Proceso | undefined {
    return [...this.procesos.values()].find((p) => p.idProceso === idProceso && p.usuarioId === usuarioId);
  }
}

const toRef = ({ id, idProceso, radicado }: Proceso): ProcesoRef => ({ id, idProceso, radicado });

export class InMemoryMetaRepository implements MetaRepository {
  readonly values = new Map<string, string>();

  async get(clave: string): Promise<string | null> {
    return this.values.get(clave) ?? null;
  }

  async set(clave: string, valor: string): Promise<void> {
    this.values.set(clave, valor);
  }
}
