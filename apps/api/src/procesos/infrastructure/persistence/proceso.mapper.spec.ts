import { actuacion, nota, proceso, tarea } from '../../domain/proceso.fixtures.js';
import { ActuacionEntity, NotaEntity, ProcesoEntity, SujetoEntity, TareaEntity } from './entities/index.js';
import { bigintToNumber } from './entities/transformers.js';
import {
  toActuacionEntities,
  toNotaEntity,
  toProceso,
  toProcesoEntity,
  toSujetoEntities,
  toTareaEntity,
} from './proceso.mapper.js';

describe('proceso mapper', () => {
  const original = proceso('101', {
    detalle: { despacho: 'JUZGADO', claseProceso: 'Verbal' },
    sujetos: [
      { tipo: 'Demandante', nombre: 'A' },
      { tipo: 'Demandado', nombre: 'B' },
    ],
    actuaciones: [actuacion(30), actuacion(20), actuacion(10)],
    noVistas: [30, 20],
    ultimaConsulta: '2026-02-02T11:00:00.000Z',
    alias: 'Caso A',
    responsable: 'Luis',
    etiquetas: ['civil', 'urgente'],
    nuevaInstancia: true,
    notas: [nota('n2'), nota('n1')],
    tareas: [tarea('t1'), tarea('t2', { hecha: true, hechaPor: 'Luis' })],
  });

  /** Simulates rows read back from Postgres (identity `seq`, shuffled order). */
  function roundTrip() {
    const id = original.idProceso;
    const notas = [...original.notas].reverse().map((n, i) => Object.assign(toNotaEntity(id, n), { seq: i + 1 }));
    const tareas = original.tareas.map((t, i) => Object.assign(toTareaEntity(id, t), { seq: i + 1 }));
    return toProceso({
      proceso: toProcesoEntity(original),
      actuaciones: toActuacionEntities(id, original.actuaciones, original.noVistas).reverse(),
      sujetos: toSujetoEntities(id, original.sujetos).reverse(),
      notas: notas.reverse(),
      tareas: tareas.reverse(),
    });
  }

  it('round-trips a proceso through entities without losing data or order', () => {
    expect(roundTrip()).toEqual(original);
  });

  it('stores unseen actuaciones as flags and keeps CPNU order', () => {
    const rows = toActuacionEntities('101', original.actuaciones, [10]);
    expect(rows.map((r) => [r.id, r.orden, r.noVista])).toEqual([
      [30, 0, false],
      [20, 1, false],
      [10, 2, true],
    ]);
  });

  it('keeps the first occurrence of a repeated CPNU actuación id', () => {
    const rows = toActuacionEntities(
      '101',
      [actuacion(5, { actuacion: 'first' }), actuacion(5, { actuacion: 'dup' })],
      [],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actuacion: 'first', orden: 0 });
  });

  it('maps null etiquetas/detalle defensively', () => {
    const row = Object.assign(toProcesoEntity(original), { etiquetas: null, detalle: null });
    const result = toProceso({
      proceso: row as unknown as ProcesoEntity,
      actuaciones: [],
      sujetos: [],
      notas: [],
      tareas: [],
    });
    expect(result.etiquetas).toEqual([]);
    expect(result.detalle).toEqual({});
    expect(result.noVistas).toEqual([]);
  });

  it('converts pg bigint strings to numbers', () => {
    expect(bigintToNumber.from('123456789012')).toBe(123456789012);
    expect(bigintToNumber.from(null)).toBeNull();
  });

  it('builds entity instances of the right classes', () => {
    expect(toProcesoEntity(original)).toBeInstanceOf(ProcesoEntity);
    expect(toActuacionEntities('1', [actuacion(1)], [])[0]).toBeInstanceOf(ActuacionEntity);
    expect(toSujetoEntities('1', [{ tipo: null, nombre: null }])[0]).toBeInstanceOf(SujetoEntity);
    expect(toNotaEntity('1', nota('n'))).toBeInstanceOf(NotaEntity);
    expect(toTareaEntity('1', tarea('t'))).toBeInstanceOf(TareaEntity);
  });
});
