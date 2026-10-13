import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { isoMs } from '../../../common/time/temporal.js';
import type { AutoPublicado, AutoPublicadoRepository } from '../../domain/auto-publicado.repository.js';
import { AutoPublicadoEntity } from './entities/index.js';

const FOREIGN_KEY_VIOLATION = '23503';

@Injectable()
export class TypeOrmAutoPublicadoRepository implements AutoPublicadoRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async buscar(idProceso: string, idActuacion: number): Promise<AutoPublicado | null> {
    const row = await this.dataSource.manager.findOneBy(AutoPublicadoEntity, { idProceso, idActuacion });
    return row ? toDomain(row) : null;
  }

  async guardar(auto: AutoPublicado): Promise<boolean> {
    try {
      await this.dataSource.manager.upsert(AutoPublicadoEntity, toEntity(auto), ['idProceso', 'idActuacion']);
      return true;
    } catch (error) {
      // The proceso was deleted while the portal was searched.
      if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === FOREIGN_KEY_VIOLATION) {
        return false;
      }
      throw error;
    }
  }
}

function toDomain(row: AutoPublicadoEntity): AutoPublicado {
  return {
    idProceso: row.idProceso,
    idActuacion: row.idActuacion,
    confianza: row.confianza,
    urlPdf: row.urlPdf,
    nombreArchivo: row.nombreArchivo,
    urlEstado: row.urlEstado,
    numeroEstado: row.numeroEstado,
    fechaPublicacion: row.fechaPublicacion,
    buscadoEn: isoMs(Temporal.Instant.fromEpochMilliseconds(row.buscadoEn.getTime())),
    intentos: row.intentos,
  };
}

function toEntity(auto: AutoPublicado): AutoPublicadoEntity {
  const row = new AutoPublicadoEntity();
  row.idProceso = auto.idProceso;
  row.idActuacion = auto.idActuacion;
  row.confianza = auto.confianza;
  row.urlPdf = auto.urlPdf;
  row.nombreArchivo = auto.nombreArchivo;
  row.urlEstado = auto.urlEstado;
  row.numeroEstado = auto.numeroEstado;
  row.fechaPublicacion = auto.fechaPublicacion;
  row.buscadoEn = new Date(Temporal.Instant.from(auto.buscadoEn).epochMilliseconds);
  row.intentos = auto.intentos;
  return row;
}
