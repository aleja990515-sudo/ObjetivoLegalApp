// Frozen copy of the legacy ICS algorithm (lib/app.js:143-168), copied
// verbatim except for type annotations. It is a test oracle only: it survives
// the T7 cutover so the Nest output can keep being compared byte-for-byte.
// `new Date()` inside it is faked by the tests (vi.setSystemTime).

export const legacyIcsTexto = (s: unknown): string => String(s || '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\r?\n/g, '\\n');

export function legacyGenerarIcs(procesos: any[]): string {
  const ahora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MisProcesos//ES', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', 'X-WR-CALNAME:Mis Procesos – términos', 'X-WR-TIMEZONE:America/Bogota'];
  for (const p of procesos) for (const t of p.tareas || []) {
    if (t.hecha || !/^\d{4}-\d{2}-\d{2}$/.test(t.fecha)) continue;
    const dia = t.fecha.replace(/-/g, '');
    lineas.push('BEGIN:VEVENT', `UID:${t.id}@misprocesos`, `DTSTAMP:${ahora}`);
    if (/^\d{2}:\d{2}$/.test(t.hora || '')) {
      // Colombia es UTC-5 todo el año.
      const inicio = new Date(`${t.fecha}T${t.hora}:00-05:00`);
      const f = (d: Date): string => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
      lineas.push(`DTSTART:${f(inicio)}`, `DTEND:${f(new Date(inicio.getTime() + 3600e3))}`);
    } else {
      const sig = new Date(`${t.fecha}T00:00:00Z`); sig.setUTCDate(sig.getUTCDate() + 1);
      lineas.push(`DTSTART;VALUE=DATE:${dia}`, `DTEND;VALUE=DATE:${sig.toISOString().slice(0, 10).replace(/-/g, '')}`);
    }
    lineas.push(`SUMMARY:${legacyIcsTexto(`${t.titulo} – ${p.alias || p.radicado}`)}`,
      `DESCRIPTION:${legacyIcsTexto(`Radicado ${p.radicado}\n${p.detalle?.despacho || p.despacho || ''}${t.responsable ? '\nResponsable: ' + t.responsable : ''}`)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Recordatorio', 'TRIGGER:-P1D', 'END:VALARM', 'END:VEVENT');
  }
  lineas.push('END:VCALENDAR');
  return lineas.join('\r\n');
}
