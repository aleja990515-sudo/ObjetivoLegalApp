// Input normalisation ported from the legacy `texto`, `fechaValida` and the
// PATCH/POST branches of `rutasProtegidas` (lib/app.js:237-239, 312-375).
import { enRangoCalendario } from '../../common/time/temporal.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;

/** Field limits shared with the frontend copy. */
export const LIMITE = {
  alias: 120,
  responsable: 60,
  etiqueta: 30,
  etiquetas: 10,
  titulo: 200,
  nota: 4000,
} as const;

/** Primitive value as text; objects and arrays read as empty instead of "[object Object]". */
export function comoTexto(valor: unknown): string {
  return typeof valor === 'string' || typeof valor === 'number' || typeof valor === 'boolean' ? String(valor) : '';
}

/** Trimmed text cut to `max` characters (legacy `texto`). */
export function texto(valor: unknown, max: number): string {
  return comoTexto(valor).trim().slice(0, max);
}

/** `YYYY-MM-DD` that the legacy date parser accepted: month 1-12, day 1-31 (legacy `fechaValida`). */
export function fechaValida(valor: unknown): valor is string {
  return typeof valor === 'string' && FECHA.test(valor) && enRangoCalendario(valor);
}

/** `HH:MM` or the empty string when the value is anything else. */
export function horaValida(valor: unknown): string {
  return typeof valor === 'string' && HORA.test(valor) ? valor : '';
}

/**
 * Office tags: a comma-separated string or an array, trimmed, without empties
 * or duplicates, at most 10 of at most 30 characters. `null`/`undefined` mean
 * no tags (deliberate fix: the legacy code stored the tag "null").
 */
export function normalizarEtiquetas(valor: unknown): string[] {
  const lista: unknown[] = Array.isArray(valor) ? valor : valor == null ? [] : comoTexto(valor).split(',');
  const limpias = lista.map((etiqueta) => texto(etiqueta, LIMITE.etiqueta)).filter(Boolean);
  return [...new Set(limpias)].slice(0, LIMITE.etiquetas);
}

/** A JSON body as a plain record; anything else (missing, scalar, array) reads as empty. */
export function cuerpoObjeto(body: unknown): Record<string, unknown> {
  return typeof body === 'object' && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
}
