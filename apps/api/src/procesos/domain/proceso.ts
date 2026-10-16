// Domain model of a followed court case ("proceso"). Plain types, no framework
// decorators. Property names are the public API contract (Spanish) shared with
// the frontend; timestamps are ISO-8601 strings like the legacy JSON store.

/** One CPNU "actuación" (procedural action) of a proceso. */
export interface Actuacion {
  id: number;
  cons: number | null;
  fecha: string | null;
  actuacion: string | null;
  anotacion: string | null;
  fechaInicial: string | null;
  fechaFinal: string | null;
  fechaRegistro: string | null;
  conDocumentos: boolean | null;
}

/** A party ("sujeto procesal") as reported by CPNU. */
export interface Sujeto {
  tipo: string | null;
  nombre: string | null;
}

/** Internal office note. */
export interface Nota {
  id: string;
  texto: string;
  autor: string;
  fecha: string;
}

/** Office task / legal deadline shown in the agenda. */
export interface Tarea {
  id: string;
  titulo: string;
  /** `YYYY-MM-DD`. */
  fecha: string;
  /** `HH:MM` or `''`. */
  hora: string;
  responsable: string;
  idActuacion: string | null;
  hecha: boolean;
  hechaPor: string | null;
  autor: string;
  creada: string;
}

/**
 * Data owned by CPNU (the Rama Judicial). A refresh only ever replaces this part
 * of a proceso; office-owned fields are never written by a refresh.
 */
export interface ProcesoCpnuState {
  detalle: Record<string, unknown>;
  sujetos: Sujeto[];
  /** In CPNU order (most recent first). */
  actuaciones: Actuacion[];
  /** Ids of actuaciones not yet reviewed by the office. Always a subset of `actuaciones`. */
  noVistas: number[];
  ultimaConsulta: string | null;
  error: string | null;
}

/** Fields edited by the office (never touched by a CPNU refresh). */
export interface ProcesoOfficeState {
  alias: string;
  responsable: string;
  etiquetas: string[];
  nuevaInstancia: boolean;
  notas: Nota[];
  tareas: Tarea[];
}

export interface Proceso extends ProcesoCpnuState, ProcesoOfficeState {
  /** CPNU `idProceso`, stored as a string. One radicado can map to several. */
  idProceso: string;
  /** 23-digit radicado. */
  radicado: string;
  /** Owner (`usuarios.id`). Only this user reads and writes the proceso. */
  usuarioId: string | null;
  /** Court name from the radicado search (fallback when `detalle.despacho` is missing). */
  despacho: string | null;
  /** Parties summary from the radicado search. */
  sujetosTexto: string | null;
  agregadoPor: string;
  agregado: string;
}

export interface ProcesoRef {
  idProceso: string;
  radicado: string;
}

/** Office fields editable through PATCH /procesos/:id. */
export type ProcesoOfficeChanges = Partial<Pick<Proceso, 'alias' | 'responsable' | 'etiquetas'>>;

/** Editable fields of a tarea. */
export type TareaChanges = Partial<Pick<Tarea, 'titulo' | 'fecha' | 'hora' | 'responsable' | 'hecha' | 'hechaPor'>>;
