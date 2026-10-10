import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, type EntityManager } from 'typeorm';
import type {
  Nota,
  Proceso,
  ProcesoCpnuState,
  ProcesoOfficeChanges,
  ProcesoRef,
  Tarea,
  TareaChanges,
} from '../../domain/proceso.js';
import type { ProcesoRepository } from '../../domain/proceso.repository.js';
import { ActuacionEntity, NotaEntity, ProcesoEntity, SujetoEntity, TareaEntity } from './entities/index.js';
import {
  toActuacionEntities,
  toCpnuState,
  toNotaEntity,
  toProceso,
  toProcesoEntity,
  toSujetoEntities,
  toTareaEntity,
} from './proceso.mapper.js';

const CHUNK = 500;

function groupBy<T extends { idProceso: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.idProceso);
    if (list) list.push(row);
    else map.set(row.idProceso, [row]);
  }
  return map;
}

const sameIds = (a: number[], b: number[]) => a.length === b.length && new Set([...a, ...b]).size === a.length;

@Injectable()
export class TypeOrmProcesoRepository implements ProcesoRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAll(): Promise<Proceso[]> {
    const m = this.dataSource.manager;
    // One query per table (no N+1); children are grouped in memory.
    const [procesos, actuaciones, sujetos, notas, tareas] = await Promise.all([
      m.find(ProcesoEntity, { order: { agregado: 'ASC', idProceso: 'ASC' } }),
      m.find(ActuacionEntity),
      m.find(SujetoEntity),
      m.find(NotaEntity),
      m.find(TareaEntity),
    ]);
    const byProceso = {
      actuaciones: groupBy(actuaciones),
      sujetos: groupBy(sujetos),
      notas: groupBy(notas),
      tareas: groupBy(tareas),
    };
    return procesos.map((proceso) =>
      toProceso({
        proceso,
        actuaciones: byProceso.actuaciones.get(proceso.idProceso) ?? [],
        sujetos: byProceso.sujetos.get(proceso.idProceso) ?? [],
        notas: byProceso.notas.get(proceso.idProceso) ?? [],
        tareas: byProceso.tareas.get(proceso.idProceso) ?? [],
      }),
    );
  }

  async findById(idProceso: string): Promise<Proceso | null> {
    const m = this.dataSource.manager;
    const proceso = await m.findOneBy(ProcesoEntity, { idProceso });
    if (!proceso) return null;
    const where = { idProceso };
    const [actuaciones, sujetos, notas, tareas] = await Promise.all([
      m.findBy(ActuacionEntity, where),
      m.findBy(SujetoEntity, where),
      m.findBy(NotaEntity, where),
      m.findBy(TareaEntity, where),
    ]);
    return toProceso({ proceso, actuaciones, sujetos, notas, tareas });
  }

  async listRefs(): Promise<ProcesoRef[]> {
    const rows = await this.dataSource.manager.find(ProcesoEntity, {
      select: { idProceso: true, radicado: true },
      order: { agregado: 'ASC', idProceso: 'ASC' },
    });
    return rows.map(({ idProceso, radicado }) => ({ idProceso, radicado }));
  }

  async insert(proceso: Proceso): Promise<boolean> {
    return this.dataSource.transaction(async (m) => {
      const result = await m
        .createQueryBuilder()
        .insert()
        .into(ProcesoEntity)
        .values(toProcesoEntity(proceso))
        .orIgnore()
        .returning(['id_proceso'])
        .execute();
      if (!(result.raw as unknown[]).length) return false;
      const id = proceso.idProceso;
      await this.insertChunks(m, ActuacionEntity, toActuacionEntities(id, proceso.actuaciones, proceso.noVistas));
      await this.insertChunks(m, SujetoEntity, toSujetoEntities(id, proceso.sujetos));
      // Notes are stored oldest first so the identity order matches the domain order.
      await this.insertChunks(
        m,
        NotaEntity,
        [...proceso.notas].reverse().map((n) => toNotaEntity(id, n)),
      );
      await this.insertChunks(
        m,
        TareaEntity,
        proceso.tareas.map((t) => toTareaEntity(id, t)),
      );
      return true;
    });
  }

  async delete(idProceso: string): Promise<boolean> {
    const result = await this.dataSource.manager.delete(ProcesoEntity, { idProceso });
    return Boolean(result.affected);
  }

  async updateCpnuState(
    idProceso: string,
    mutate: (current: ProcesoCpnuState) => ProcesoCpnuState,
  ): Promise<ProcesoCpnuState | null> {
    return this.dataSource.transaction(async (m) => {
      const row = await m
        .createQueryBuilder(ProcesoEntity, 'p')
        .setLock('pessimistic_write')
        .where('p.id_proceso = :idProceso', { idProceso })
        .getOne();
      if (!row) return null; // deleted meanwhile: never resurrect it

      // Sequential: queries inside a transaction share one connection.
      const actuaciones = await m.findBy(ActuacionEntity, { idProceso });
      const sujetos = await m.findBy(SujetoEntity, { idProceso });
      const current = toCpnuState(row, actuaciones, sujetos);
      const next = mutate(current);
      // Unseen ids are kept only for existing actuaciones, in CPNU order (as reads return them).
      const unseen = new Set(next.noVistas);
      const noVistas = [...new Set(next.actuaciones.filter((a) => unseen.has(a.id)).map((a) => a.id))];

      // Only CPNU-owned columns are written; office columns keep their committed values.
      await m.update(
        ProcesoEntity,
        { idProceso },
        {
          detalle: next.detalle as ProcesoEntity['detalle'],
          error: next.error,
          ultimaConsulta: next.ultimaConsulta ? new Date(next.ultimaConsulta) : null,
        },
      );
      if (next.actuaciones !== current.actuaciones) {
        await m.delete(ActuacionEntity, { idProceso });
        await this.insertChunks(m, ActuacionEntity, toActuacionEntities(idProceso, next.actuaciones, noVistas));
      } else if (!sameIds(noVistas, current.noVistas)) {
        await m.update(ActuacionEntity, { idProceso }, { noVista: false });
        if (noVistas.length) await m.update(ActuacionEntity, { idProceso, id: In(noVistas) }, { noVista: true });
      }
      if (next.sujetos !== current.sujetos) {
        await m.delete(SujetoEntity, { idProceso });
        await this.insertChunks(m, SujetoEntity, toSujetoEntities(idProceso, next.sujetos));
      }
      return { ...next, noVistas };
    });
  }

  async updateOffice(idProceso: string, changes: ProcesoOfficeChanges): Promise<boolean> {
    const values: Partial<ProcesoEntity> = {};
    if (changes.alias !== undefined) values.alias = changes.alias;
    if (changes.responsable !== undefined) values.responsable = changes.responsable;
    if (changes.etiquetas !== undefined) values.etiquetas = changes.etiquetas;
    if (!Object.keys(values).length) return this.exists(idProceso);
    const result = await this.dataSource.manager.update(ProcesoEntity, { idProceso }, values);
    return Boolean(result.affected);
  }

  async markSeen(idProceso: string): Promise<boolean> {
    return this.dataSource.transaction(async (m) => {
      const result = await m.update(ProcesoEntity, { idProceso }, { nuevaInstancia: false });
      if (!result.affected) return false;
      await m.update(ActuacionEntity, { idProceso, noVista: true }, { noVista: false });
      return true;
    });
  }

  async addNota(idProceso: string, nota: Nota): Promise<boolean> {
    if (!(await this.exists(idProceso))) return false;
    await this.dataSource.manager.insert(NotaEntity, toNotaEntity(idProceso, nota));
    return true;
  }

  async deleteNota(idProceso: string, idNota: string): Promise<boolean> {
    const result = await this.dataSource.manager.delete(NotaEntity, { idProceso, id: idNota });
    return Boolean(result.affected);
  }

  async addTarea(idProceso: string, tarea: Tarea): Promise<boolean> {
    if (!(await this.exists(idProceso))) return false;
    await this.dataSource.manager.insert(TareaEntity, toTareaEntity(idProceso, tarea));
    return true;
  }

  async updateTarea(idProceso: string, idTarea: string, changes: TareaChanges): Promise<boolean> {
    const values = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
    if (!Object.keys(values).length) {
      return this.dataSource.manager.existsBy(TareaEntity, { idProceso, id: idTarea });
    }
    const result = await this.dataSource.manager.update(TareaEntity, { idProceso, id: idTarea }, values);
    return Boolean(result.affected);
  }

  async deleteTarea(idProceso: string, idTarea: string): Promise<boolean> {
    const result = await this.dataSource.manager.delete(TareaEntity, { idProceso, id: idTarea });
    return Boolean(result.affected);
  }

  private exists(idProceso: string): Promise<boolean> {
    return this.dataSource.manager.existsBy(ProcesoEntity, { idProceso });
  }

  private async insertChunks<T extends object>(m: EntityManager, target: new () => T, rows: T[]): Promise<void> {
    for (let i = 0; i < rows.length; i += CHUNK) {
      await m.insert(target, rows.slice(i, i + CHUNK) as never);
    }
  }
}
