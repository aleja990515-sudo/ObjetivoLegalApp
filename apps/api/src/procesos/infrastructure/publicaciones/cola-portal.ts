import { realSleep, type Sleep } from '../../../common/time/sleep.js';
import { epochMsAhora } from '../../../common/time/temporal.js';

/** Minimum pause between two requests to the portal, counted from the end of the previous one. */
export const PORTAL_INTERVALO_MS = 2_000;

/**
 * Serial queue for the portal: one request at a time, with at least
 * `intervaloMs` between the end of a request and the start of the next one.
 */
export class ColaPortal {
  private cola: Promise<unknown> = Promise.resolve();
  private ultima = Number.NEGATIVE_INFINITY;

  constructor(
    private readonly intervaloMs: number,
    private readonly sleep: Sleep,
    private readonly ahora: () => number = epochMsAhora,
  ) {}

  turno<T>(tarea: () => Promise<T>): Promise<T> {
    const resultado = this.cola.then(async () => {
      const espera = this.ultima + this.intervaloMs - this.ahora();
      if (espera > 0) await this.sleep(espera);
      try {
        return await tarea();
      } finally {
        this.ultima = this.ahora();
      }
    });
    this.cola = resultado.catch(() => undefined);
    return resultado;
  }
}

/** The one queue of the process: every adapter instance shares it. */
export const colaPortalCompartida = new ColaPortal(PORTAL_INTERVALO_MS, realSleep);
