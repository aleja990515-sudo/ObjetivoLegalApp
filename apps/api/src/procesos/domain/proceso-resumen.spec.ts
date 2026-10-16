import { actuacion, estadoProceso, nota, proceso, tarea } from '../testing/proceso.fixtures.js';
import {
  compararNovedades,
  compararProcesos,
  detalleCompleto,
  novedades,
  pendientes,
  resumen,
  type ProcesoResumen,
} from './proceso-resumen.js';

const HOY = '2026-03-10';

describe('proceso-resumen (legacy resumen/detalleCompleto)', () => {
  it('builds the list summary with the legacy field names', () => {
    const p = proceso('1', {
      alias: 'Caso',
      detalle: { despacho: 'JUZGADO DETALLE', claseProceso: 'Ordinario' },
      actuaciones: [actuacion(2, { actuacion: 'Auto admite demanda' }), actuacion(1)],
      noVistas: [2],
      nuevaInstancia: true,
      responsable: 'Luz',
      etiquetas: ['civil'],
      error: 'La Rama Judicial respondió 503',
    });

    expect(resumen(p, HOY)).toEqual({
      idProceso: '1',
      radicado: '11001310300120190012300',
      alias: 'Caso',
      despacho: 'JUZGADO DETALLE',
      claseProceso: 'Ordinario',
      sujetos: 'Demandante: A | Demandado: B',
      esPrivado: false,
      ultimaActuacion: actuacion(2, { actuacion: 'Auto admite demanda' }),
      ultimoAuto: actuacion(2, { actuacion: 'Auto admite demanda' }),
      noVistas: 1,
      estadosNoVistos: 0,
      nuevaInstancia: true,
      proximaTarea: null,
      tareasVencidas: 0,
      responsable: 'Luz',
      etiquetas: ['civil'],
      ultimaConsulta: null,
      agregadoPor: 'Ana',
      error: 'La Rama Judicial respondió 503',
    });
  });

  it('falls back to the search court name and ultimaActuacion null when there are no actuaciones', () => {
    const p = proceso('1', { detalle: {}, despacho: 'JUZGADO BÚSQUEDA' });
    expect(resumen(p, HOY)).toMatchObject({ despacho: 'JUZGADO BÚSQUEDA', ultimaActuacion: null, ultimoAuto: null });
  });

  it('summarizes an unhydrated private proceso without throwing', () => {
    const p = proceso('7', { esPrivado: true, sujetosTexto: null, despacho: 'JUZGADO 003', detalle: {} });
    expect(resumen(p, HOY)).toEqual({
      idProceso: '7',
      radicado: '11001310300120190012300',
      alias: '',
      despacho: 'JUZGADO 003',
      claseProceso: undefined,
      sujetos: null,
      esPrivado: true,
      ultimaActuacion: null,
      ultimoAuto: null,
      noVistas: 0,
      estadosNoVistos: 0,
      nuevaInstancia: false,
      proximaTarea: null,
      tareasVencidas: 0,
      responsable: '',
      etiquetas: [],
      ultimaConsulta: null,
      agregadoPor: 'Ana',
      error: null,
    });
    expect(detalleCompleto(p, HOY)).toMatchObject({
      detalle: {},
      sujetos: [],
      actuaciones: [],
      noVistasIds: [],
      estados: [],
      notas: [],
      tareas: [],
    });
  });

  it('picks the next pending task (date then time) and counts overdue ones', () => {
    const p = proceso('1', {
      tareas: [
        tarea('a', { fecha: '2026-03-12', hora: '08:00' }),
        tarea('b', { fecha: '2026-03-09' }),
        tarea('c', { fecha: '2026-03-12', hora: '07:00' }),
        tarea('d', { fecha: '2026-03-01', hecha: true }),
      ],
    });
    const r = resumen(p, HOY);
    expect(r.proximaTarea).toMatchObject({ id: 'b' });
    expect(r.tareasVencidas).toBe(1);
    expect(pendientes(p).map((t) => t.id)).toEqual(['b', 'c', 'a']);
  });

  it('detects providencias (auto, sentencia, fallo, providencia, decisión) for ultimoAuto', () => {
    const p = proceso('1', {
      actuaciones: [actuacion(3, { actuacion: 'Traslado' }), actuacion(2, { actuacion: '  Decisión de fondo' })],
    });
    expect(resumen(p, HOY).ultimoAuto).toMatchObject({ id: 2 });
  });

  it('detalleCompleto adds the detail, parties, every actuación, noVistasIds, notas and tareas', () => {
    const p = proceso('1', {
      detalle: { despacho: 'J' },
      sujetos: [{ tipo: 'Demandante', nombre: 'A' }],
      actuaciones: [actuacion(1)],
      noVistas: [1],
      notas: [nota('n2'), nota('n1')],
      tareas: [tarea('t1')],
    });
    expect(detalleCompleto(p, HOY)).toMatchObject({
      idProceso: '1',
      detalle: { despacho: 'J' },
      sujetos: [{ tipo: 'Demandante', nombre: 'A' }],
      actuaciones: [actuacion(1)],
      noVistasIds: [1],
      notas: [nota('n2'), nota('n1')],
      tareas: [tarea('t1')],
    });
  });

  describe('compararProcesos', () => {
    const conProceso = (id: string, over: Parameters<typeof proceso>[1] = {}): ProcesoResumen =>
      resumen(proceso(id, over), HOY);

    it('puts unseen actuaciones and new instances first, then the most recent actuación, then missing dates last', () => {
      const sinFecha = conProceso('sin');
      const reciente = conProceso('nuevo', { actuaciones: [actuacion(9, { fecha: '2026-03-01' })] });
      const antiguo = conProceso('viejo', { actuaciones: [actuacion(8, { fecha: '2026-01-01' })] });
      const novedad = conProceso('novedad', { actuaciones: [actuacion(1), actuacion(2)], noVistas: [1, 2] });
      const instancia = conProceso('instancia', { nuevaInstancia: true });

      const orden = [sinFecha, antiguo, novedad, reciente, instancia].sort(compararProcesos).map((p) => p.idProceso);
      expect(orden).toEqual(['novedad', 'instancia', 'nuevo', 'viejo', 'sin']);
    });

    it('breaks remaining ties by idProceso so the order is deterministic', () => {
      const b = conProceso('b');
      const a = conProceso('a');
      expect([b, a].sort(compararProcesos).map((p) => p.idProceso)).toEqual(['a', 'b']);
    });

    it('treats an unseen estado detection as an alert', () => {
      const sin = conProceso('sin');
      const conDeteccion = { ...conProceso('det'), estadosNoVistos: 1 };
      expect([sin, conDeteccion].sort(compararProcesos).map((p) => p.idProceso)).toEqual(['det', 'sin']);
    });
  });

  it('counts the unseen estado detections in the summary, zero by default', () => {
    const p = proceso('7', { esPrivado: true, sujetosTexto: null, actuaciones: [], noVistas: [] });
    expect(resumen(p, HOY).estadosNoVistos).toBe(0);
    expect(resumen(p, HOY, 2)).toMatchObject({ estadosNoVistos: 2, noVistas: 0 });

    const detalle = detalleCompleto(p, HOY, [
      estadoProceso({ idProceso: '7' }),
      estadoProceso({ idProceso: '7', urlEstado: 'https://portal.test/?articleId=170', visto: true }),
    ]);
    expect(detalle).toMatchObject({ estadosNoVistos: 1, estados: [expect.anything(), expect.anything()] });
  });

  describe('novedades', () => {
    it('lists an unseen estado detection of a proceso without actuaciones', () => {
      const deteccion = estadoProceso({ idProceso: '7', fechaPublicacion: '2026-10-14' });
      const items = novedades([proceso('7', { esPrivado: true })], [deteccion]);

      expect(items).toEqual([
        expect.objectContaining({
          tipo: 'estado',
          idProceso: '7',
          fecha: '2026-10-14',
          estado: expect.objectContaining({ numeroEstado: '174' }),
        }),
      ]);
    });

    it('mixes actuaciones, new instances and detections, newest first', () => {
      const p = proceso('1', { actuaciones: [actuacion(1, { fecha: '2026-09-01T00:00:00' })], noVistas: [1] });
      const items = novedades(
        [p, proceso('2', { nuevaInstancia: true, agregado: '2026-08-01T00:00:00.000Z' })],
        [
          estadoProceso({ idProceso: '1', fechaPublicacion: '2026-10-14' }),
          estadoProceso({ idProceso: '2', urlEstado: 'https://portal.test/?articleId=2', fechaPublicacion: null }),
        ],
      );

      expect(items.map((i) => [i.idProceso, i.tipo, i.fecha])).toEqual([
        ['1', 'estado', '2026-10-14'],
        ['1', 'actuacion', '2026-09-01T00:00:00'],
        ['2', 'instancia', '2026-08-01T00:00:00.000Z'],
        ['2', 'estado', null],
      ]);
    });

    it('ignores the detections of a proceso that is no longer followed', () => {
      expect(novedades([], [estadoProceso({ idProceso: '7' })])).toEqual([]);
    });
  });

  describe('compararNovedades', () => {
    it('sorts by date descending with missing dates last and idProceso as tie-break', () => {
      const items = [
        { idProceso: '2', fecha: null },
        { idProceso: '1', fecha: '2026-03-01' },
        { idProceso: '3', fecha: '2026-03-01' },
        { idProceso: '4', fecha: '2026-03-05' },
      ];
      expect([...items].sort(compararNovedades).map((i) => i.idProceso)).toEqual(['4', '1', '3', '2']);
    });
  });
});
