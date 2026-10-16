import { actuacion, proceso } from '../testing/proceso.fixtures.js';
import type { ProcesoCargado, ProcesoEncontrado } from './cpnu-data.js';
import type { ProcesoCpnuState } from './proceso.js';
import { applyRefresh, applyRefreshError, newInstance, newProceso } from './refresh.js';

const NOW = '2026-10-10T11:00:00.000Z';

function state(overrides: Partial<ProcesoCpnuState> = {}): ProcesoCpnuState {
  return {
    detalle: { despacho: 'JUZGADO' },
    sujetos: [{ tipo: 'Demandante', nombre: 'A' }],
    actuaciones: [],
    noVistas: [],
    ultimaConsulta: null,
    error: 'error anterior',
    ...overrides,
  };
}

function loaded(overrides: Partial<ProcesoCargado> = {}): ProcesoCargado {
  return {
    detalle: { despacho: 'JUZGADO 2' },
    sujetos: [{ tipo: 'Demandado', nombre: 'B' }],
    actuaciones: [],
    ...overrides,
  };
}

describe('applyRefresh', () => {
  it('never marks anything as new on the first load', () => {
    const { state: next, nuevas } = applyRefresh(state(), loaded({ actuaciones: [actuacion(2), actuacion(1)] }), NOW);
    expect(nuevas).toBe(0);
    expect(next.noVistas).toEqual([]);
    expect(next.actuaciones.map((a) => a.id)).toEqual([2, 1]);
  });

  it('marks actuaciones unknown to the previous list as new', () => {
    const current = state({ actuaciones: [actuacion(1)] });
    const { state: next, nuevas } = applyRefresh(
      current,
      loaded({ actuaciones: [actuacion(3), actuacion(2), actuacion(1)] }),
      NOW,
    );
    expect(nuevas).toBe(2);
    expect(next.noVistas).toEqual([3, 2]);
  });

  it('keeps previous unseen ids (union) and prunes ids no longer listed', () => {
    const current = state({ actuaciones: [actuacion(2), actuacion(1), actuacion(0)], noVistas: [2, 0] });
    const { state: next, nuevas } = applyRefresh(
      current,
      loaded({ actuaciones: [actuacion(5), actuacion(2), actuacion(1)] }),
      NOW,
    );
    expect(nuevas).toBe(1);
    expect([...next.noVistas].sort()).toEqual([2, 5]);
  });

  it('keeps previous sujetos and actuaciones when CPNU failed to return them', () => {
    const current = state({ actuaciones: [actuacion(1)], noVistas: [1] });
    const { state: next, nuevas } = applyRefresh(current, loaded({ sujetos: null, actuaciones: null }), NOW);
    expect(nuevas).toBe(0);
    expect(next.sujetos).toEqual(current.sujetos);
    expect(next.actuaciones).toEqual(current.actuaciones);
    expect(next.noVistas).toEqual([1]);
  });

  it('replaces the detail, records the consultation time and clears the error', () => {
    const { state: next } = applyRefresh(state(), loaded(), NOW);
    expect(next).toMatchObject({
      detalle: { despacho: 'JUZGADO 2' },
      sujetos: [{ tipo: 'Demandado', nombre: 'B' }],
      ultimaConsulta: NOW,
      error: null,
    });
  });

  it('does not mutate its inputs', () => {
    const current = state({ actuaciones: [actuacion(1)] });
    const snapshot = structuredClone(current);
    applyRefresh(current, loaded({ actuaciones: [actuacion(2), actuacion(1)] }), NOW);
    expect(current).toEqual(snapshot);
  });
});

describe('applyRefreshError', () => {
  it('only records the error message', () => {
    const current = state({ actuaciones: [actuacion(1)], noVistas: [1], ultimaConsulta: '2026-01-01T00:00:00.000Z' });
    expect(applyRefreshError(current, 'La Rama Judicial respondió 500')).toEqual({
      ...current,
      error: 'La Rama Judicial respondió 500',
    });
  });
});

describe('newProceso', () => {
  const found: ProcesoEncontrado = {
    idProceso: '123',
    despacho: 'JUZGADO 1',
    sujetosProcesales: 'A | B',
    esPrivado: false,
  };

  it('builds an empty proceso like the legacy nuevoProceso', () => {
    expect(newProceso(found, '11001310300120190012300', 'Ana', 'u-ana', NOW)).toEqual({
      id: expect.any(String),
      idProceso: '123',
      radicado: '11001310300120190012300',
      usuarioId: 'u-ana',
      alias: '',
      despacho: 'JUZGADO 1',
      sujetosTexto: 'A | B',
      esPrivado: false,
      detalle: {},
      sujetos: [],
      actuaciones: [],
      noVistas: [],
      notas: [],
      tareas: [],
      responsable: '',
      etiquetas: [],
      nuevaInstancia: false,
      agregadoPor: 'Ana',
      agregado: NOW,
      ultimaConsulta: null,
      error: null,
    });
  });

  it('applies extra fields', () => {
    expect(newProceso(found, 'r', 'Ana', 'u-ana', NOW, { alias: 'Caso' }).alias).toBe('Caso');
  });

  it('mints a different surrogate for every copy of the same expediente', () => {
    const uno = newProceso(found, '11001310300120190012300', 'Ana', 'u-ana', NOW);
    const otro = newProceso(found, '11001310300120190012300', 'Beto', 'u-beto', NOW);
    expect(uno.idProceso).toBe(otro.idProceso);
    expect(uno.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    expect(uno.id).not.toBe(otro.id);
  });

  it('carries esPrivado and drops CPNU placeholder parties for a private proceso', () => {
    const privado = newProceso(
      { ...found, esPrivado: true, sujetosProcesales: '--- [ PROCESO PRIVADO ] ---' },
      'r',
      'Ana',
      null,
      NOW,
    );
    expect(privado).toMatchObject({ esPrivado: true, sujetosTexto: null, despacho: 'JUZGADO 1' });
  });
});

describe('newInstance', () => {
  const found: ProcesoEncontrado = {
    idProceso: '900',
    despacho: 'TRIBUNAL',
    sujetosProcesales: null,
    esPrivado: false,
  };

  it('inherits alias, responsable and etiquetas from the followed instance', () => {
    const base = proceso('1', { alias: 'Caso A', responsable: 'Luis', etiquetas: ['civil'] });
    expect(newInstance(found, base.radicado, base, NOW)).toMatchObject({
      idProceso: '900',
      radicado: base.radicado,
      usuarioId: base.usuarioId,
      alias: 'Caso A (nueva instancia)',
      responsable: 'Luis',
      etiquetas: ['civil'],
      nuevaInstancia: true,
      agregadoPor: 'Revisión automática',
      agregado: NOW,
    });
  });

  it('leaves the owner empty when the base has none (or there is no base)', () => {
    expect(newInstance(found, 'r', proceso('1', { usuarioId: null }), NOW).usuarioId).toBeNull();
    expect(newInstance(found, 'r', null, NOW).usuarioId).toBeNull();
  });

  it('leaves the alias empty when the base has none (or there is no base)', () => {
    expect(newInstance(found, 'r', proceso('1'), NOW).alias).toBe('');
    expect(newInstance(found, 'r', null, NOW)).toMatchObject({ alias: '', responsable: '', etiquetas: [] });
  });
});
