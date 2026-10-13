import { Module } from '@nestjs/common';
import { AutosService } from './application/autos.service.js';
import { PUBLICACIONES_PORT } from './application/ports/publicaciones.port.js';
import { DetectInstancesService } from './application/detect-instances.service.js';
import { CPNU_PORT } from './application/ports/cpnu.port.js';
import { RefreshProcesoService } from './application/refresh-proceso.service.js';
import { ProcesosService } from './application/procesos.service.js';
import { ReviewService } from './application/review.service.js';
import { AUTO_PUBLICADO_REPOSITORY } from './domain/auto-publicado.repository.js';
import { META_REPOSITORY } from './domain/meta.repository.js';
import { PROCESO_REPOSITORY } from './domain/proceso.repository.js';
import { CpnuHttpAdapter } from './infrastructure/cpnu/cpnu-http.adapter.js';
import { AutosController } from './infrastructure/http/autos.controller.js';
import { CronController } from './infrastructure/http/cron.controller.js';
import { ProcesosController } from './infrastructure/http/procesos.controller.js';
import { TypeOrmAutoPublicadoRepository } from './infrastructure/persistence/typeorm-auto-publicado.repository.js';
import { TypeOrmMetaRepository } from './infrastructure/persistence/typeorm-meta.repository.js';
import { TypeOrmProcesoRepository } from './infrastructure/persistence/typeorm-proceso.repository.js';
import { PublicacionesHttpAdapter } from './infrastructure/publicaciones/publicaciones-http.adapter.js';
import { ReviewScheduler } from './infrastructure/scheduling/review.scheduler.js';

@Module({
  controllers: [CronController, ProcesosController, AutosController],
  providers: [
    { provide: PROCESO_REPOSITORY, useClass: TypeOrmProcesoRepository },
    { provide: META_REPOSITORY, useClass: TypeOrmMetaRepository },
    { provide: CPNU_PORT, useClass: CpnuHttpAdapter },
    { provide: AUTO_PUBLICADO_REPOSITORY, useClass: TypeOrmAutoPublicadoRepository },
    { provide: PUBLICACIONES_PORT, useFactory: () => new PublicacionesHttpAdapter() },
    RefreshProcesoService,
    DetectInstancesService,
    ReviewService,
    ReviewScheduler,
    ProcesosService,
    AutosService,
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
