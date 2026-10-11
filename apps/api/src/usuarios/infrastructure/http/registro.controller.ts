import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { Public } from '../../../auth/infrastructure/http/public.decorator.js';
import { RegistroService } from '../../application/registro.service.js';

/** Autorregistro público; la cuenta queda inactiva hasta que la oficina la active. */
@Public()
@Controller()
export class RegistroController {
  constructor(private readonly registro: RegistroService) {}

  @Post('registro')
  @HttpCode(201)
  async registrar(@Body() body: unknown): Promise<{ mensaje: string }> {
    return { mensaje: await this.registro.registrar(body) };
  }
}
