import { Module } from '@nestjs/common';
import { META_REPOSITORY } from './domain/meta.repository.js';
import { PROCESO_REPOSITORY } from './domain/proceso.repository.js';
import { TypeOrmMetaRepository } from './infrastructure/persistence/typeorm-meta.repository.js';
import { TypeOrmProcesoRepository } from './infrastructure/persistence/typeorm-proceso.repository.js';

@Module({
  providers: [
    { provide: PROCESO_REPOSITORY, useClass: TypeOrmProcesoRepository },
    { provide: META_REPOSITORY, useClass: TypeOrmMetaRepository },
  ],
  exports: [PROCESO_REPOSITORY, META_REPOSITORY],
})
export class ProcesosModule {}
