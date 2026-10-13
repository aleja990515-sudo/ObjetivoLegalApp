// Mapping of a CPNU providencia ("auto", "sentencia"...) to the PDF published in
// the electronic estados of the Publicaciones Procesales portal. Pure functions:
// no network, no framework. The portal is not a documented API, so every rule
// here comes from observed file names (see odd/tasks/autos-publicaciones.md).

import type { Actuacion } from './proceso.js';

/**
 * How sure the match is:
 * - `exacto`: a PDF whose file name carries the radicado (year + consecutivo).
 * - `del_dia`: the combined "AUTOS<yyyymmdd>.pdf" of the estado fixed on the
 *   fijación date; the auto is probably inside but nobody checked it.
 * - `estado`: no PDF identified; the estado page closest to the fijación.
 * - `sin_resultado`: the portal returned no publication in the window.
 */
export type Confianza = 'exacto' | 'del_dia' | 'estado' | 'sin_resultado';

/** Public contract of `GET /api/procesos/:id/actuaciones/:actuacionId/auto`. */
export interface ResultadoAuto {
  confianza: Confianza;
  urlPdf: string | null;
  nombreArchivo: string | null;
  urlEstado: string | null;
  numeroEstado: string | null;
  /** `YYYY-MM-DD`. */
  fechaPublicacion: string | null;
}

/** One row of the portal search (an estado or another publication of the despacho). */
export interface EstadoPublicado {
  titulo: string;
  /** "Tipo de publicación" text, e.g. "Notificaciones por Estados". */
  tipo: string;
  /** `YYYY-MM-DD` publication date shown in the search results. */
  fechaPublicacion: string | null;
  /** Absolute URL of the publication detail page. */
  urlEstado: string;
}

/** A file listed in a publication detail page (the server never downloads it). */
export interface ArchivoPublicado {
  nombre: string;
  url: string;
}

export interface VentanaBusqueda {
  /** Date of the auto. */
  desde: string;
  /** Fijación date + 2 business days (a Friday fijación can be published on Monday). */
  hasta: string;
  fijacion: string;
}

export const SIN_RESULTADO: ResultadoAuto = {
  confianza: 'sin_resultado',
  urlPdf: null,
  nombreArchivo: null,
  urlEstado: null,
  numeroEstado: null,
  fechaPublicacion: null,
};

/** Business days added after the fijación to close the search window. */
export const DIAS_HABILES_TRAS_FIJACION = 2;

const ES_PROVIDENCIA = /^\s*(auto|sentencia|fallo|providencia|decisi[oó]n)/i;
const ES_FIJACION_ESTADO = /^\s*fijaci[oó]n\s+(de\s+)?estados?/i;
const SOLO_FECHA = /^[A-Za-zÁÉÍÓÚÑáéíóúñ _-]+\d{8}\.pdf$/;
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Actuaciones that are decisions of the judge (same rule as the web app). */
export function esProvidencia(actuacion: string | null | undefined): boolean {
  return ES_PROVIDENCIA.test(actuacion ?? '');
}

export function esFijacionEstado(actuacion: string | null | undefined): boolean {
  return ES_FIJACION_ESTADO.test(actuacion ?? '');
}

const dia = (fecha: string | null): string | null => (fecha && /^\d{4}-\d{2}-\d{2}/.test(fecha) ? fecha.slice(0, 10) : null);

/** Adds `n` business days (Monday to Friday). Colombian holidays are not counted in v1. */
export function sumarDiasHabiles(fecha: string, n: number): string {
  let d = Temporal.PlainDate.from(fecha);
  let faltan = n;
  while (faltan > 0) {
    d = d.add({ days: 1 });
    if (d.dayOfWeek <= 5) faltan--;
  }
  return d.toString();
}

/**
 * Fijación date of an auto: the first CPNU "Fijación estado" on or after the
 * auto date; without one, the next business day (the usual practice).
 */
export function fechaFijacion(auto: Actuacion, actuaciones: Actuacion[]): string | null {
  const fechaAuto = dia(auto.fecha);
  if (!fechaAuto) return null;
  const fijaciones = actuaciones
    .filter((a) => esFijacionEstado(a.actuacion))
    .map((a) => dia(a.fecha))
    .filter((f): f is string => f !== null && f >= fechaAuto)
    .sort();
  return fijaciones[0] ?? sumarDiasHabiles(fechaAuto, 1);
}

/** Search window: from the auto date to the fijación + 2 business days. */
export function ventanaBusqueda(auto: Actuacion, actuaciones: Actuacion[]): VentanaBusqueda | null {
  const desde = dia(auto.fecha);
  const fijacion = fechaFijacion(auto, actuaciones);
  if (!desde || !fijacion) return null;
  return { desde, hasta: sumarDiasHabiles(fijacion, DIAS_HABILES_TRAS_FIJACION), fijacion };
}

/**
 * Date of the estado from its title, in either observed format:
 * "Notificación por Estado No.020 de 23 de febrero de 2026" or "ESTADOS20250820".
 */
