import { All, Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../../../auth/infrastructure/http/public.decorator.js';
import { CurrentUser } from '../../../auth/infrastructure/http/current-user.decorator.js';
import type { SessionUser } from '../../../auth/domain/session.js';
import { ApiError } from '../../../common/http/api-error.js';
import { AgendaService, type AgendaVista } from '../../application/agenda.service.js';

export const ENLACE_CALENDARIO_INVALIDO = 'Enlace de calendario inválido.';

const cabecera = (req: Request, nombre: string): string | undefined => {
  const valor = req.headers[nombre];
  return typeof valor === 'string' ? valor : undefined;
};

/** Public origin of the request, honouring the proxy headers (legacy `agenda` route). */
export function origenDe(req: Request): string {
  const proto = cabecera(req, 'x-forwarded-proto') || 'http';
  const host = cabecera(req, 'x-forwarded-host') || req.headers.host;
  return `${proto}://${host}`;
}

@Controller()
export class AgendaController {
  constructor(private readonly agenda: AgendaService) {}

  @Get('agenda')
  listar(@Req() req: Request, @CurrentUser() usuario: SessionUser): Promise<AgendaVista> {
    return this.agenda.agenda(usuario, origenDe(req));
  }

  /** Public: calendar clients send no cookies, so the token in the query string is the credential. */
  @Public()
  @All('agenda.ics')
  async calendario(@Query('t') token: unknown, @Res() res: Response): Promise<void> {
    res.setHeader('Cache-Control', 'no-store');
    // The signature is verified before any read, so a forged link reads nothing.
    const usuarioId = this.agenda.usuarioDelToken(token);
    if (!usuarioId) throw new ApiError(401, ENLACE_CALENDARIO_INVALIDO);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'inline; filename="mis-procesos.ics"');
    res.status(200).end(await this.agenda.calendario(usuarioId));
  }
}
