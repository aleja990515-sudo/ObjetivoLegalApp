import { Controller, Get, Param } from '@nestjs/common';
import { ApiError, ROUTE_NOT_FOUND_MESSAGE } from '../../../common/http/api-error.js';
import { CurrentUser } from '../../../auth/infrastructure/http/current-user.decorator.js';
import type { SessionUser } from '../../../auth/domain/session.js';
import { AutosService } from '../../application/autos.service.js';

/** PDF of a providencia from Publicaciones Procesales; needs a session (global guard). */
@Controller()
export class AutosController {
  constructor(private readonly autos: AutosService) {}

  @Get('procesos/:id/actuaciones/:actuacionId/auto')
  auto(@Param('id') id: string, @Param('actuacionId') actuacionId: string, @CurrentUser() usuario: SessionUser) {
    if (!/^\d{1,15}$/.test(actuacionId)) throw new ApiError(404, ROUTE_NOT_FOUND_MESSAGE);
    return this.autos.auto(usuario, id, Number(actuacionId));
  }
}
