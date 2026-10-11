import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ApiError } from '../../common/http/api-error.js';
import { SLEEP, type Sleep } from '../../common/time/sleep.js';
import { epochMsAhora } from '../../common/time/temporal.js';
import type { AppConfig } from '../../config/app-config.js';
import { InjectAppConfig } from '../../config/app-config.provider.js';
import { normalizarCorreo } from '../../usuarios/domain/registro.js';
import { USUARIO_REPOSITORY, type UsuarioRepository } from '../../usuarios/domain/usuario.repository.js';
import {
  CLEAR_SESSION_COOKIE,
  readSession,
  sessionCookie,
  type SessionUser,
} from '../domain/session.js';
import { PASSWORD_HASHER, type PasswordHasher } from './ports/password-hasher.port.js';
import { LoginRateLimiter } from './login-rate-limiter.js';

export const LOGIN_FAILURE_DELAY_MS = 800;
export const CREDENCIALES_INCORRECTAS = 'Correo o clave incorrectos.';
export const DEMASIADOS_INTENTOS = 'Demasiados intentos. Intenta más tarde.';
export const AUTH_SECRET = Symbol('AUTH_SECRET');

export interface LoginResult {
  user: SessionUser;
  cookie: string;
}

/** Inicio de sesión por correo y clave, con sesiones firmadas que llevan el id del usuario. */
@Injectable()
export class AuthService {
  readonly secret: string;
  private senuelo: Promise<string> | null = null;

  constructor(
    @InjectAppConfig() private readonly config: AppConfig,
    @Inject(SLEEP) private readonly sleep: Sleep,
    @Inject(USUARIO_REPOSITORY) private readonly usuarios: UsuarioRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
    private readonly limiter: LoginRateLimiter,
  ) {
    this.secret = config.sessionSecret;
  }

  /** `ip` identifica al cliente para el límite de intentos (IP + correo). */
  async login(correo: unknown, clave: unknown, ip: string): Promise<LoginResult> {
    if (typeof correo !== 'string' || typeof clave !== 'string' || !correo.trim() || !clave) {
      throw new ApiError(400, 'Correo y clave son obligatorios.');
    }
    const normalizado = normalizarCorreo(correo);
    const clienteLimitado = `${ip}|${normalizado}`;
    if (this.limiter.bloqueado(clienteLimitado)) throw new ApiError(429, DEMASIADOS_INTENTOS);

    const cuenta = await this.usuarios.buscarPorCorreo(normalizado);
    // Always run one scrypt verification, so unknown correos cost the same time as known ones.
    const coincide = await this.hasher.verify(clave, cuenta?.passwordHash ?? (await this.senueloHash()));
    if (!cuenta || !coincide || !cuenta.usuario.activo) {
      this.limiter.registrarFallo(clienteLimitado);
      await this.sleep(LOGIN_FAILURE_DELAY_MS); // slow down password guessing
      throw new ApiError(401, CREDENCIALES_INCORRECTAS);
    }

    if (this.hasher.needsRehash(cuenta.passwordHash)) {
      await this.usuarios.actualizarClave(normalizado, await this.hasher.hash(clave));
    }
    this.limiter.limpiar(clienteLimitado);

    const user: SessionUser = { id: cuenta.usuario.id, nombre: cuenta.usuario.nombre };
    const secure = this.config.vercel || this.config.nodeEnv === 'production';
    return { user, cookie: sessionCookie(this.secret, user, epochMsAhora(), secure) };
  }

  readSession(cookieHeader: string | undefined): SessionUser | null {
    return readSession(this.secret, cookieHeader, epochMsAhora());
  }

  get logoutCookie(): string {
    return CLEAR_SESSION_COOKIE;
  }

  /** Hash de una clave aleatoria, calculado una vez, para igualar el tiempo de una cuenta inexistente. */
  private senueloHash(): Promise<string> {
    this.senuelo ??= this.hasher.hash(randomUUID());
    return this.senuelo;
  }
}
