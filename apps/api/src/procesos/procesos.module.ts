import { Module } from '@nestjs/common';
import { DetectInstancesService } from './application/detect-instances.service.js';
import { CPNU_PORT } from './application/ports/cpnu.port.js';
import { RefreshProcesoService } from './application/refresh-proceso.service.js';
import { ReviewService } from './application/review.service.js';
import { META_REPOSITORY } from './domain/meta.repository.js';
import { PROCESO_REPOSITORY } from './domain/proceso.repository.js';
import { CpnuHttpAdapter } from './infrastructure/cpnu/cpnu-http.adapter.js';
import { CronController } from './infrastructure/http/cron.controller.js';
import { TypeOrmMetaRepository } from './infrastructure/persistence/typeorm-meta.repository.js';
import { TypeOrmProcesoRepository } from './infrastructure/persistence/typeorm-proceso.repository.js';
import { ReviewScheduler } from './infrastructure/scheduling/review.scheduler.js';

@Module({
  controllers: [CronController],
  providers: [
    { provide: PROCESO_REPOSITORY, useClass: TypeOrmProcesoRepository },
    { provide: META_REPOSITORY, useClass: TypeOrmMetaRepository },
    { provide: CPNU_PORT, useClass: CpnuHttpAdapter },
    RefreshProcesoService,
    DetectInstancesService,
    ReviewService,
    ReviewScheduler,
  ],
  exports: [
    PROCESO_REPOSITORY,
    META_REPOSITORY,
    CPNU_PORT,
    RefreshProcesoService,
    DetectInstancesService,
    ReviewService,
  ],
})
export class ProcesosModule {}
