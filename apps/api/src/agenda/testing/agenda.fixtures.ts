// Fixed data for the agenda and ICS tests. Covers timed and all-day tasks,
// done tasks, malformed dates, escaping, year-end rollover and fallbacks.
import type { Proceso } from '../../procesos/domain/proceso.js';
import { proceso, tarea } from '../../procesos/testing/proceso.fixtures.js';

/** Fixed "now" (DTSTAMP and "today" in the tests). */
export const AHORA = Temporal.Instant.from('2026-10-10T12:00:00Z');

export function agendaFixture(): Proceso[] {
  return [
    proceso('1', {
      radicado: '11001310300120190012300',
      alias: 'Caso Pérez; Ruiz, S.A.',
      despacho: null,
      detalle: { despacho: 'JUZGADO 001 CIVIL' },
      tareas: [
        tarea('a1b2c3', { titulo: 'Contestar demanda', fecha: '2026-10-12', hora: '09:00', responsable: 'Luz' }),
        tarea('a1b2c4', { titulo: 'Audiencia\nfinal, 2ª parte', fecha: '2026-10-15', hora: '' }),
        tarea('a1b2c5', { titulo: 'Ya hecha', fecha: '2026-10-11', hecha: true }),
        tarea('a1b2c6', { titulo: 'Fecha mal formada', fecha: '2026/10/20' }),
      ],
    }),
    proceso('2', {
      radicado: '11001310300120190099999',
      alias: '',
      despacho: 'JUZGADO 002',
      detalle: {},
      tareas: [
        tarea('e1', { titulo: 'Término: traslado', fecha: '2026-12-31', hora: '23:30', responsable: '' }),
        tarea('e2', { titulo: 'Hora sin formato', fecha: '2027-01-02', hora: '9:00', responsable: 'Ana' }),
      ],
    }),
  ];
}
