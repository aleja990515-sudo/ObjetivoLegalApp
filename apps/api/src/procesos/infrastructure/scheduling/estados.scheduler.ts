import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import type { AppConfig } from '../../../config/app-config.js';
import { InjectAppConfig } from '../../../config/app-config.provider.js';
import { EstadosService } from '../../application/estados.service.js';

export const ESTADOS_JOB = 'estados';

/**
 * Sweeps the court's published estados for the followed private cases on
 * `ESTADOS_CRON` (UTC; default every 6 hours). `ESTADOS_CRON=off` disables it. A
 * tick is skipped while a sweep is running.
 */
@Injectable()
export class EstadosScheduler implements OnModuleInit {
  private readonly logger = new Logger(EstadosScheduler.name);

  constructor(
    @InjectAppConfig() private readonly config: AppConfig,
    private readonly registry: SchedulerRegistry,
    private readonly estados: EstadosService,
  ) {}

  onModuleInit(): void {
    const expression = this.config.estadosCron;
    if (!expression) {
      this.logger.log('Estados sweep disabled (ESTADOS_CRON=off)');
      return;
    }
    const job = CronJob.from({ cronTime: expression, onTick: () => this.tick(), timeZone: 'UTC' });
    this.registry.addCronJob(ESTADOS_JOB, job);
    job.start();
    this.logger.log(`Estados sweep scheduled: "${expression}" (UTC)`);
  }

  /** One scheduled run; never throws. */
  async tick(): Promise<void> {
    if (this.estados.running) {
      this.logger.warn('Previous estados sweep still running; skipping this tick');
      return;
    }
    try {
      await this.estados.revisar();
    } catch (e) {
      this.logger.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
    }
  }
}
