// Read models of a proceso, ported from the legacy `resumen`, `detalleCompleto`,
// `pendientes` and the sorting of `GET /procesos` and `GET /novedades`
// (lib/app.js:212-309). Pure functions: the "today" date is an argument.

import type { EstadoProceso } from './estado-proceso.repository.js';
import type { Actuacion, Proceso, Sujeto, Tarea } from './proceso.js';

/** Actuaciones that are the judge's decisions (autos, sentencias, fallos, providencias). */
export const ES_PROVIDENCIA = /^\s*(auto|sentencia|fallo|providencia|decisi[oó]n)/i;

/** Compact summary of a proceso (list rows and mutation responses). */
export interface ProcesoResumen {
  idProceso: string;
  radicado: string;
  alias: string;
  despacho: string | null;
  claseProceso: unknown;
  sujetos: string | null;
  /** True when the Rama reserved the case: it only has the radicado search data. */
  esPrivado: boolean;
  ultimaActuacion: Actuacion | null;
  ultimoAuto: Actuacion | null;
  /** Number of unseen actuaciones. */
  noVistas: number;
  /** Number of estados detected for this caso that the office has not read yet. */
  estadosNoVistos: number;
  nuevaInstancia: boolean;
  proximaTarea: Tarea | null;
  tareasVencidas: number;
  responsable: string;
  etiquetas: string[];
  ultimaConsulta: string | null;
  agregadoPor: string;
  error: string | null;
}

/** Full view of a proceso (`GET /procesos/:id` and the notes/tasks mutations). */
export type ProcesoDetalle = Omit<ProcesoResumen, 'sujetos'> & {
  detalle: Record<string, unknown>;
  sujetos: Sujeto[];
  actuaciones: Actuacion[];
  noVistasIds: number[];
  /** Estados of the court in which the caso's radicado was published, newest first. */
  estados: EstadoProceso[];
  notas: Proceso['notas'];
  tareas: Tarea[];
};

/** Base fields shared by every novedad. */
export interface NovedadBase {
  idProceso: string;
  radicado: string;
  alias: string;
  despacho: string | null;
}

export type Novedad = NovedadBase &
  (
    | { tipo: 'instancia'; fecha: string }
    | { tipo: 'actuacion'; fecha: string | null; actuacion: Actuacion }
    | { tipo: 'estado'; fecha: string | null; estado: EstadoProceso }
  );

export function courtName(p: Proceso): string | null {
  return ((p.detalle.despacho as string | undefined) || p.despacho) ?? null;
}

/** Tasks not done yet, by date and time. */
export function pendientes(p: Proceso): Tarea[] {
  return p.tareas
    .filter((t) => !t.hecha)
    .sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')));
}

export function resumen(p: Proceso, hoy: string, estadosNoVistos = 0): ProcesoResumen {
  const pendientesDe = pendientes(p);
  return {
    idProceso: p.idProceso,
    radicado: p.radicado,
    alias: p.alias,
    despacho: courtName(p),
    claseProceso: p.detalle.claseProceso,
    sujetos: p.sujetosTexto,
    esPrivado: p.esPrivado,
    ultimaActuacion: p.actuaciones[0] ?? null,
    ultimoAuto: p.actuaciones.find((a) => ES_PROVIDENCIA.test(a.actuacion || '')) ?? null,
    noVistas: p.noVistas.length,
    estadosNoVistos,
    nuevaInstancia: p.nuevaInstancia,
    proximaTarea: pendientesDe[0] ?? null,
    tareasVencidas: pendientesDe.filter((t) => t.fecha < hoy).length,
    responsable: p.responsable,
    etiquetas: p.etiquetas,
    ultimaConsulta: p.ultimaConsulta,
    agregadoPor: p.agregadoPor,
    error: p.error,
  };
}

export function detalleCompleto(p: Proceso, hoy: string, estados: EstadoProceso[] = []): ProcesoDetalle {
  return {
    // The count is derived from the rows of this same answer, so the two agree.
    ...resumen(p, hoy, estados.filter((e) => !e.visto).length),
    detalle: p.detalle,
    sujetos: p.sujetos,
    actuaciones: p.actuaciones,
    noVistasIds: p.noVistas,
    estados,
    notas: p.notas,
    tareas: p.tareas,
  };
}

/** Most recent first; missing dates sort last. */
export function compararFechaDesc(a: string | null | undefined, b: string | null | undefined): number {
  if (a == null) return b == null ? 0 : 1;
  if (b == null) return -1;
  return b.localeCompare(a);
}

/**
 * List order: procesos with unseen actuaciones, new instances or unseen estado
 * detections first (most items first), then the most recent actuación, then the
 * idProceso tie-break.
 */
export function compararProcesos(a: ProcesoResumen, b: ProcesoResumen): number {
  const alertas = (p: ProcesoResumen) => p.noVistas + p.estadosNoVistos + Number(p.nuevaInstancia);
  return (
    alertas(b) - alertas(a) ||
    compararFechaDesc(a.ultimaActuacion?.fecha, b.ultimaActuacion?.fecha) ||
    a.idProceso.localeCompare(b.idProceso)
  );
}

/** Novedades order: most recent first, missing dates last, then idProceso. */
export function compararNovedades(a: { idProceso: string; fecha?: string | null }, b: { idProceso: string; fecha?: string | null }): number {
  return compararFechaDesc(a.fecha, b.fecha) || a.idProceso.localeCompare(b.idProceso);
}

/**
 * Unseen actuaciones, new instances and unseen estado detections of every
 * proceso (`GET /novedades`). A caso whose radicado was published in an estado
 * is a novedad on its own, even when it has no actuaciones to show.
 */
export function novedades(procesos: Proceso[], detecciones: EstadoProceso[]): Novedad[] {
  const porProceso = new Map<string, EstadoProceso[]>();
  for (const deteccion of detecciones) {
    const grupo = porProceso.get(deteccion.procesoId);
    if (grupo) grupo.push(deteccion);
    else porProceso.set(deteccion.procesoId, [deteccion]);
  }

  const items: Novedad[] = [];
  for (const p of procesos) {
    const base: NovedadBase = { idProceso: p.idProceso, radicado: p.radicado, alias: p.alias, despacho: courtName(p) };
    if (p.nuevaInstancia) items.push({ ...base, tipo: 'instancia', fecha: p.agregado });
    const noVistas = new Set(p.noVistas);
    for (const a of p.actuaciones) {
      if (noVistas.has(a.id)) items.push({ ...base, tipo: 'actuacion', fecha: a.fecha, actuacion: a });
    }
    for (const estado of porProceso.get(p.id) ?? []) {
      items.push({ ...base, tipo: 'estado', fecha: estado.fechaPublicacion, estado });
    }
  }
  return items.sort(compararNovedades);
}
