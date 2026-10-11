import type { AppConfig } from '../../config/app-config.js';
import { loadAppConfig } from '../../config/app-config.js';
import { readSession } from '../domain/session.js';
import { AuthService, LOGIN_FAILURE_DELAY_MS } from './auth.service.js';

function service(env: Record<string, string> = {}) {
  const config: AppConfig = loadAppConfig({ DATABASE_URL: 'postgres://x', APP_PASSWORD: 'secreta', ...env });
  const sleep = vi.fn(async () => undefined);
  return { auth: new AuthService(config, sleep), sleep };
}

describe('AuthService', () => {
  it('logs in with the shared password and trims/limits the name', async () => {
    const { auth, sleep } = service();
    const { user, cookie } = await auth.login(`  ${'x'.repeat(70)}  `, 'secreta');
    expect(user).toEqual({ nombre: 'x'.repeat(60) });
    expect(cookie).toMatch(/^sesion=[^;]+; HttpOnly; SameSite=Lax; Path=\/; Max-Age=2592000$/);
    expect(readSession(auth.secret, cookie.split(';')[0], Temporal.Now.instant().epochMilliseconds)).toEqual(user);
    expect(sleep).not.toHaveBeenCalled();
  });

  it.each([
    ['wrong password', 'Ana', 'otra'],
    ['missing password', 'Ana', undefined],
    ['blank name', '   ', 'secreta'],
    ['missing name', undefined, 'secreta'],
  ])('rejects %s after an 800ms delay', async (_case, nombre, clave) => {
    const { auth, sleep } = service();
    await expect(auth.login(nombre, clave)).rejects.toMatchObject({
      response: { error: 'Nombre o clave incorrectos.' },
      status: 401,
    });
    expect(sleep).toHaveBeenCalledWith(LOGIN_FAILURE_DELAY_MS);
  });

  it('refuses to log in on Vercel with the default password', async () => {
    const { auth } = service({ APP_PASSWORD: '', VERCEL: '1' });
    await expect(auth.login('Ana', 'cambiar-esta-clave')).rejects.toMatchObject({
      response: { error: 'Falta configurar APP_PASSWORD en Vercel.' },
      status: 503,
    });
  });

  it('marks the cookie Secure in production or on Vercel', async () => {
    expect((await service({ NODE_ENV: 'production' }).auth.login('Ana', 'secreta')).cookie).toMatch(/; Secure$/);
    expect((await service({ VERCEL: '1' }).auth.login('Ana', 'secreta')).cookie).toMatch(/; Secure$/);
  });

  it('uses SESSION_SECRET when configured', () => {
    expect(service({ SESSION_SECRET: 'otro' }).auth.secret).toBe('otro');
  });
});
