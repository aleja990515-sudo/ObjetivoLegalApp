import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, In, QueryFailedError } from 'typeorm';
import { isoMs } from '../../../common/time/temporal.js';
import type { EstadoProceso, EstadoProcesoRepository } from '../../domain/estado-proceso.repository.js';
import { EstadosProcesoEntity } from './entities/index.js';

const FOREIGN_KEY_VIOLATION = '23503';

@Injectable()
export class TypeOrmEstadoProcesoRepository implements EstadoProcesoRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async guardar(estado: EstadoProceso): Promise<boolean> {
    try {
      // `orIgnore` (ON CONFLICT DO NOTHING) keeps the committed row, so a second
      // sweep never resets `visto`. It does not swallow a foreign key violation.
      await this.dataSource.manager
        .createQueryBuilder()
        .insert()
        .into(EstadosProcesoEntity)
        .values(toEntity(estado))
        .orIgnore()
        .execute();
      return true;
    } catch (error) {
      // The proceso was deleted while the estado was read.
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string })?.code === FOREIGN_KEY_VIOLATION
      ) {
        return false;
      }
      throw error;
    }
  }

  async listarPorProceso(procesoId: string): Promise<EstadoProceso[]> {
    const rows = await this.dataSource.manager.find(EstadosProcesoEntity, {
      where: { procesoId },
      order: { fechaPublicacion: { direction: 'DESC', nulls: 'LAST' }, urlEstado: 'ASC' },
    });
    return rows.map(toDomain);
  }

  async listarNoVistos(procesoIds: string[]): Promise<EstadoProceso[]> {
    if (!procesoIds.length) return [];
    const rows = await this.dataSource.manager.find(EstadosProcesoEntity, {
      where: { procesoId: In(procesoIds), visto: false },
      order: { fechaPublicacion: { direction: 'DESC', nulls: 'LAST' }, urlEstado: 'ASC' },
    });
    return rows.map(toDomain);
  }

  async contarNoVistos(): Promise<Map<string, number>> {
    const filas = await this.dataSource.manager
      .createQueryBuilder(EstadosProcesoEntity, 'estado')
      .select('estado.procesoId', 'procesoId')
      .addSelect('COUNT(*)', 'total')
      .where('estado.visto = false')
      .groupBy('estado.procesoId')
      .getRawMany<{ procesoId: string; total: string }>();
    return new Map(filas.map((fila) => [fila.procesoId, Number(fila.total)]));
  }

  async marcarVistos(procesoId: string): Promise<void> {
    await this.dataSource.manager.update(EstadosProcesoEntity, { procesoId, visto: false }, { visto: true });
  }
}

function toDomain(row: EstadosProcesoEntity): EstadoProceso {
  return {
    procesoId: row.procesoId,
    urlEstado: row.urlEstado,
    numeroEstado: row.numeroEstado,
    fechaPublicacion: row.fechaPublicacion,
    radicadoEncontrado: row.radicadoEncontrado,
    visto: row.visto,
    detectadoEn: isoMs(Temporal.Instant.fromEpochMilliseconds(row.detectadoEn.getTime())),
  };
}

function toEntity(estado: EstadoProceso): EstadosProcesoEntity {
  const row = new EstadosProcesoEntity();
  row.procesoId = estado.procesoId;
  row.urlEstado = estado.urlEstado;
  row.numeroEstado = estado.numeroEstado;
  row.fechaPublicacion = estado.fechaPublicacion;
  row.radicadoEncontrado = estado.radicadoEncontrado;
  row.visto = estado.visto;
  row.detectadoEn = new Date(Temporal.Instant.from(estado.detectadoEn).epochMilliseconds);
  return row;
}
