import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import type { MetaRepository } from '../../domain/meta.repository.js';
import { MetaEntity } from './entities/index.js';

@Injectable()
export class TypeOrmMetaRepository implements MetaRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async get(clave: string): Promise<string | null> {
    const row = await this.dataSource.manager.findOneBy(MetaEntity, { clave });
    return row?.valor ?? null;
  }

  async set(clave: string, valor: string): Promise<void> {
    await this.dataSource.manager.upsert(MetaEntity, { clave, valor }, ['clave']);
  }
}
