import { proceso, tarea } from '../../procesos/testing/proceso.fixtures.js';
import { tareasAgenda } from './agenda.js';

describe('tareasAgenda', () => {
  it('sorts by date and time (missing time first within a day) with idProceso and id as tie-breaks', () => {
    const procesos = [
      proceso('2', { radicado: 'R2', alias: 'Dos', tareas: [tarea('x', { fecha: '2026-10-12', hora: '' })] }),
      proceso('1', {
        radicado: 'R1',
        despacho: 'J1',
        tareas: [
          tarea('b', { fecha: '2026-10-12', hora: '10:00' }),
          tarea('a', { fecha: '2026-10-12', hora: '09:00' }),
          tarea('d', { fecha: '2026-10-11' }),
        ],
      }),
    ];
    const items = tareasAgenda(procesos);
    expect(items.map((t) => t.id)).toEqual(['d', 'x', 'a', 'b']);
    expect(items[0]).toMatchObject({ id: 'd', idProceso: '1', radicado: 'R1', alias: '', despacho: 'J1' });
    expect(items[1]).toMatchObject({ id: 'x', idProceso: '2', alias: 'Dos', despacho: 'JUZGADO 001 CIVIL DEL CIRCUITO' });
  });

  it('keeps done tasks, like the legacy agenda', () => {
    const items = tareasAgenda([proceso('1', { tareas: [tarea('h', { hecha: true })] })]);
    expect(items.map((t) => t.id)).toEqual(['h']);
  });
});
