// Test fixtures for the procesos domain (used by unit and integration tests).
import { randomUUID } from 'node:crypto';
import type { Actuacion, Nota, Proceso, Tarea } from '../domain/proceso.js';

/** Owner of the fixture procesos, and the session the specs act as. */
export const USUARIO = { id: '3f2a8c10-4d5e-4a6b-8c9d-0e1f2a3b4c5d', nombre: 'Ana' };

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

/**
 * `id` is the surrogate key and is fresh on every call, exactly like the one
 * `newProceso` mints: two fixtures may share an `idProceso` to stand for two users
 * following the same expediente. Override it when the spec has to address the row.
 */
export function proceso(idProceso: string, overrides: Partial<Proceso> = {}): Proceso {
  return {
    id: randomUUID(),
    idProceso,
    radicado: '11001310300120190012300',
    usuarioId: USUARIO.id,
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
