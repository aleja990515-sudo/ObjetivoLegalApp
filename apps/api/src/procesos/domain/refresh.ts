import { randomUUID } from 'node:crypto';
import type { ProcesoCargado, ProcesoEncontrado } from './cpnu-data.js';
import type { Proceso, ProcesoCpnuState } from './proceso.js';

// Refresh rules ported from the legacy `refrescar`, `nuevoProceso` and
// `detectarInstancias` (lib/app.js:64-115). Pure functions: no I/O, no clock.

export const AUTOMATIC_REVIEW_AUTHOR = 'Revisión automática';
export const NEW_INSTANCE_SUFFIX = ' (nueva instancia)';

export interface RefreshOutcome {
  state: ProcesoCpnuState;
  /** Number of actuaciones detected as new by this refresh. */
  nuevas: number;
}

/**
 * Applies freshly loaded CPNU data to the current state.
 * - Missing sujetos/actuaciones (CPNU failures) keep the previous values.
 * - An actuación is new only when the proceso already had actuaciones and its id
 *   was not among them, so the first load never marks anything as new.
 * - Unseen ids are the union of the previous ones and the new ones, pruned to
 *   the actuaciones that still exist.
 */
export function applyRefresh(current: ProcesoCpnuState, loaded: ProcesoCargado, now: string): RefreshOutcome {
  const sujetos = loaded.sujetos ?? current.sujetos;
  const actuaciones = loaded.actuaciones ?? current.actuaciones;
  const known = new Set(current.actuaciones.map((a) => a.id));
  const nuevas = current.actuaciones.length ? actuaciones.filter((a) => !known.has(a.id)).map((a) => a.id) : [];
  const listed = new Set(actuaciones.map((a) => a.id));
  const noVistas = [...new Set([...current.noVistas, ...nuevas])].filter((id) => listed.has(id));
  return {
    state: { detalle: loaded.detalle, sujetos, actuaciones, noVistas, ultimaConsulta: now, error: null },
    nuevas: nuevas.length,
  };
}

/** A failed refresh only records the error; everything else is kept. */
export function applyRefreshError(current: ProcesoCpnuState, message: string): ProcesoCpnuState {
  return { ...current, error: message };
}

/**
 * Empty proceso for a CPNU search result (legacy `nuevoProceso`). The surrogate
 * `id` is minted here, so a detected instance already carries its own key and
 * never collides with the copy of another user following the same expediente.
 */
export function newProceso(
  found: ProcesoEncontrado,
  radicado: string,
  agregadoPor: string,
  usuarioId: string | null,
  now: string,
  extra: Partial<Proceso> = {},
): Proceso {
  return {
    id: randomUUID(),
    idProceso: String(found.idProceso),
    radicado,
    usuarioId,
    alias: '',
    despacho: found.despacho,
    // CPNU hides the parties of a private proceso (it answers a placeholder string).
    sujetosTexto: found.esPrivado ? null : found.sujetosProcesales,
    esPrivado: found.esPrivado,
    detalle: {},
    sujetos: [],
    actuaciones: [],
    noVistas: [],
    notas: [],
    tareas: [],
    responsable: '',
    etiquetas: [],
    nuevaInstancia: false,
    agregadoPor,
    agregado: now,
    ultimaConsulta: null,
    error: null,
    ...extra,
  };
}

/**
 * A newly appeared instance of a followed radicado (e.g. the case went up to
 * the tribunal). It inherits the office data of the followed instance.
 */
export function newInstance(found: ProcesoEncontrado, radicado: string, base: Proceso | null, now: string): Proceso {
  return newProceso(found, radicado, AUTOMATIC_REVIEW_AUTHOR, base?.usuarioId ?? null, now, {
    alias: base?.alias ? `${base.alias}${NEW_INSTANCE_SUFFIX}` : '',
    responsable: base?.responsable || '',
    etiquetas: [...(base?.etiquetas ?? [])],
    nuevaInstancia: true,
  });
}
