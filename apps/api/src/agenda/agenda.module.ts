import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ProcesosModule } from '../procesos/procesos.module.js';
import { AgendaService } from './application/agenda.service.js';
import { AgendaController } from './infrastructure/http/agenda.controller.js';

@Module({
  imports: [AuthModule, ProcesosModule],
  controllers: [AgendaController],
  providers: [AgendaService],
})
export class AgendaModule {}
