import type { AppConfig } from '../../config/app-config.js';
import { loadAppConfig } from '../../config/app-config.js';
import type { CuentaConClave, Usuario } from '../../usuarios/domain/usuario.js';
import type { UsuarioRepository } from '../../usuarios/domain/usuario.repository.js';
import { readSession } from '../domain/session.js';
import { randomBytes } from 'node:crypto';
import {
  ScryptPasswordHasher,
  derivarScrypt,
  formatScryptHash,
} from '../infrastructure/crypto/scrypt-password-hasher.js';
import { AuthService, LOGIN_FAILURE_DELAY_MS } from './auth.service.js';
import { LoginRateLimiter } from './login-rate-limiter.js';

const SECRET = 'secreto-de-sesion-de-prueba-de-32-chars';
const CLAVE = 'clave-de-prueba-larga';
const hasher = new ScryptPasswordHasher();

/** Repositorio en memoria con una cuenta activa y una inactiva. */
type CuentaConCorreo = CuentaConClave & { correo: string };

function repositorio(cuentas: CuentaConCorreo[]): UsuarioRepository & { cuentas: CuentaConCorreo[] } {
  const repo = {
    cuentas,
    async buscarPorCorreo(correo: string) {
      return repo.cuentas.find((c) => c.correo === correo) ?? null;
    },
    async existeCedulaOCorreo() {
      return false;
    },
    async crear(): Promise<Usuario> {
      throw new Error('no usado');
    },
    async actualizarActivo() {
      return true;
    },
    async actualizarClave(correo: string, passwordHash: string) {
      const cuenta = repo.cuentas.find((c) => c.correo === correo);
      if (cuenta) cuenta.passwordHash = passwordHash;
      return Boolean(cuenta);
    },
  };
  return repo as UsuarioRepository & { cuentas: CuentaConCorreo[] };
}

async function cuenta(activo: boolean, correo = 'ana@example.com'): Promise<CuentaConCorreo> {
  return {
    correo,
    usuario: { id: 'u-1', nombre: 'Ana María', activo },
    passwordHash: await hasher.hash(CLAVE),
  };
}

function servicio(env: Record<string, string> = {}, cuentas: CuentaConCorreo[] = []) {
  const config: AppConfig = loadAppConfig({
    DATABASE_URL: 'postgres://x',
    SESSION_SECRET: SECRET,
    ...env,
  });
  const sleep = vi.fn(async () => undefined);
  const repo = repositorio(cuentas);
  const auth = new AuthService(config, sleep, repo, hasher, new LoginRateLimiter());
  return { auth, sleep, repo };
}

describe('AuthService', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('logs in an active account by correo and signs the session with its id', async () => {
    const { auth, sleep } = servicio({}, [await cuenta(true)]);
    const { user, cookie } = await auth.login('Ana@Example.com ', CLAVE, '10.0.0.1');
    expect(user).toEqual({ id: 'u-1', nombre: 'Ana María' });
    expect(cookie).toMatch(/^sesion=[^;]+; HttpOnly; SameSite=Lax; Path=\/; Max-Age=2592000$/);
    expect(readSession(auth.secret, cookie.split(';')[0], Date.now())).toEqual(user);
    expect(sleep).not.toHaveBeenCalled();
  });

  it.each([
    ['wrong clave', 'ana@example.com', 'otra-clave-larga'],
    ['unknown correo', 'nadie@example.com', CLAVE],
    ['inactive account', 'inactiva@example.com', CLAVE],
  ])('answers the same generic 401 after the delay for %s', async (_case, correo, clave) => {
    const { auth, sleep } = servicio({}, [await cuenta(true), await cuenta(false, 'inactiva@example.com')]);
    await expect(auth.login(correo, clave, '10.0.0.1')).rejects.toMatchObject({
      response: { error: 'Correo o clave incorrectos.' },
      status: 401,
    });
    expect(sleep).toHaveBeenCalledWith(LOGIN_FAILURE_DELAY_MS);
  });

  it('rejects missing or blank fields with 400 and no delay', async () => {
    const { auth, sleep } = servicio({}, [await cuenta(true)]);
    await expect(auth.login(undefined, CLAVE, 'ip')).rejects.toMatchObject({ status: 400 });
    await expect(auth.login('ana@example.com', undefined, 'ip')).rejects.toMatchObject({ status: 400 });
    await expect(auth.login('   ', CLAVE, 'ip')).rejects.toMatchObject({ status: 400 });
    expect(sleep).not.toHaveBeenCalled();
  });

  it('blocks the sixth failure within 15 minutes per IP and correo with 429, then frees it', async () => {
    const { auth, sleep } = servicio({}, [await cuenta(true)]);
    for (let intento = 0; intento < 5; intento++) {
      await expect(auth.login('ana@example.com', 'mala-clave-larga', '10.0.0.9')).rejects.toMatchObject({ status: 401 });
    }
    await expect(auth.login('ana@example.com', CLAVE, '10.0.0.9')).rejects.toMatchObject({
      status: 429,
      response: { error: 'Demasiados intentos. Intenta más tarde.' },
    });
    // Another IP is not affected.
    await expect(auth.login('ana@example.com', CLAVE, '10.0.0.10')).resolves.toBeDefined();
    sleep.mockClear();
    vi.setSystemTime(Date.now() + 15 * 60_000 + 1);
    await expect(auth.login('ana@example.com', CLAVE, '10.0.0.9')).resolves.toBeDefined();
  });

  it('clears the failure count after a successful login', async () => {
    const { auth } = servicio({}, [await cuenta(true)]);
    for (let intento = 0; intento < 4; intento++) {
      await expect(auth.login('ana@example.com', 'mala-clave-larga', 'ip')).rejects.toMatchObject({ status: 401 });
    }
    await auth.login('ana@example.com', CLAVE, 'ip');
    for (let intento = 0; intento < 4; intento++) {
      await expect(auth.login('ana@example.com', 'mala-clave-larga', 'ip')).rejects.toMatchObject({ status: 401 });
    }
    await expect(auth.login('ana@example.com', CLAVE, 'ip')).resolves.toBeDefined();
  });

  it('upgrades a hash made with old parameters after a successful login', async () => {
    const antiguos = { N: 16384, r: 8, p: 1 };
    const salt = randomBytes(16);
    const antiguo = formatScryptHash(antiguos, salt, await derivarScrypt(CLAVE, salt, antiguos));
    const { auth, repo } = servicio({}, [{ ...(await cuenta(true)), passwordHash: antiguo }]);
    await auth.login('ana@example.com', CLAVE, 'ip');
    expect(repo.cuentas[0].passwordHash).not.toBe(antiguo);
    expect(repo.cuentas[0].passwordHash).toContain('$32768$');
  });

  it('marks the cookie Secure in production or on Vercel', async () => {
    const cuentas = [await cuenta(true)];
    expect((await servicio({ NODE_ENV: 'production' }, cuentas).auth.login('ana@example.com', CLAVE, 'ip')).cookie).toMatch(
      /; Secure$/,
    );
    expect((await servicio({ VERCEL: '1' }, cuentas).auth.login('ana@example.com', CLAVE, 'ip')).cookie).toMatch(
      /; Secure$/,
    );
  });
});
