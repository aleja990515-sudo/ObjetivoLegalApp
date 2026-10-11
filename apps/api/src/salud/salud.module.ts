import { Module } from '@nestjs/common';
import { ProcesosModule } from '../procesos/procesos.module.js';
import { SaludController } from './salud.controller.js';

@Module({ imports: [ProcesosModule], controllers: [SaludController] })
export class SaludModule {}
