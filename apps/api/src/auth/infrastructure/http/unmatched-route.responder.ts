import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import type { UnmatchedRouteResponder } from '../../../common/http/unmatched-route.js';
import { AuthService } from '../../application/auth.service.js';
import { LOGIN_REQUIRED_MESSAGE } from './session.guard.js';

/**
 * Legacy order: the session was checked before routing, so an unknown /api path
 * answers 401 "Inicia sesión." without a session and 404 with one.
 */
@Injectable()
export class SessionAwareUnmatchedRoute implements UnmatchedRouteResponder {
  constructor(private readonly auth: AuthService) {}

  respond(req: Request): { status: number; message: string } | null {
    return this.auth.readSession(req.headers.cookie) ? null : { status: 401, message: LOGIN_REQUIRED_MESSAGE };
  }
}
