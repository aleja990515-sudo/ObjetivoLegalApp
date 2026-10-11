// iCalendar output ported byte-for-byte from the legacy `generarIcs`
// (lib/app.js:145-168). Known legacy gap kept on purpose: no 75-octet line folding.
import type { Proceso } from '../../procesos/domain/proceso.js';
import { courtName } from '../../procesos/domain/proceso-resumen.js';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const HORA = /^\d{2}:\d{2}$/;
/** Colombia is UTC-5 all year round. */
const OFFSET_COLOMBIA = '-05:00';
const UNA_HORA_MS = 3600e3;

/** Escapes a text value for iCalendar (legacy `icsTexto`). */
export function icsTexto(valor: string): string {
  return valor.replace(/[\;,]/g, (c) => '\\' + c).replace(/\r?\n/g, '\\n');
}

/** UTC basic format, e.g. `20261012T140000Z`. */
const fechaUtc = (fecha: Date): string => fecha.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

/** Calendar of the pending-or-done tasks that have a valid date; done tasks are skipped. */
export function generarIcs(procesos: Proceso[], ahora: Date): string {
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
        const inicio = new Date(`${t.fecha}T${t.hora}:00${OFFSET_COLOMBIA}`);
        lineas.push(`DTSTART:${fechaUtc(inicio)}`, `DTEND:${fechaUtc(new Date(inicio.getTime() + UNA_HORA_MS))}`);
      } else {
        const siguiente = new Date(`${t.fecha}T00:00:00Z`);
        siguiente.setUTCDate(siguiente.getUTCDate() + 1);
        const dia = t.fecha.replace(/-/g, '');
        lineas.push(
          `DTSTART;VALUE=DATE:${dia}`,
          `DTEND;VALUE=DATE:${siguiente.toISOString().slice(0, 10).replace(/-/g, '')}`,
        );
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
