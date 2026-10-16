import { Inject, Injectable } from '@nestjs/common';
import { AUTH_SECRET } from '../../auth/application/auth.service.js';
import type { SessionUser } from '../../auth/domain/session.js';
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
  async agenda(usuario: SessionUser, origen: string): Promise<AgendaVista> {
    return {
      tareas: tareasAgenda(await this.procesos.findAll(usuario.id)),
      hoy: hoyBogota(),
      ics: `${origen}/api/agenda.ics?t=${tokenAgenda(this.secret, usuario.id)}`,
    };
  }

  /** The user a subscription link belongs to, or `null` when it does not verify. */
  usuarioDelToken(token: unknown): string | null {
    if (typeof token !== 'string') return null;
    const usuarioId = token.slice(0, token.lastIndexOf('.'));
    return usuarioId && safeEqual(token, tokenAgenda(this.secret, usuarioId)) ? usuarioId : null;
  }

  async calendario(usuarioId: string): Promise<string> {
    return generarIcs(await this.procesos.findAll(usuarioId), Temporal.Now.instant());
  }
}
