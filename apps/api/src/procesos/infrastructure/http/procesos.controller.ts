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
  listar() {
    return this.procesos.list();
  }

  @Post('procesos')
  agregar(@Body() body: unknown, @CurrentUser() usuario: SessionUser) {
    return this.procesos.add(usuario, body);
  }

  @Get('novedades')
  novedades() {
    return this.procesos.novedades();
  }

  @Get('actuaciones/:id/documentos')
  documentos(@Param('id') id: string) {
    if (!/^\d+$/.test(id)) throw new ApiError(404, ROUTE_NOT_FOUND_MESSAGE);
    return this.procesos.documentos(id);
  }

  @Get('procesos/:id')
  detalle(@Param('id') id: string) {
    return this.procesos.detalle(id);
  }

  @Patch('procesos/:id')
  actualizarOficina(@Param('id') id: string, @Body() body: unknown) {
    return this.procesos.actualizarOficina(id, body);
  }

  @Delete('procesos/:id')
  eliminar(@Param('id') id: string) {
    return this.procesos.eliminar(id);
  }

  @Post('procesos/:id/visto')
  @HttpCode(200)
  marcarVisto(@Param('id') id: string) {
    return this.procesos.marcarVisto(id);
  }

  @Post('procesos/:id/actualizar')
  @HttpCode(200)
  actualizar(@Param('id') id: string) {
    return this.procesos.actualizar(id);
  }

  @Post('procesos/:id/notas')
  agregarNota(@Param('id') id: string, @Body() body: unknown, @CurrentUser() usuario: SessionUser) {
    return this.procesos.agregarNota(usuario, id, body);
  }

  @Delete('procesos/:id/notas/:nid')
  eliminarNota(@Param('id') id: string, @Param('nid') nid: string) {
    return this.procesos.eliminarNota(id, nid);
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
  eliminarTarea(@Param('id') id: string, @Param('tid') tid: string) {
    return this.procesos.eliminarTarea(id, tid);
  }
}
