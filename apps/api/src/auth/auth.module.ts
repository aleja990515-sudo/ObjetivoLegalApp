import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { UNMATCHED_ROUTE_RESPONDER } from '../common/http/unmatched-route.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';
import { AUTH_SECRET, AuthService } from './application/auth.service.js';
import { LoginRateLimiter } from './application/login-rate-limiter.js';
import { AuthController } from './infrastructure/http/auth.controller.js';
import { SessionGuard } from './infrastructure/http/session.guard.js';
import { SessionAwareUnmatchedRoute } from './infrastructure/http/unmatched-route.responder.js';

@Module({
  imports: [UsuariosModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    LoginRateLimiter,
    { provide: AUTH_SECRET, inject: [AuthService], useFactory: (auth: AuthService) => auth.secret },
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: UNMATCHED_ROUTE_RESPONDER, useClass: SessionAwareUnmatchedRoute },
  ],
  exports: [AuthService, AUTH_SECRET, UNMATCHED_ROUTE_RESPONDER],
})
export class AuthModule {}
