// Test fixtures for the procesos domain (used by unit and integration tests).
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

export function proceso(idProceso: string, overrides: Partial<Proceso> = {}): Proceso {
  return {
    idProceso,
    radicado: '11001310300120190012300',
    despacho: 'JUZGADO 001 CIVIL DEL CIRCUITO',
    sujetosTexto: 'Demandante: A | Demandado: B',
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
