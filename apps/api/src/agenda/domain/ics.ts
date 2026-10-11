// iCalendar output ported byte-for-byte from the legacy `generarIcs`
// (lib/app.js:145-168). Known legacy gap kept on purpose: no 75-octet line folding.
import type { Proceso } from '../../procesos/domain/proceso.js';
import { courtName } from '../../procesos/domain/proceso-resumen.js';
import { fechaCalendario } from '../../common/time/temporal.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;
/** Colombia is UTC-5 all year round (offset form of the Bogotá zone). */
const OFFSET_COLOMBIA = '-05:00';

/** Escapes a text value for iCalendar (legacy `icsTexto`). */
export function icsTexto(valor: string): string {
  return valor.replace(/[\;,]/g, (c) => '\\' + c).replace(/\r?\n/g, '\\n');
}

/** UTC basic format without fractions, e.g. `20261012T140000Z`. */
const fechaUtc = (instante: Temporal.Instant): string =>
  instante.toString({ fractionalSecondDigits: 0 }).replace(/[-:]/g, '');

/**
 * Instant of a timed task in Colombia. `24:00` is the next midnight, as the legacy
 * parser read it; other out-of-range hours throw a RangeError.
 */
function inicioColombia(fecha: string, hora: string): Temporal.Instant {
  const dia = fechaCalendario(fecha);
  const [horas, minutos] = hora.split(':').map(Number);
  if (horas === 24 && minutos === 0) {
    return dia.add({ days: 1 }).toZonedDateTime({ timeZone: OFFSET_COLOMBIA }).toInstant();
  }
  const horaDelDia = Temporal.PlainTime.from({ hour: horas, minute: minutos });
  return dia.toZonedDateTime({ timeZone: OFFSET_COLOMBIA, plainTime: horaDelDia }).toInstant();
}

/** Calendar of the pending-or-done tasks that have a valid date; done tasks are skipped. */
export function generarIcs(procesos: Proceso[], ahora: Temporal.Instant): string {
  const dtstamp = fechaUtc(ahora);
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MisProcesos//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Mis Procesos – términos',
    'X-WR-TIMEZONE:America/Bogota',
  ];
  for (const p of procesos) {
    for (const t of p.tareas) {
      if (t.hecha || !FECHA.test(t.fecha)) continue;
      lineas.push('BEGIN:VEVENT', `UID:${t.id}@misprocesos`, `DTSTAMP:${dtstamp}`);
      if (HORA.test(t.hora)) {
        const inicio = inicioColombia(t.fecha, t.hora);
        lineas.push(`DTSTART:${fechaUtc(inicio)}`, `DTEND:${fechaUtc(inicio.add({ hours: 1 }))}`);
      } else {
        const dia = t.fecha.replace(/-/g, '');
        const siguiente = fechaCalendario(t.fecha).add({ days: 1 }).toString().replace(/-/g, '');
        lineas.push(`DTSTART;VALUE=DATE:${dia}`, `DTEND;VALUE=DATE:${siguiente}`);
      }
      const responsable = t.responsable ? '\nResponsable: ' + t.responsable : '';
      lineas.push(
        `SUMMARY:${icsTexto(`${t.titulo} – ${p.alias || p.radicado}`)}`,
        `DESCRIPTION:${icsTexto(`Radicado ${p.radicado}\n${courtName(p) ?? ''}${responsable}`)}`,
        'BEGIN:VALARM',
        'ACTION:DISPLAY',
        'DESCRIPTION:Recordatorio',
        'TRIGGER:-P1D',
        'END:VALARM',
        'END:VEVENT',
      );
    }
  }
  lineas.push('END:VCALENDAR');
  return lineas.join('\r\n');
}
