// Agenda of the whole office, ported from the legacy `GET /agenda` (lib/app.js:285-293).
import type { Proceso, Tarea } from '../../procesos/domain/proceso.js';
import { courtName } from '../../procesos/domain/proceso-resumen.js';

export interface TareaAgenda extends Tarea {
  idProceso: string;
  radicado: string;
  alias: string;
  despacho: string | null;
}

/** Every task of every proceso, by date and time; ties break by proceso and task id. */
export function tareasAgenda(procesos: Proceso[]): TareaAgenda[] {
  return procesos
    .flatMap((p) =>
      p.tareas.map((t): TareaAgenda => ({
        ...t,
        idProceso: p.idProceso,
        radicado: p.radicado,
        alias: p.alias,
        despacho: courtName(p),
      })),
    )
    .sort(
      (a, b) =>
        (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')) ||
        a.idProceso.localeCompare(b.idProceso) ||
        a.id.localeCompare(b.id),
    );
}
