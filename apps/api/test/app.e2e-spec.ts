import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createTestApp } from './support/test-app.js';

describe('HTTP shell (e2e)', () => {
  let app: NestExpressApplication;
  const publicDir = mkdtempSync(join(tmpdir(), 'api-public-'));

  beforeAll(async () => {
    writeFileSync(join(publicDir, 'index.html'), '<!doctype html><title>Mis Procesos</title>');
    writeFileSync(join(publicDir, 'styles.css'), 'body{}');
    writeFileSync(join(publicDir, 'font.woff2'), Buffer.from([0x77, 0x4f, 0x46, 0x32]));
    writeFileSync(join(publicDir, 'manifest.webmanifest'), '{}');
    app = await createTestApp({ config: { publicDir } });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/api/salud', () => {
    it.each(['get', 'post', 'delete'] as const)('answers %s with the diagnostics shape', async (method) => {
      const res = await request(app.getHttpServer())[method]('/api/salud').expect(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toMatchObject({ baseDeDatos: 'postgres', claveConfigurada: true, region: 'local' });
      expect(typeof res.body.rama).toBe('string');
    });
  });

  describe('static frontend', () => {
    it('serves index.html at /', async () => {
      const res = await request(app.getHttpServer()).get('/').expect(200);
      expect(res.headers['content-type']).toBe('text/html; charset=utf-8');
      expect(res.text).toContain('Mis Procesos');
    });

    it.each([
      ['/styles.css', 'text/css; charset=utf-8'],
      ['/font.woff2', 'font/woff2'],
      ['/manifest.webmanifest', 'application/manifest+json; charset=utf-8'],
    ])('serves %s as %s', async (path, type) => {
      const res = await request(app.getHttpServer()).get(path).expect(200);
      expect(res.headers['content-type']).toBe(type);
      expect(res.headers['cache-control']).toBe('no-cache');
    });

    it('falls back to index.html for unknown non-API paths', async () => {
      const res = await request(app.getHttpServer()).get('/procesos/123').expect(200);
      expect(res.text).toContain('Mis Procesos');
    });

    it('never falls back to index.html under /api', async () => {
      // Without a session an unknown API path answers 401 like the legacy server (see auth e2e).
      const res = await request(app.getHttpServer()).get('/api/no-existe').expect(401);
      expect(res.body).toEqual({ error: 'Inicia sesión.' });
    });
  });

  describe('JSON bodies', () => {
    it('answers 400 {error} for malformed JSON', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/salud')
        .set('Content-Type', 'application/json')
        .send('{malo')
        .expect(400);
      expect(res.body).toEqual({ error: 'JSON inválido' });
    });

    it('answers 413 {error} for bodies over 100kb', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/salud')
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ x: 'a'.repeat(110_000) }))
        .expect(413);
      expect(res.body).toEqual({ error: 'El cuerpo de la solicitud es demasiado grande.' });
    });
  });
});
