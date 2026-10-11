import { Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { loadAppConfig } from '../../../config/app-config.js';
import type { ReviewService } from '../../application/review.service.js';
import { REVIEW_JOB, ReviewScheduler } from './review.scheduler.js';

function setup(REVISION_CRON: string, review: Partial<ReviewService> = {}) {
  const registry = new SchedulerRegistry();
  const config = loadAppConfig({ DATABASE_URL: 'postgres://x', REVISION_CRON });
  const service = {
    running: false,
    reviewAll: vi.fn(async () => ({ nuevas: 0, instancias: 0, errores: 0 })),
    ...review,
  };
  return { registry, service, scheduler: new ReviewScheduler(config, registry, service as unknown as ReviewService) };
}

describe('ReviewScheduler', () => {
  beforeAll(() => Logger.overrideLogger(false));

  it('registers a UTC cron job with the configured expression', async () => {
    const { registry, scheduler } = setup('0 11 * * *');
    scheduler.onModuleInit();
    const job = registry.getCronJob(REVIEW_JOB);
    expect(job.cronTime.source).toBe('0 11 * * *');
    expect(job.isActive).toBe(true);
    await job.stop();
  });

  it('registers nothing when REVISION_CRON=off', () => {
    const { registry, scheduler } = setup('off');
    scheduler.onModuleInit();
    expect(registry.getCronJobs().size).toBe(0);
  });

  it('runs the review on each tick', async () => {
    const { service, scheduler } = setup('off');
    await scheduler.tick();
    expect(service.reviewAll).toHaveBeenCalledTimes(1);
  });

  it('skips a tick while a review is still running', async () => {
    const { service, scheduler } = setup('off', { running: true });
    await scheduler.tick();
    expect(service.reviewAll).not.toHaveBeenCalled();
  });

  it('never throws from a tick', async () => {
    const { scheduler } = setup('off', { reviewAll: vi.fn(async () => Promise.reject(new Error('boom'))) });
    await expect(scheduler.tick()).resolves.toBeUndefined();
  });
});
