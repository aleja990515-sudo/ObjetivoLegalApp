import { Injectable, type CanActivate, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiError } from '../../../common/http/api-error.js';
import { AuthService } from '../../application/auth.service.js';
import type { AuthenticatedRequest } from './current-user.decorator.js';
import { IS_PUBLIC } from './public.decorator.js';

export const LOGIN_REQUIRED_MESSAGE = 'Inicia sesión.';

/** Global guard: every route needs a valid session unless marked {@link Public}. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [context.getHandler(), context.getClass()]);
    if (isPublic) return true;
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const usuario = this.auth.readSession(req.headers.cookie);
    if (!usuario) throw new ApiError(401, LOGIN_REQUIRED_MESSAGE);
    req.usuario = usuario;
    return true;
  }
}
