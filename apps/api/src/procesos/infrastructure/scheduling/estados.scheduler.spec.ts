import { Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { loadAppConfig } from '../../../config/app-config.js';
import type { EstadosService } from '../../application/estados.service.js';
import { ESTADOS_JOB, EstadosScheduler } from './estados.scheduler.js';

const VACIO = { despachos: 0, estados: 0, detecciones: 0, ilegibles: 0, sinListado: 0 };

function setup(ESTADOS_CRON: string, estados: Partial<EstadosService> = {}) {
  const registry = new SchedulerRegistry();
  const config = loadAppConfig({ DATABASE_URL: 'postgres://x', SESSION_SECRET: 'x'.repeat(32), ESTADOS_CRON });
  const service = {
    running: false,
    revisar: vi.fn(async () => VACIO),
    ...estados,
  };
  return { registry, service, scheduler: new EstadosScheduler(config, registry, service as unknown as EstadosService) };
}

describe('EstadosScheduler', () => {
  beforeAll(() => Logger.overrideLogger(false));

  it('registers a UTC cron job with the configured expression', async () => {
    const { registry, scheduler } = setup('0 */6 * * *');
    scheduler.onModuleInit();
    const job = registry.getCronJob(ESTADOS_JOB);
    expect(job.cronTime.source).toBe('0 */6 * * *');
    expect(job.isActive).toBe(true);
    await job.stop();
  });

  it('registers nothing when ESTADOS_CRON=off', () => {
    const { registry, scheduler } = setup('off');
    scheduler.onModuleInit();
    expect(registry.getCronJobs().size).toBe(0);
  });

  it('runs the sweep on each tick', async () => {
    const { service, scheduler } = setup('off');
    await scheduler.tick();
    expect(service.revisar).toHaveBeenCalledTimes(1);
  });

  it('skips a tick while a sweep is still running', async () => {
    const { service, scheduler } = setup('off', { running: true });
    await scheduler.tick();
    expect(service.revisar).not.toHaveBeenCalled();
  });

  it('never throws from a tick', async () => {
    const { scheduler } = setup('off', { revisar: vi.fn(async () => Promise.reject(new Error('boom'))) });
    await expect(scheduler.tick()).resolves.toBeUndefined();
  });
});
