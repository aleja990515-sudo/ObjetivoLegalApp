import { All, Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiError } from '../../../common/http/api-error.js';
import type { AppConfig } from '../../../config/app-config.js';
import { InjectAppConfig } from '../../../config/app-config.provider.js';
import { AuthService } from '../../application/auth.service.js';
import { Public } from './public.decorator.js';

interface LoginBody {
  correo?: unknown;
  clave?: unknown;
}

/** IP del cliente. Detrás de Vercel la IP real llega en `x-forwarded-for`. */
export function ipDelCliente(req: Request, vercel: boolean): string {
  const reenviada = req.headers['x-forwarded-for'];
  if (vercel && typeof reenviada === 'string' && reenviada.trim()) return reenviada.split(',')[0].trim();
  return req.ip ?? 'desconocida';
}

@Public()
@Controller()
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    @InjectAppConfig() private readonly config: AppConfig,
  ) {}

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() body: LoginBody,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ nombre: string }> {
    const ip = ipDelCliente(req, this.config.vercel);
    const { user, cookie } = await this.auth.login(body?.correo, body?.clave, ip);
    res.setHeader('Set-Cookie', cookie);
    return { nombre: user.nombre };
  }

  @All('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    res.setHeader('Set-Cookie', this.auth.logoutCookie);
    return { ok: true };
  }

  @All('yo')
  @HttpCode(200)
  yo(@Req() req: Request): { nombre: string } {
    const user = this.auth.readSession(req.headers.cookie);
    if (!user) throw new ApiError(401, 'Sin sesión');
    return { nombre: user.nombre };
  }
}
