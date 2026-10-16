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

/** Persistence port for procesos (aggregate root with actuaciones, sujetos, notas and tareas). */
export interface ProcesoRepository {
  findAll(): Promise<Proceso[]>;
  findById(idProceso: string): Promise<Proceso | null>;
  listRefs(): Promise<ProcesoRef[]>;

  /** Refs of the reserved procesos (`esPrivado`), which CPNU cannot refresh. */
  listPrivados(): Promise<ProcesoRef[]>;

  /** Inserts a new proceso with its children. Returns `false` when the id already exists. */
  insert(proceso: Proceso): Promise<boolean>;
  /** Returns `false` when the proceso did not exist. */
  delete(idProceso: string): Promise<boolean>;

  /**
   * Atomically replaces the CPNU-owned state. The proceso row is locked
   * (`SELECT ... FOR UPDATE`), `mutate` receives the current state and returns
   * the next one, and only CPNU-owned data is written. Returns `null` (and
   * writes nothing) when the proceso no longer exists, so a refresh can never
   * resurrect a deleted proceso nor overwrite office edits.
   */
  updateCpnuState(
    idProceso: string,
    mutate: (current: ProcesoCpnuState) => ProcesoCpnuState,
  ): Promise<ProcesoCpnuState | null>;

  updateOffice(idProceso: string, changes: ProcesoOfficeChanges): Promise<boolean>;
  /** Clears every unseen actuación and the new-instance flag. */
  markSeen(idProceso: string): Promise<boolean>;

  addNota(idProceso: string, nota: Nota): Promise<boolean>;
  deleteNota(idProceso: string, idNota: string): Promise<boolean>;

  addTarea(idProceso: string, tarea: Tarea): Promise<boolean>;
  updateTarea(idProceso: string, idTarea: string, changes: TareaChanges): Promise<boolean>;
  deleteTarea(idProceso: string, idTarea: string): Promise<boolean>;
}
