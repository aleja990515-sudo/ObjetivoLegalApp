import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ApiError, ROUTE_NOT_FOUND_MESSAGE } from '../../../common/http/api-error.js';
import { CurrentUser } from '../../../auth/infrastructure/http/current-user.decorator.js';
import type { SessionUser } from '../../../auth/domain/session.js';
import { ProcesosService } from '../../application/procesos.service.js';

/** HTTP adapter of the procesos routes; every route needs a session (global guard). */
@Controller()
export class ProcesosController {
  constructor(private readonly procesos: ProcesosService) {}

  @Get('procesos')
  listar(@CurrentUser() usuario: SessionUser) {
    return this.procesos.list(usuario);
  }

  @Post('procesos')
  agregar(@Body() body: unknown, @CurrentUser() usuario: SessionUser) {
    return this.procesos.add(usuario, body);
  }

  @Get('novedades')
  novedades(@CurrentUser() usuario: SessionUser) {
    return this.procesos.novedades(usuario);
  }

  /** Nested under the proceso so `existente` can prove ownership before CPNU is asked. */
  @Get('procesos/:id/actuaciones/:actuacionId/documentos')
  documentos(
    @Param('id') id: string,
    @Param('actuacionId') actuacionId: string,
    @CurrentUser() usuario: SessionUser,
  ) {
    if (!/^\d+$/.test(actuacionId)) throw new ApiError(404, ROUTE_NOT_FOUND_MESSAGE);
    return this.procesos.documentos(usuario, id, actuacionId);
  }

  @Get('procesos/:id')
  detalle(@Param('id') id: string, @CurrentUser() usuario: SessionUser) {
    return this.procesos.detalle(usuario, id);
  }

  @Patch('procesos/:id')
  actualizarOficina(@Param('id') id: string, @Body() body: unknown, @CurrentUser() usuario: SessionUser) {
    return this.procesos.actualizarOficina(usuario, id, body);
  }

  @Delete('procesos/:id')
  eliminar(@Param('id') id: string, @CurrentUser() usuario: SessionUser) {
    return this.procesos.eliminar(usuario, id);
  }

  @Post('procesos/:id/visto')
  @HttpCode(200)
  marcarVisto(@Param('id') id: string, @CurrentUser() usuario: SessionUser) {
    return this.procesos.marcarVisto(usuario, id);
  }

  @Post('procesos/:id/actualizar')
  @HttpCode(200)
  actualizar(@Param('id') id: string, @CurrentUser() usuario: SessionUser) {
    return this.procesos.actualizar(usuario, id);
  }

  @Post('procesos/:id/notas')
  agregarNota(@Param('id') id: string, @Body() body: unknown, @CurrentUser() usuario: SessionUser) {
    return this.procesos.agregarNota(usuario, id, body);
  }

  @Delete('procesos/:id/notas/:nid')
  eliminarNota(@Param('id') id: string, @Param('nid') nid: string, @CurrentUser() usuario: SessionUser) {
    return this.procesos.eliminarNota(usuario, id, nid);
  }

  @Post('procesos/:id/tareas')
  agregarTarea(@Param('id') id: string, @Body() body: unknown, @CurrentUser() usuario: SessionUser) {
    return this.procesos.agregarTarea(usuario, id, body);
  }

  @Patch('procesos/:id/tareas/:tid')
  actualizarTarea(
    @Param('id') id: string,
    @Param('tid') tid: string,
    @Body() body: unknown,
    @CurrentUser() usuario: SessionUser,
  ) {
    return this.procesos.actualizarTarea(usuario, id, tid, body);
  }

  @Delete('procesos/:id/tareas/:tid')
  eliminarTarea(@Param('id') id: string, @Param('tid') tid: string, @CurrentUser() usuario: SessionUser) {
    return this.procesos.eliminarTarea(usuario, id, tid);
  }
}
