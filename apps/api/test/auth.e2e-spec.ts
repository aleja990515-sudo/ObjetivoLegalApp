import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';

const LEGACY_APP = new URL('../../../lib/app.js', import.meta.url);

/** Runs the real legacy handler (lib/app.js) for a login and returns its Set-Cookie. */
async function legacyLoginCookie(nombre: string, clave: string): Promise<string> {
  const legacy = createRequire(import.meta.url)(LEGACY_APP.pathname) as {
    handle: (req: unknown, res: unknown) => Promise<void>;
  };
  let headers: Record<string, string> = {};
  let status = 0;
  await legacy.handle(
    { url: '/api/login', method: 'POST', headers: {}, body: { nombre, clave } },
    {
      writeHead: (code: number, h: Record<string, string>) => ((status = code), (headers = h)),
      end: () => undefined,
    },
  );
  expect(status).toBe(200);
  return headers['Set-Cookie'];
}

describe('Auth (e2e)', () => {
  let app: NestExpressApplication;
  const sleep = vi.fn(async () => undefined);

  beforeAll(async () => {
    app = await createTestApp({ sleep });
  });

  afterAll(async () => {
    await app.close();
  });

  const login = (nombre = 'Ana') =>
    request(app.getHttpServer()).post('/api/login').send({ nombre, clave: 'clave-de-prueba' });

  it('logs in, answers 200 {nombre} and sets the session cookie', async () => {
    const res = await login('  Ana  ').expect(200);
    expect(res.body).toEqual({ nombre: 'Ana' });
    expect(res.headers['set-cookie'][0]).toMatch(/^sesion=.+; HttpOnly; SameSite=Lax; Path=\/; Max-Age=2592000$/);
  });

  it('rejects wrong credentials with the legacy message after the delay', async () => {
    sleep.mockClear();
    const res = await request(app.getHttpServer())
      .post('/api/login')
      .send({ nombre: 'Ana', clave: 'mala' })
      .expect(401);
    expect(res.body).toEqual({ error: 'Nombre o clave incorrectos.' });
    expect(sleep).toHaveBeenCalledWith(800);
  });

  it('answers /yo with the session user for any method', async () => {
    const cookie = (await login()).headers['set-cookie'][0].split(';')[0];
    for (const method of ['get', 'post', 'put'] as const) {
      const res = await request(app.getHttpServer())[method]('/api/yo').set('Cookie', cookie).expect(200);
      expect(res.body).toEqual({ nombre: 'Ana' });
    }
  });

  it('answers /yo without a session with 401 "Sin sesión"', async () => {
    const res = await request(app.getHttpServer()).get('/api/yo').expect(401);
    expect(res.body).toEqual({ error: 'Sin sesión' });
  });

  it('logs out with any method by clearing the cookie', async () => {
    const res = await request(app.getHttpServer()).delete('/api/logout').expect(200);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers['set-cookie']).toEqual(['sesion=; Path=/; Max-Age=0']);
  });

  it('checks the session before routing, like the legacy API', async () => {
    const cookie = (await login()).headers['set-cookie'][0].split(';')[0];
    const anonymous = await request(app.getHttpServer()).get('/api/no-existe').expect(401);
    expect(anonymous.body).toEqual({ error: 'Inicia sesión.' });
    const logged = await request(app.getHttpServer()).get('/api/no-existe').set('Cookie', cookie).expect(404);
    expect(logged.body).toEqual({ error: 'Ruta no encontrada.' });
    // Only POST /login exists.
    await request(app.getHttpServer()).get('/api/login').expect(401);
  });

  it.skipIf(!existsSync(LEGACY_APP))('accepts a cookie issued by the legacy server (lib/app.js)', async () => {
    const setCookie = await legacyLoginCookie('Legado', 'clave-de-prueba');
    const res = await request(app.getHttpServer()).get('/api/yo').set('Cookie', setCookie.split(';')[0]).expect(200);
    expect(res.body).toEqual({ nombre: 'Legado' });
  });
});
