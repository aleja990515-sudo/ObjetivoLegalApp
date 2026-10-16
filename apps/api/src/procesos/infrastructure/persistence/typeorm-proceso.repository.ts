import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, type EntityManager, type FindOptionsWhere } from 'typeorm';
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
  ormDesdeIso,
} from './proceso.mapper.js';

const CHUNK = 500;

function groupBy<T extends { procesoId: string }>(rows: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const list = map.get(row.procesoId);
    if (list) list.push(row);
    else map.set(row.procesoId, [row]);
  }
  return map;
}

const sameIds = (a: number[], b: number[]) => a.length === b.length && new Set([...a, ...b]).size === a.length;

@Injectable()
export class TypeOrmProcesoRepository implements ProcesoRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async findAll(usuarioId: string): Promise<Proceso[]> {
    const m = this.dataSource.manager;
    // One query per table (no N+1); children are grouped in memory.
    const procesos = await m.find(ProcesoEntity, {
      where: { usuarioId },
      order: { agregado: 'ASC', idProceso: 'ASC' },
    });
    const ids = procesos.map((p) => p.id);
    if (!ids.length) return [];
    const [actuaciones, sujetos, notas, tareas] = await Promise.all([
      m.find(ActuacionEntity, { where: { procesoId: In(ids) } }),
      m.find(SujetoEntity, { where: { procesoId: In(ids) } }),
      m.find(NotaEntity, { where: { procesoId: In(ids) } }),
      m.find(TareaEntity, { where: { procesoId: In(ids) } }),
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
        actuaciones: byProceso.actuaciones.get(proceso.id) ?? [],
        sujetos: byProceso.sujetos.get(proceso.id) ?? [],
        notas: byProceso.notas.get(proceso.id) ?? [],
        tareas: byProceso.tareas.get(proceso.id) ?? [],
      }),
    );
  }

  async findById(idProceso: string, usuarioId: string): Promise<Proceso | null> {
    return this.leer({ idProceso, usuarioId });
  }

  async findByIdForReview(id: string): Promise<Proceso | null> {
    return this.leer({ id });
  }

  async listRefs(usuarioId: string): Promise<ProcesoRef[]> {
    return this.refs({ usuarioId });
  }

  async listRefsForReview(): Promise<ProcesoRef[]> {
    return this.refs({});
  }

  private async leer(where: FindOptionsWhere<ProcesoEntity>): Promise<Proceso | null> {
    const m = this.dataSource.manager;
    const proceso = await m.findOneBy(ProcesoEntity, where);
    if (!proceso) return null;
    const hijos = { procesoId: proceso.id };
    const [actuaciones, sujetos, notas, tareas] = await Promise.all([
      m.findBy(ActuacionEntity, hijos),
      m.findBy(SujetoEntity, hijos),
      m.findBy(NotaEntity, hijos),
      m.findBy(TareaEntity, hijos),
    ]);
    return toProceso({ proceso, actuaciones, sujetos, notas, tareas });
  }

  private async refs(where: FindOptionsWhere<ProcesoEntity>): Promise<ProcesoRef[]> {
    const rows = await this.dataSource.manager.find(ProcesoEntity, {
      where,
      select: { id: true, idProceso: true, radicado: true },
      order: { agregado: 'ASC', idProceso: 'ASC' },
    });
    return rows.map(({ id, idProceso, radicado }) => ({ id, idProceso, radicado }));
  }

  async listPrivados(): Promise<ProcesoRef[]> {
    const rows = await this.dataSource.manager.find(ProcesoEntity, {
      select: { id: true, idProceso: true, radicado: true },
      where: { esPrivado: true },
      order: { agregado: 'ASC', idProceso: 'ASC', id: 'ASC' },
    });
    return rows.map(({ id, idProceso, radicado }) => ({ id, idProceso, radicado }));
  }

  async insert(proceso: Proceso): Promise<boolean> {
    return this.dataSource.transaction(async (m) => {
      // The only conflict left is `(usuario_id, id_proceso)`: the same user following
      // the same expediente twice. An unowned row never conflicts, because a unique
      // index treats its NULL owner as distinct from every other NULL.
      const result = await m
        .createQueryBuilder()
        .insert()
        .into(ProcesoEntity)
        .values(toProcesoEntity(proceso))
        .orIgnore()
        .returning(['id'])
        .execute();
      const [row] = (result.raw ?? []) as { id: string }[];
      if (!row?.id) return false; // the owner already follows it
      const { id } = row;
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

  async delete(id: string): Promise<boolean> {
    const result = await this.dataSource.manager.delete(ProcesoEntity, { id });
    return Boolean(result.affected);
  }

  async updateCpnuState(
    id: string,
    mutate: (current: ProcesoCpnuState) => ProcesoCpnuState,
  ): Promise<ProcesoCpnuState | null> {
    return this.dataSource.transaction(async (m) => {
      const row = await m
        .createQueryBuilder(ProcesoEntity, 'p')
        .setLock('pessimistic_write')
        .where('p.id = :id', { id })
        .getOne();
      if (!row) return null; // deleted meanwhile: never resurrect it

      // Sequential: queries inside a transaction share one connection.
      const actuaciones = await m.findBy(ActuacionEntity, { procesoId: id });
      const sujetos = await m.findBy(SujetoEntity, { procesoId: id });
      const current = toCpnuState(row, actuaciones, sujetos);
      const next = mutate(current);
      // Unseen ids are kept only for existing actuaciones, in CPNU order (as reads return them).
      const unseen = new Set(next.noVistas);
      const noVistas = [...new Set(next.actuaciones.filter((a) => unseen.has(a.id)).map((a) => a.id))];

      // Only CPNU-owned columns are written; office columns keep their committed values.
      await m.update(
        ProcesoEntity,
        { id },
        {
          detalle: next.detalle as ProcesoEntity['detalle'],
          error: next.error,
          ultimaConsulta: next.ultimaConsulta ? ormDesdeIso(next.ultimaConsulta) : null,
        },
      );
      if (next.actuaciones !== current.actuaciones) {
        await m.delete(ActuacionEntity, { procesoId: id });
        await this.insertChunks(m, ActuacionEntity, toActuacionEntities(id, next.actuaciones, noVistas));
      } else if (!sameIds(noVistas, current.noVistas)) {
        await m.update(ActuacionEntity, { procesoId: id }, { noVista: false });
        if (noVistas.length) await m.update(ActuacionEntity, { procesoId: id, id: In(noVistas) }, { noVista: true });
      }
      if (next.sujetos !== current.sujetos) {
        await m.delete(SujetoEntity, { procesoId: id });
        await this.insertChunks(m, SujetoEntity, toSujetoEntities(id, next.sujetos));
      }
      return { ...next, noVistas };
    });
  }

  async updateOffice(id: string, changes: ProcesoOfficeChanges): Promise<boolean> {
    const values: Partial<ProcesoEntity> = {};
    if (changes.alias !== undefined) values.alias = changes.alias;
    if (changes.responsable !== undefined) values.responsable = changes.responsable;
    if (changes.etiquetas !== undefined) values.etiquetas = changes.etiquetas;
    if (!Object.keys(values).length) return this.exists(id);
    const result = await this.dataSource.manager.update(ProcesoEntity, { id }, values);
    return Boolean(result.affected);
  }

  async markSeen(id: string): Promise<boolean> {
    return this.dataSource.transaction(async (m) => {
      const result = await m.update(ProcesoEntity, { id }, { nuevaInstancia: false });
      if (!result.affected) return false;
      await m.update(ActuacionEntity, { procesoId: id, noVista: true }, { noVista: false });
      return true;
    });
  }

  async addNota(id: string, nota: Nota): Promise<boolean> {
    if (!(await this.exists(id))) return false;
    await this.dataSource.manager.insert(NotaEntity, toNotaEntity(id, nota));
    return true;
  }

  async deleteNota(id: string, idNota: string): Promise<boolean> {
    const result = await this.dataSource.manager.delete(NotaEntity, { procesoId: id, id: idNota });
    return Boolean(result.affected);
  }

  async addTarea(id: string, tarea: Tarea): Promise<boolean> {
    if (!(await this.exists(id))) return false;
    await this.dataSource.manager.insert(TareaEntity, toTareaEntity(id, tarea));
    return true;
  }

  async updateTarea(id: string, idTarea: string, changes: TareaChanges): Promise<boolean> {
    const values = Object.fromEntries(Object.entries(changes).filter(([, v]) => v !== undefined));
    if (!Object.keys(values).length) {
      return this.dataSource.manager.existsBy(TareaEntity, { procesoId: id, id: idTarea });
    }
    const result = await this.dataSource.manager.update(TareaEntity, { procesoId: id, id: idTarea }, values);
    return Boolean(result.affected);
  }

  async deleteTarea(id: string, idTarea: string): Promise<boolean> {
    const result = await this.dataSource.manager.delete(TareaEntity, { procesoId: id, id: idTarea });
    return Boolean(result.affected);
  }

  private exists(id: string): Promise<boolean> {
    return this.dataSource.manager.existsBy(ProcesoEntity, { id });
  }

  private async insertChunks<T extends object>(m: EntityManager, target: new () => T, rows: T[]): Promise<void> {
    for (let i = 0; i < rows.length; i += CHUNK) {
      await m.insert(target, rows.slice(i, i + CHUNK) as never);
    }
  }
}