export function fechaDelTitulo(titulo: string): string | null {
  const compacta = titulo.match(/(?<!\d)(20\d\d)(\d\d)(\d\d)(?!\d)/);
  if (compacta) return valida(`${compacta[1]}-${compacta[2]}-${compacta[3]}`);
  const larga = titulo
    .toLowerCase()
    .replace('setiembre', 'septiembre')
    .match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+(?:de|del)\s+(\d{4})/);
  const mes = larga ? MESES.indexOf(larga[2]) : -1;
  if (!larga || mes < 0) return null;
  return valida(`${larga[3]}-${String(mes + 1).padStart(2, '0')}-${larga[1].padStart(2, '0')}`);
}

function valida(fecha: string): string | null {
  try {
    return Temporal.PlainDate.from(fecha, { overflow: 'reject' }).toString();
  } catch {
    return null;
  }
}

/** "020" from "Notificación por Estado No.020 de ..." (null for titles without a number). */
export function numeroDelTitulo(titulo: string): string | null {
  return titulo.match(/\bN(?:o|°|º)\.?\s*(\d{1,5})\b/i)?.[1] ?? null;
}

/** File names that are only a word and a date ("AUTOS20260611.pdf"): never a radicado. */
export function esNombreSoloFecha(nombre: string): boolean {
  return SOLO_FECHA.test(nombre.normalize('NFC').trim());
}

/**
 * Whether a file name belongs to the radicado: rule `a` is `<year><consecutivo>`
 * contiguous ("031202600100Concede.pdf"); rule `b` is year and consecutivo with
 * separators or without zeros ("2025-01333", "1333 de 2025", "20251333").
 */
export function reglaArchivo(nombre: string, radicado: string): 'a' | 'b' | null {
  if (!/^\d{23}$/.test(radicado)) return null;
  const base = nombre.normalize('NFC').trim();
  if (esNombreSoloFecha(base)) return null;
  const year = radicado.slice(12, 16);
  const cons = radicado.slice(16, 21);
  if (base.includes(`${year}${cons}`)) return 'a';
  const c = `0*${Number(cons)}`;
  const sep = '[\\s._\\-/]*';
  // The lookarounds keep dates out ("2026-01-15", "15-01-2026" are not consecutivo 1).
  const formas = [
    `(?<!\\d)${year}${sep}${c}(?!\\d)(?![-/.]\\d)`,
    `(?<!\\d)(?<!\\d[-/.])${c}${sep}${year}(?!\\d)`,
    `(?<!\\d)${c}\\s*(de|del)\\s*${year}(?!\\d)`,
  ];
  return formas.some((f) => new RegExp(f, 'i').test(base)) ? 'b' : null;
}

const fechaEstado = (e: EstadoPublicado): string | null => fechaDelTitulo(e.titulo) ?? e.fechaPublicacion;
const esNotificacionPorEstado = (e: EstadoPublicado): boolean => /estado/i.test(e.tipo);

function distancia(fecha: string | null, fijacion: string): number {
  if (!fecha) return Number.POSITIVE_INFINITY;
  return Math.abs(Temporal.PlainDate.from(fecha).since(Temporal.PlainDate.from(fijacion)).days);
}

/** Estados closest to the fijación first; notificaciones por estado before other publications. */
export function ordenarEstados(estados: EstadoPublicado[], fijacion: string): EstadoPublicado[] {
  return [...estados].sort(
    (x, y) =>
      distancia(fechaEstado(x), fijacion) - distancia(fechaEstado(y), fijacion) ||
      Number(esNotificacionPorEstado(y)) - Number(esNotificacionPorEstado(x)),
  );
}

const datosEstado = (e: EstadoPublicado) => ({
  urlEstado: e.urlEstado,
  numeroEstado: numeroDelTitulo(e.titulo),
  fechaPublicacion: e.fechaPublicacion,
});

/**
 * Looks for the auto among the files of one estado: an `exacto` file by name,
 * else the combined `AUTOS<yyyymmdd>.pdf` (`del_dia`) when every file is
 * date-named and the estado is the one fixed on the fijación date.
 */
export function evaluarEstado(
  estado: EstadoPublicado,
  archivos: ArchivoPublicado[],
  radicado: string,
  fijacion: string,
): ResultadoAuto | null {
  const exacto = archivos.find((a) => reglaArchivo(a.nombre, radicado) !== null);
  if (exacto) return { confianza: 'exacto', urlPdf: exacto.url, nombreArchivo: exacto.nombre, ...datosEstado(estado) };

  const combinado = archivos.length > 0 && archivos.every((a) => esNombreSoloFecha(a.nombre));
  const delDia = fechaDelTitulo(estado.titulo) === fijacion || estado.fechaPublicacion === fijacion;
  if (!combinado || !delDia || !esNotificacionPorEstado(estado)) return null;
  const autos = archivos.find((a) => /auto|providenc/i.test(a.nombre));
  return autos ? { confianza: 'del_dia', urlPdf: autos.url, nombreArchivo: autos.nombre, ...datosEstado(estado) } : null;
}

/** Fallback when no PDF was identified: link to the estado page. */
export function resultadoEstado(estado: EstadoPublicado): ResultadoAuto {
  return { confianza: 'estado', urlPdf: null, nombreArchivo: null, ...datosEstado(estado) };
}
