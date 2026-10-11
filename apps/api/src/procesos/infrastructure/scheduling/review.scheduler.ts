import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import type { AppConfig } from '../../../config/app-config.js';
import { InjectAppConfig } from '../../../config/app-config.provider.js';
import { ReviewService } from '../../application/review.service.js';

export const REVIEW_JOB = 'revision';

/**
 * Runs the automatic review on `REVISION_CRON` (UTC; default 06:00 Colombia).
 * `REVISION_CRON=off` disables it. A tick is skipped while a review is running.
 */
@Injectable()
export class ReviewScheduler implements OnModuleInit {
  private readonly logger = new Logger(ReviewScheduler.name);

  constructor(
    @InjectAppConfig() private readonly config: AppConfig,
    private readonly registry: SchedulerRegistry,
    private readonly review: ReviewService,
  ) {}

  onModuleInit(): void {
    const expression = this.config.revisionCron;
    if (!expression) {
      this.logger.log('Automatic review disabled (REVISION_CRON=off)');
      return;
    }
    const job = CronJob.from({ cronTime: expression, onTick: () => this.tick(), timeZone: 'UTC' });
    this.registry.addCronJob(REVIEW_JOB, job);
    job.start();
    this.logger.log(`Automatic review scheduled: "${expression}" (UTC)`);
  }

  /** One scheduled run; never throws. */
  async tick(): Promise<void> {
    if (this.review.running) {
      this.logger.warn('Previous review still running; skipping this tick');
      return;
    }
    try {
      await this.review.reviewAll();
    } catch (e) {
      this.logger.error(e instanceof Error ? (e.stack ?? e.message) : String(e));
    }
  }
}
