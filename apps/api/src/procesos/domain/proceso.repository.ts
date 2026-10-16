import type {
  Nota,
  Proceso,
  ProcesoCpnuState,
  ProcesoOfficeChanges,
  ProcesoRef,
  Tarea,
  TareaChanges,
} from './proceso.js';

export const PROCESO_REPOSITORY = Symbol('PROCESO_REPOSITORY');

/**
 * Persistence port for procesos (aggregate root with actuaciones, sujetos, notas and tareas).
 *
 * Reads addressed from the API take the CPNU `idProceso`, because the route keeps
 * it and the owner scope makes it unambiguous. Everything that *writes* takes the
 * surrogate `id`: two users can follow the same `id_proceso`, so a write addressed
 * to it would land on both copies.
 */
export interface ProcesoRepository {
  /**
   * Reads are scoped to the owner: a user only ever sees the procesos they added.
   * Writes stay unscoped because every write path is already guarded upstream.
   */
  findAll(usuarioId: string): Promise<Proceso[]>;
  findById(idProceso: string, usuarioId: string): Promise<Proceso | null>;
  listRefs(usuarioId: string): Promise<ProcesoRef[]>;

  /** Refs of the reserved procesos (`esPrivado`) of every user, which CPNU cannot refresh. */
  listPrivados(): Promise<ProcesoRef[]>;

  /** System scope (the cron has no session): reads the procesos of every user. */
  listRefsForReview(): Promise<ProcesoRef[]>;
  findByIdForReview(id: string): Promise<Proceso | null>;

  /** Inserts a new proceso with its children. Returns `false` when the owner already follows it. */
  insert(proceso: Proceso): Promise<boolean>;
  /** Returns `false` when the proceso did not exist. */
  delete(id: string): Promise<boolean>;

  /**
   * Atomically replaces the CPNU-owned state. The proceso row is locked
   * (`SELECT ... FOR UPDATE`), `mutate` receives the current state and returns
   * the next one, and only CPNU-owned data is written. Returns `null` (and
   * writes nothing) when the proceso no longer exists, so a refresh can never
   * resurrect a deleted proceso nor overwrite office edits.
   */
  updateCpnuState(
    id: string,
    mutate: (current: ProcesoCpnuState) => ProcesoCpnuState,
  ): Promise<ProcesoCpnuState | null>;

  updateOffice(id: string, changes: ProcesoOfficeChanges): Promise<boolean>;
  /** Clears every unseen actuación and the new-instance flag. */
  markSeen(id: string): Promise<boolean>;

  addNota(id: string, nota: Nota): Promise<boolean>;
  deleteNota(id: string, idNota: string): Promise<boolean>;

  addTarea(id: string, tarea: Tarea): Promise<boolean>;
  updateTarea(id: string, idTarea: string, changes: TareaChanges): Promise<boolean>;
  deleteTarea(id: string, idTarea: string): Promise<boolean>;
}
