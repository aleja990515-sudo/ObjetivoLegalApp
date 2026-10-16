import { Inject, Injectable, Logger } from '@nestjs/common';
import { SLEEP, type Sleep } from '../../common/time/sleep.js';
import { ahoraIso } from '../../common/time/temporal.js';
import { META_REPOSITORY, META_ULTIMA_REVISION, type MetaRepository } from '../domain/meta.repository.js';
import type { Proceso } from '../domain/proceso.js';
import { PROCESO_REPOSITORY, type ProcesoRepository } from '../domain/proceso.repository.js';
import { DetectInstancesService } from './detect-instances.service.js';
import { RefreshProcesoService } from './refresh-proceso.service.js';

export interface ReviewSummary {
  nuevas: number;
  instancias: number;
  errores: number;
}

/** Pauses between CPNU calls so the Rama's service is not hammered. */
export const PAUSE_PER_PROCESO_MS = 1000;
export const PAUSE_PER_RADICADO_MS = 500;

/**
 * Reviews every followed proceso (legacy `revisarTodos`): refreshes each one,
 * then looks for new instances once per radicado, and records `ultimaRevision`.
 * Only one review runs at a time; concurrent callers share the running one.
 */
@Injectable()
export class ReviewService {
  private readonly logger = new Logger(ReviewService.name);
  private inFlight: Promise<ReviewSummary> | null = null;

  constructor(
    @Inject(PROCESO_REPOSITORY) private readonly procesos: ProcesoRepository,
    @Inject(META_REPOSITORY) private readonly meta: MetaRepository,
    private readonly refresher: RefreshProcesoService,
    private readonly instances: DetectInstancesService,
    @Inject(SLEEP) private readonly sleep: Sleep,
  ) {}

  get running(): boolean {
    return this.inFlight !== null;
  }

  reviewAll(): Promise<ReviewSummary> {
    this.inFlight ??= this.run().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async run(): Promise<ReviewSummary> {
    let nuevas = 0;
    let errores = 0;
    let instancias = 0;
    const radicados = new Map<string, Proceso[]>();

    for (const { id } of await this.procesos.listRefsForReview()) {
      const proceso = await this.procesos.findByIdForReview(id); // read right before, in case it was edited
      if (!proceso) continue;
      // One base per owner of the radicado: co-followers each get the new instance,
      // and the ownerless orphans share one slot.
      const duenos = radicados.get(proceso.radicado);
      if (duenos) {
        if (!duenos.some((p) => p.usuarioId === proceso.usuarioId)) duenos.push(proceso);
      } else {
        radicados.set(proceso.radicado, [proceso]);
      }
      const result = await this.refresher.refresh(proceso);
      nuevas += result.nuevas;
      if (result.error) errores++;
      await this.sleep(PAUSE_PER_PROCESO_MS);
    }

    for (const [radicado, bases] of radicados) {
      try {
        instancias += await this.instances.detect(radicado, bases);
      } catch {
        errores++;
      }
      await this.sleep(PAUSE_PER_RADICADO_MS);
    }

    await this.meta.set(META_ULTIMA_REVISION, ahoraIso());
    this.logger.log(`[revision] nuevas=${nuevas} instancias=${instancias} errores=${errores}`);
    return { nuevas, instancias, errores };
  }
}
