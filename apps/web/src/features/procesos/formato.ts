// Formato de fechas, radicados y actuaciones (puerto de public/app.js de feat/ui-redesign).

/** Actuaciones que son decisiones del juez (autos, sentencias, fallos, providencias). */
const ES_PROVIDENCIA = /^\s*(auto|sentencia|fallo|providencia|decisi[oó]n)/i;

export function esProvidencia(actuacion: string | null | undefined): boolean {
  return ES_PROVIDENCIA.test(actuacion ?? '');
}

/** `11001-31-03-001-2024-00012-00` a partir de 23 dígitos; otro texto se devuelve igual. */
export function fmtRadicado(radicado: string): string {
  return radicado.replace(/^(\d{5})(\d{2})(\d{2})(\d{3})(\d{4})(\d{5})(\d{2})$/, '$1-$2-$3-$4-$5-$6-$7');
}

/** Fecha de hoy en Bogotá (UTC-5, sin horario de verano), `YYYY-MM-DD`. */
export function hoyColombia(ahora: Date = new Date()): string {
  return new Date(ahora.getTime() - 5 * 3600e3).toISOString().slice(0, 10);
}

/** `12 oct 2026`. Las fechas solo-día se leen en UTC para no correrlas un día. */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return 'Sin fecha';
  const valor = iso.length === 10 ? `${iso}T00:00:00Z` : iso;
  return new Date(valor).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
}

/** `lunes, 12 de octubre`. */
export function fechaLarga(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
}

/** Fecha y hora abreviadas; sin valor se muestra "nunca". */
export function fechaHora(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : 'nunca';
}
