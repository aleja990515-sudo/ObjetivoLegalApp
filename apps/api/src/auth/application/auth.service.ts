import { Inject, Injectable } from '@nestjs/common';
import { ApiError } from '../../common/http/api-error.js';
import { SLEEP, type Sleep } from '../../common/time/sleep.js';
import { LEGACY_DEFAULT_PASSWORD, type AppConfig } from '../../config/app-config.js';
import { InjectAppConfig } from '../../config/app-config.provider.js';
import {
  CLEAR_SESSION_COOKIE,
  deriveSecret,
  readSession,
  safeEqual,
  sessionCookie,
  type SessionUser,
} from '../domain/session.js';

export const LOGIN_FAILURE_DELAY_MS = 800;
export const AUTH_SECRET = Symbol('AUTH_SECRET');

export interface LoginResult {
  user: SessionUser;
  cookie: string;
}

/** Shared-password login and signed-cookie sessions (legacy compatible). */
@Injectable()
export class AuthService {
  readonly secret: string;

  constructor(
    @InjectAppConfig() private readonly config: AppConfig,
    @Inject(SLEEP) private readonly sleep: Sleep,
  ) {
    this.secret = deriveSecret(config.appPassword, config.sessionSecret);
  }

  async login(nombre: unknown, clave: unknown): Promise<LoginResult> {
    if (this.config.appPassword === LEGACY_DEFAULT_PASSWORD && this.config.vercel) {
      throw new ApiError(503, 'Falta configurar APP_PASSWORD en Vercel.');
    }
    if (!safeEqual(clave, this.config.appPassword) || !String(nombre || '').trim()) {
      await this.sleep(LOGIN_FAILURE_DELAY_MS); // slow down password guessing
      throw new ApiError(401, 'Nombre o clave incorrectos.');
    }
    const user = { nombre: String(nombre).trim().slice(0, 60) };
    const secure = this.config.vercel || this.config.nodeEnv === 'production';
    return { user, cookie: sessionCookie(this.secret, user.nombre, Date.now(), secure) };
  }

  readSession(cookieHeader: string | undefined): SessionUser | null {
    return readSession(this.secret, cookieHeader, Date.now());
  }

  get logoutCookie(): string {
    return CLEAR_SESSION_COOKIE;
  }
}
