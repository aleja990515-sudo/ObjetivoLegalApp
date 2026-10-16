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

  /**
   * Returns how many instances were added. `bases` holds one proceso per owner of
   * the radicado: every co-follower gets its own copy, off a single CPNU search.
   */
  async detect(radicado: string, bases: (Proceso | null)[]): Promise<number> {
    // Dedup happens inside each owner's own list, so a new instance never inherits
    // nor is compared against another user's. An ownerless base dedupes against
    // nothing and lets the insert decide: `usuario_id` is a uuid, so there is no
    // sentinel to pass instead of an id (Postgres rejects `''` with 22P02).
    const conocidos = await Promise.all(
      bases.map(
        async (base) =>
          new Set(
            (await (base?.usuarioId ? this.procesos.listRefs(base.usuarioId) : Promise.resolve([]))).map(
              (p) => p.idProceso,
            ),
          ),
      ),
    );
    let added = 0;
    for (const found of await this.cpnu.searchRadicado(radicado)) {
      if (found.esPrivado) continue;
      for (const [indice, base] of bases.entries()) {
        if (conocidos[indice].has(String(found.idProceso))) continue;
        const proceso = await this.refresher.hydrateNew(newInstance(found, radicado, base, ahoraIso()));
        if (await this.procesos.insert(proceso)) added++;
      }
    }
    return added;
  }
}
