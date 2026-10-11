import { describe, expect, it } from 'vitest';
import { filtrarProcesos, responsablesDe } from './filtros';
import type { ProcesoResumen } from './modelo';

function proceso(parcial: Partial<ProcesoResumen> & Pick<ProcesoResumen, 'idProceso'>): ProcesoResumen {
  return {
    radicado: '11001310300120240001200',
    alias: '',
    despacho: null,
    claseProceso: null,
    sujetos: null,
    ultimaActuacion: null,
    ultimoAuto: null,
    noVistas: 0,
    nuevaInstancia: false,
    proximaTarea: null,
    tareasVencidas: 0,
    responsable: '',
    etiquetas: [],
    ultimaConsulta: null,
    agregadoPor: '',
    error: null,
    ...parcial,
  };
}

const procesos = [
  proceso({ idProceso: '1', alias: 'Pérez vs. Aseguradora', despacho: 'Juzgado 3 Civil', responsable: 'Ana', etiquetas: ['urgente'] }),
  proceso({ idProceso: '2', radicado: '05001310500220240099900', sujetos: 'Gómez, Luis', noVistas: 2, responsable: 'Beto' }),
  proceso({ idProceso: '3', alias: 'Sin dueño', nuevaInstancia: true }),
];

const sinFiltro = { texto: '', responsable: '', soloNuevas: false };

describe('filtrarProcesos', () => {
  it('busca por radicado, alias, parte, despacho, responsable y etiqueta sin distinguir mayúsculas', () => {
    expect(filtrarProcesos(procesos, { ...sinFiltro, texto: '0500131' }).map((p) => p.idProceso)).toEqual(['2']);
    expect(filtrarProcesos(procesos, { ...sinFiltro, texto: 'PÉREZ' }).map((p) => p.idProceso)).toEqual(['1']);
    expect(filtrarProcesos(procesos, { ...sinFiltro, texto: 'gómez' }).map((p) => p.idProceso)).toEqual(['2']);
    expect(filtrarProcesos(procesos, { ...sinFiltro, texto: 'civil' }).map((p) => p.idProceso)).toEqual(['1']);
    expect(filtrarProcesos(procesos, { ...sinFiltro, texto: 'beto' }).map((p) => p.idProceso)).toEqual(['2']);
    expect(filtrarProcesos(procesos, { ...sinFiltro, texto: 'urgente' }).map((p) => p.idProceso)).toEqual(['1']);
  });

  it('con "Solo con novedades" deja los procesos con actuaciones sin revisar o nueva instancia', () => {
    const resultado = filtrarProcesos(procesos, { ...sinFiltro, soloNuevas: true });
    expect(resultado.map((p) => p.idProceso)).toEqual(['2', '3']);
  });

  it('filtra por responsable y por "__sin" para los procesos sin responsable', () => {
    expect(filtrarProcesos(procesos, { ...sinFiltro, responsable: 'Ana' }).map((p) => p.idProceso)).toEqual(['1']);
    expect(filtrarProcesos(procesos, { ...sinFiltro, responsable: '__sin' }).map((p) => p.idProceso)).toEqual(['3']);
  });
});

describe('responsablesDe', () => {
  it('devuelve los responsables únicos y ordenados, sin vacíos', () => {
    expect(responsablesDe(procesos)).toEqual(['Ana', 'Beto']);
  });
});
