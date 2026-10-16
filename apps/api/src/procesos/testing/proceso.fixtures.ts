// Test fixtures for the procesos domain (used by unit and integration tests).
import type { EstadoProceso } from '../domain/estado-proceso.repository.js';
import type { Actuacion, Nota, Proceso, Tarea } from '../domain/proceso.js';

export function actuacion(id: number, overrides: Partial<Actuacion> = {}): Actuacion {
  return {
    id,
    cons: id,
    fecha: '2026-01-15T00:00:00',
    actuacion: `Actuación ${id}`,
    anotacion: null,
    fechaInicial: null,
    fechaFinal: null,
    fechaRegistro: '2026-01-15T00:00:00',
    conDocumentos: false,
    ...overrides,
  };
}

export function nota(id: string, overrides: Partial<Nota> = {}): Nota {
  return { id, texto: `Nota ${id}`, autor: 'Ana', fecha: '2026-02-01T10:00:00.000Z', ...overrides };
}

export function tarea(id: string, overrides: Partial<Tarea> = {}): Tarea {
  return {
    id,
    titulo: `Tarea ${id}`,
    fecha: '2026-03-10',
    hora: '',
    responsable: '',
    idActuacion: null,
    hecha: false,
    hechaPor: null,
    autor: 'Ana',
    creada: '2026-02-01T10:00:00.000Z',
    ...overrides,
  };
}

/** One estado of a despacho in which a caso was found. */
export function estadoProceso(overrides: Partial<EstadoProceso> = {}): EstadoProceso {
  return {
    idProceso: '1',
    urlEstado: 'https://portal.test/web/publicaciones-procesales/inicio?articleId=174',
    numeroEstado: '174',
    fechaPublicacion: '2026-10-14',
    radicadoEncontrado: '11001310300120190012300',
    visto: false,
    detectadoEn: '2026-10-15T12:00:00.000Z',
    ...overrides,
  };
}

export function proceso(idProceso: string, overrides: Partial<Proceso> = {}): Proceso {
  return {
    idProceso,
    radicado: '11001310300120190012300',
    despacho: 'JUZGADO 001 CIVIL DEL CIRCUITO',
    sujetosTexto: 'Demandante: A | Demandado: B',
    esPrivado: false,
    detalle: {},
    sujetos: [],
    actuaciones: [],
    noVistas: [],
    ultimaConsulta: null,
    error: null,
    alias: '',
    responsable: '',
    etiquetas: [],
    nuevaInstancia: false,
    notas: [],
    tareas: [],
    agregadoPor: 'Ana',
    agregado: '2026-01-01T12:00:00.000Z',
    ...overrides,
  };
}
