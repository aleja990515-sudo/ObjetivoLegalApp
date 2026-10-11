import { Inject, Injectable } from '@nestjs/common';
import type { Proceso } from '../domain/proceso.js';
import { PROCESO_REPOSITORY, type ProcesoRepository } from '../domain/proceso.repository.js';
import { newInstance } from '../domain/refresh.js';
import { CPNU_PORT, type CpnuPort } from './ports/cpnu.port.js';
import { RefreshProcesoService } from './refresh-proceso.service.js';
import { ahoraIso } from '../../common/time/temporal.js';

/**
 * Searches a radicado again and follows instances that appeared since (e.g. an
 * appeal at the tribunal), marked as `nuevaInstancia`. Private and already
 * followed instances are skipped. Search failures propagate to the caller.
 */
@Injectable()
export class DetectInstancesService {
  constructor(
    @Inject(CPNU_PORT) private readonly cpnu: CpnuPort,
    @Inject(PROCESO_REPOSITORY) private readonly procesos: ProcesoRepository,
    private readonly refresher: RefreshProcesoService,
  ) {}

  /** Returns how many instances were added. */
  async detect(radicado: string, base: Proceso | null): Promise<number> {
    const known = new Set((await this.procesos.listRefs()).map((p) => p.idProceso));
    let added = 0;
    for (const found of await this.cpnu.searchRadicado(radicado)) {
      if (known.has(String(found.idProceso)) || found.esPrivado) continue;
      const proceso = await this.refresher.hydrateNew(newInstance(found, radicado, base, ahoraIso()));
      if (await this.procesos.insert(proceso)) added++;
    }
    return added;
  }
}
