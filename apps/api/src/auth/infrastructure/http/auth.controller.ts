import { All, Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiError } from '../../../common/http/api-error.js';
import { AuthService } from '../../application/auth.service.js';
import type { SessionUser } from '../../domain/session.js';
import { Public } from './public.decorator.js';

interface LoginBody {
  nombre?: unknown;
  clave?: unknown;
}

@Public()
@Controller()
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  async login(@Body() body: LoginBody, @Res({ passthrough: true }) res: Response): Promise<SessionUser> {
    const { user, cookie } = await this.auth.login(body?.nombre, body?.clave);
    res.setHeader('Set-Cookie', cookie);
    return user;
  }

  @All('logout')
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: Response): { ok: true } {
    res.setHeader('Set-Cookie', this.auth.logoutCookie);
    return { ok: true };
  }

  @All('yo')
  @HttpCode(200)
  yo(@Req() req: Request): SessionUser {
    const user = this.auth.readSession(req.headers.cookie);
    if (!user) throw new ApiError(401, 'Sin sesión');
    return user;
  }
}
