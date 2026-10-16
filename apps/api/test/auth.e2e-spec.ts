import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createSessionToken, sign } from '../src/auth/domain/session.js';
import { createTestApp } from './support/test-app.js';
import { CLAVE_PRUEBA, CORREO_PRUEBA, asegurarUsuarioActivo, iniciarSesion } from './support/sesion.js';
import { truncateAll } from './support/test-database.js';

const SESSION_SECRET = 'secreto-de-sesion-de-prueba-e2e-de-32-chars';

describe('Auth (e2e)', () => {
  let app: NestExpressApplication;
  const sleep = vi.fn(async () => undefined);

  beforeAll(async () => {
    app = await createTestApp({ sleep });
  });

  beforeEach(async () => {
    await truncateAll(app.get(DataSource));
    await asegurarUsuarioActivo(app.get(DataSource));
    sleep.mockClear();
  });

  afterAll(async () => {
    await app.close();
  });

  const login = (body: Record<string, unknown>) => request(app.getHttpServer()).post('/api/login').send(body);

  it('logs in with correo and clave, answers 200 {nombre} and sets the session cookie', async () => {
    const res = await login({ correo: CORREO_PRUEBA, clave: CLAVE_PRUEBA }).expect(200);
    expect(res.body).toEqual({ nombre: 'Ana' });
    expect(res.headers['set-cookie'][0]).toMatch(/^sesion=.+; HttpOnly; SameSite=Lax; Path=\/; Max-Age=2592000$/);
  });

  it('answers 401 with the generic message after the delay for a wrong clave', async () => {
    const res = await login({ correo: CORREO_PRUEBA, clave: 'otra-clave-larga' }).expect(401);
    expect(res.body).toEqual({ error: 'Correo o clave incorrectos.' });
    expect(sleep).toHaveBeenCalledWith(800);
  });

  it('answers the same 401 for an unknown correo', async () => {
    const res = await login({ correo: 'nadie@example.com', clave: CLAVE_PRUEBA }).expect(401);
    expect(res.body).toEqual({ error: 'Correo o clave incorrectos.' });
  });

  it('rejects an inactive account with the same 401 until the office activates it', async () => {
    await app.get(DataSource).query(`UPDATE usuarios SET activo = false`);
    await login({ correo: CORREO_PRUEBA, clave: CLAVE_PRUEBA }).expect(401);
    await app.get(DataSource).query(`UPDATE usuarios SET activo = true`);
    await login({ correo: CORREO_PRUEBA, clave: CLAVE_PRUEBA }).expect(200);
  });

  it('answers 400 when correo or clave is missing', async () => {
    const res = await login({ correo: CORREO_PRUEBA }).expect(400);
    expect(res.body).toEqual({ error: 'Correo y clave son obligatorios.' });
  });

  it('answers 429 after five failures from the same IP and correo', async () => {
    for (let intento = 0; intento < 5; intento++) {
      await login({ correo: 'limite@example.com', clave: 'mala-clave-larga' }).expect(401);
    }
    const res = await login({ correo: 'limite@example.com', clave: 'mala-clave-larga' }).expect(429);
    expect(res.body).toEqual({ error: 'Demasiados intentos. Intenta más tarde.' });
  });

  it('answers /yo with the session user for any method', async () => {
    const { cookie } = await iniciarSesion(app);
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
    const { cookie } = await iniciarSesion(app);
    const anonymous = await request(app.getHttpServer()).get('/api/no-existe').expect(401);
    expect(anonymous.body).toEqual({ error: 'Inicia sesión.' });
    const logged = await request(app.getHttpServer()).get('/api/no-existe').set('Cookie', cookie).expect(404);
    expect(logged.body).toEqual({ error: 'Ruta no encontrada.' });
    await request(app.getHttpServer()).get('/api/login').expect(401);
  });

  it('rejects a session signed with the legacy APP_PASSWORD-derived secret', async () => {
    const legacySecret = 'a'.repeat(64); // stands for sha256('s:' + old APP_PASSWORD)
    const value = Buffer.from(JSON.stringify(['Legado', Date.now() + 864e5])).toString('base64url');
    const cookie = `sesion=${encodeURIComponent(sign(legacySecret, value))}`;
    await request(app.getHttpServer()).get('/api/yo').set('Cookie', cookie).expect(401);
  });

  it('accepts a session token whose payload carries the user id', async () => {
    const token = createSessionToken(SESSION_SECRET, { id: 'u-1', nombre: 'Token' }, Date.now());
    const res = await request(app.getHttpServer())
      .get('/api/yo')
      .set('Cookie', `sesion=${encodeURIComponent(token)}`)
      .expect(200);
    expect(res.body).toEqual({ nombre: 'Token' });
  });
});
