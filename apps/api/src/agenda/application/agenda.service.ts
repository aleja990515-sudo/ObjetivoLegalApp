import { Inject, Injectable } from '@nestjs/common';
import { AUTH_SECRET } from '../../auth/application/auth.service.js';
import { safeEqual } from '../../common/security/safe-equal.js';
import { hoyBogota } from '../../procesos/domain/bogota-time.js';
import { PROCESO_REPOSITORY, type ProcesoRepository } from '../../procesos/domain/proceso.repository.js';
import { generarIcs } from '../domain/ics.js';
import { tokenAgenda } from '../domain/calendar-token.js';
import { tareasAgenda, type TareaAgenda } from '../domain/agenda.js';

export interface AgendaVista {
  tareas: TareaAgenda[];
  /** Bogotá calendar date `YYYY-MM-DD`. */
  hoy: string;
  /** Absolute URL of the calendar subscription. */
  ics: string;
}

/** Office agenda and the calendar subscription (legacy `/agenda` and `/agenda.ics`). */
@Injectable()
export class AgendaService {
  constructor(
    @Inject(PROCESO_REPOSITORY) private readonly procesos: ProcesoRepository,
    @Inject(AUTH_SECRET) private readonly secret: string,
  ) {}

  /** `origen` is the public origin (scheme and host) used to build the calendar link. */
  async agenda(origen: string): Promise<AgendaVista> {
    return {
      tareas: tareasAgenda(await this.procesos.findAll()),
      hoy: hoyBogota(),
      ics: `${origen}/api/agenda.ics?t=${this.token()}`,
    };
  }

  enlaceValido(token: unknown): boolean {
    return safeEqual(token, this.token());
  }

  async calendario(): Promise<string> {
    return generarIcs(await this.procesos.findAll(), Temporal.Now.instant());
  }

  private token(): string {
    return tokenAgenda(this.secret);
  }
}
