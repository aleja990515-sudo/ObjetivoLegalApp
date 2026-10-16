import { Inject, Injectable } from '@nestjs/common';
import type { Proceso, ProcesoCpnuState } from '../domain/proceso.js';
import { PROCESO_REPOSITORY, type ProcesoRepository } from '../domain/proceso.repository.js';
import { applyRefresh, applyRefreshError } from '../domain/refresh.js';
import { ahoraIso } from '../../common/time/temporal.js';
import { errorMessage } from './error-message.js';
import { CPNU_PORT, type CpnuPort } from './ports/cpnu.port.js';

export interface RefreshResult {
  /** New CPNU state, or `null` when the proceso no longer exists. */
  state: ProcesoCpnuState | null;
  nuevas: number;
  /** CPNU error message when the refresh failed. */
  error: string | null;
}

/** Re-reads a proceso from CPNU and stores only the CPNU-owned data. */
@Injectable()
export class RefreshProcesoService {
  constructor(
    @Inject(CPNU_PORT) private readonly cpnu: CpnuPort,
    @Inject(PROCESO_REPOSITORY) private readonly procesos: ProcesoRepository,
  ) {}

  /**
   * Re-reads `proceso` from CPNU and stores only the CPNU-owned data. CPNU is
   * addressed by `idProceso` and the row is written by the surrogate `id`, so a
   * refresh never touches the copy another user keeps of the same expediente.
   */
  async refresh(proceso: Proceso): Promise<RefreshResult> {
    // CPNU is queried outside the transaction; the diff is computed against the
    // state locked at write time, so concurrent office edits are respected.
    let nuevas = 0;
    let error: string | null = null;
    let mutate: (current: ProcesoCpnuState) => ProcesoCpnuState;
    try {
      const loaded = await this.cpnu.loadProceso(proceso.idProceso);
      const now = ahoraIso();
      mutate = (current) => {
        const outcome = applyRefresh(current, loaded, now);
        nuevas = outcome.nuevas;
        return outcome.state;
      };
    } catch (e) {
      error = errorMessage(e);
      mutate = (current) => applyRefreshError(current, error as string);
    }
    const state = await this.procesos.updateCpnuState(proceso.id, mutate);
    return state ? { state, nuevas, error } : { state: null, nuevas: 0, error: null };
  }

  /** Loads the CPNU data of a proceso that is not stored yet (first load: nothing is new). */
  async hydrateNew(proceso: Proceso): Promise<Proceso> {
    try {
      const loaded = await this.cpnu.loadProceso(proceso.idProceso);
      return { ...proceso, ...applyRefresh(proceso, loaded, ahoraIso()).state };
    } catch (e) {
      return { ...proceso, ...applyRefreshError(proceso, errorMessage(e)) };
    }
  }
}
