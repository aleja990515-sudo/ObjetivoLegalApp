import type { Actuacion, Nota, Proceso, ProcesoCpnuState, Sujeto, Tarea } from '../../domain/proceso.js';
import { isoMs } from '../../../common/time/temporal.js';
import { ActuacionEntity, NotaEntity, ProcesoEntity, SujetoEntity, TareaEntity } from './entities/index.js';

export interface ProcesoRows {
  proceso: ProcesoEntity;
  actuaciones: ActuacionEntity[];
  sujetos: SujetoEntity[];
  notas: NotaEntity[];
  tareas: TareaEntity[];
}

/**
 * ORM boundary: TypeORM columns stay `Date`, while domain and API carry ISO
 * strings (`YYYY-MM-DDTHH:mm:ss.sssZ`). These two functions are the only conversion.
 */
export const isoDesdeOrm = (date: Date): string => isoMs(Temporal.Instant.fromEpochMilliseconds(date.getTime()));
export const ormDesdeIso = (iso: string): Date => new Date(Temporal.Instant.from(iso).epochMilliseconds);

const iso = (date: Date | null): string | null => (date ? isoDesdeOrm(date) : null);
const byOrden = (a: { orden: number }, b: { orden: number }) => a.orden - b.orden;

export function toActuacion(row: ActuacionEntity): Actuacion {
  return {
    id: row.id,
    cons: row.cons,
    fecha: row.fecha,
    actuacion: row.actuacion,
    anotacion: row.anotacion,
    fechaInicial: row.fechaInicial,
    fechaFinal: row.fechaFinal,
    fechaRegistro: row.fechaRegistro,
    conDocumentos: row.conDocumentos,
  };
}

export function toNota(row: NotaEntity): Nota {
  return { id: row.id, texto: row.texto, autor: row.autor, fecha: isoDesdeOrm(row.fecha) };
}

export function toTarea(row: TareaEntity): Tarea {
  return {
    id: row.id,
    titulo: row.titulo,
    fecha: row.fecha,
    hora: row.hora,
    responsable: row.responsable,
    idActuacion: row.idActuacion,
    hecha: row.hecha,
    hechaPor: row.hechaPor,
    autor: row.autor,
    creada: isoDesdeOrm(row.creada),
  };
}

/** CPNU-owned part of a proceso, from its row and child rows. */
export function toCpnuState(
  proceso: ProcesoEntity,
  actuaciones: ActuacionEntity[],
  sujetos: SujetoEntity[],
): ProcesoCpnuState {
  const ordered = [...actuaciones].sort(byOrden);
  return {
    detalle: proceso.detalle ?? {},
    sujetos: [...sujetos].sort(byOrden).map((s): Sujeto => ({ tipo: s.tipo, nombre: s.nombre })),
    actuaciones: ordered.map(toActuacion),
    noVistas: ordered.filter((a) => a.noVista).map((a) => a.id),
    ultimaConsulta: iso(proceso.ultimaConsulta),
    error: proceso.error,
  };
}

export function toProceso({ proceso, actuaciones, sujetos, notas, tareas }: ProcesoRows): Proceso {
  return {
    idProceso: proceso.idProceso,
    radicado: proceso.radicado,
    despacho: proceso.despacho,
    sujetosTexto: proceso.sujetosTexto,
    ...toCpnuState(proceso, actuaciones, sujetos),
    alias: proceso.alias,
    responsable: proceso.responsable,
    etiquetas: proceso.etiquetas ?? [],
    nuevaInstancia: proceso.nuevaInstancia,
    // Newest note first (legacy `unshift`), tasks in creation order (legacy `push`).
    notas: [...notas].sort((a, b) => b.seq - a.seq).map(toNota),
    tareas: [...tareas].sort((a, b) => a.seq - b.seq).map(toTarea),
    agregadoPor: proceso.agregadoPor,
    agregado: isoDesdeOrm(proceso.agregado),
  };
}

export function toProcesoEntity(p: Proceso): ProcesoEntity {
  return Object.assign(new ProcesoEntity(), {
    idProceso: p.idProceso,
    radicado: p.radicado,
    despacho: p.despacho,
    sujetosTexto: p.sujetosTexto,
    detalle: p.detalle,
    error: p.error,
    ultimaConsulta: p.ultimaConsulta ? ormDesdeIso(p.ultimaConsulta) : null,
    alias: p.alias,
    responsable: p.responsable,
    etiquetas: p.etiquetas,
    nuevaInstancia: p.nuevaInstancia,
    agregadoPor: p.agregadoPor,
    agregado: ormDesdeIso(p.agregado),
  });
}

/**
 * Child rows for the actuaciones, keeping CPNU order. A repeated CPNU id keeps
 * its first occurrence (the table key is `(id_proceso, id)`).
 */
export function toActuacionEntities(
  idProceso: string,
  actuaciones: Actuacion[],
  noVistas: number[],
): ActuacionEntity[] {
  const unseen = new Set(noVistas);
  const seen = new Set<number>();
  const rows: ActuacionEntity[] = [];
  for (const a of actuaciones) {
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    rows.push(
      Object.assign(new ActuacionEntity(), {
        idProceso,
        id: a.id,
        orden: rows.length,
        cons: a.cons,
        fecha: a.fecha,
        actuacion: a.actuacion,
        anotacion: a.anotacion,
        fechaInicial: a.fechaInicial,
        fechaFinal: a.fechaFinal,
        fechaRegistro: a.fechaRegistro,
        conDocumentos: a.conDocumentos,
        noVista: unseen.has(a.id),
      }),
    );
  }
  return rows;
}

export function toSujetoEntities(idProceso: string, sujetos: Sujeto[]): SujetoEntity[] {
  return sujetos.map((s, orden) =>
    Object.assign(new SujetoEntity(), { idProceso, orden, tipo: s.tipo, nombre: s.nombre }),
  );
}

export function toNotaEntity(idProceso: string, nota: Nota): NotaEntity {
  return Object.assign(new NotaEntity(), {
    id: nota.id,
    idProceso,
    texto: nota.texto,
    autor: nota.autor,
    fecha: ormDesdeIso(nota.fecha),
  });
}

export function toTareaEntity(idProceso: string, tarea: Tarea): TareaEntity {
  return Object.assign(new TareaEntity(), {
    id: tarea.id,
    idProceso,
    titulo: tarea.titulo,
    fecha: tarea.fecha,
    hora: tarea.hora,
    responsable: tarea.responsable,
    idActuacion: tarea.idActuacion,
    hecha: tarea.hecha,
    hechaPor: tarea.hechaPor,
    autor: tarea.autor,
    creada: ormDesdeIso(tarea.creada),
  });
}
