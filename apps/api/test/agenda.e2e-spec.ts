import { createHmac } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { PROCESO_REPOSITORY, type ProcesoRepository } from '../src/procesos/domain/proceso.repository.js';
import { proceso, tarea } from '../src/procesos/testing/proceso.fixtures.js';
import { iniciarSesion } from './support/sesion.js';
import { createTestApp } from './support/test-app.js';
import { truncateAll } from './support/test-database.js';

// SESSION_SECRET of the e2e environment (vitest.config.e2e.ts).
const SECRET = 'secreto-de-sesion-de-prueba-e2e-de-32-chars';
const TOKEN = createHmac('sha256', SECRET).update('agenda-ics').digest('hex').slice(0, 32);

describe('Agenda and ICS (e2e)', () => {
  let app: NestExpressApplication;
  let procesos: ProcesoRepository;
  let cookie: string;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    procesos = app.get(PROCESO_REPOSITORY);
    cookie = await iniciarSesion(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(app.get(DataSource));
  });

  describe('GET /api/agenda', () => {
    it('requires a session', async () => {
      const res = await http().get('/api/agenda').expect(401);
      expect(res.body).toEqual({ error: 'Inicia sesión.' });
    });

    it('answers {tareas, hoy, ics} with the office tasks and the calendar link built from the forwarded origin', async () => {
      await procesos.insert(
        proceso('1', {
          radicado: '11001310300120190012300',
          alias: 'Caso',
          tareas: [tarea('t1', { titulo: 'Audiencia', fecha: '2026-03-10', hora: '14:00' })],
        }),
      );

      const res = await http()
        .get('/api/agenda')
        .set('Cookie', cookie)
        .set('x-forwarded-proto', 'https')
        .set('x-forwarded-host', 'misprocesos.test')
        .expect(200);

      expect(res.body.hoy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(res.body.ics).toBe(`https://misprocesos.test/api/agenda.ics?t=${TOKEN}`);
      expect(res.body.tareas).toEqual([
        expect.objectContaining({
          id: 't1',
          titulo: 'Audiencia',
          fecha: '2026-03-10',
          hora: '14:00',
          idProceso: '1',
          radicado: '11001310300120190012300',
          alias: 'Caso',
          despacho: 'JUZGADO 001 CIVIL DEL CIRCUITO',
        }),
      ]);
    });

    it('falls back to http and the host header when no forwarded headers are sent', async () => {
      const res = await http().get('/api/agenda').set('Cookie', cookie).expect(200);
      expect(res.body.ics).toMatch(new RegExp(`^http://127\\.0\\.0\\.1:\\d+/api/agenda\\.ics\\?t=${TOKEN}$`));
      expect(res.body.tareas).toEqual([]);
    });
  });

  describe('GET /api/agenda.ics', () => {
    beforeEach(async () => {
      await procesos.insert(
        proceso('1', {
          radicado: '11001310300120190012300',
          alias: 'Caso',
          tareas: [tarea('t1', { titulo: 'Audiencia', fecha: '2026-03-10', hora: '14:00' })],
        }),
      );
    });

    it('serves the calendar publicly with the legacy headers when the token matches', async () => {
      const res = await http().get(`/api/agenda.ics?t=${TOKEN}`).expect(200);
      expect(res.headers['content-type']).toBe('text/calendar; charset=utf-8');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['content-disposition']).toBe('inline; filename="mis-procesos.ics"');
      expect(res.text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
      expect(res.text).toContain('UID:t1@misprocesos\r\n');
      expect(res.text).toContain('DTSTART:20260310T190000Z\r\nDTEND:20260310T200000Z');
      expect(res.text.endsWith('END:VCALENDAR')).toBe(true);
    });

    it.each([
      ['a wrong token', 'deadbeef'],
      ['a missing token', undefined],
    ])('answers 401 for %s with the legacy message and no-store', async (_, token) => {
      const url = token === undefined ? '/api/agenda.ics' : `/api/agenda.ics?t=${token}`;
      const res = await http().get(url).expect(401);
      expect(res.body).toEqual({ error: 'Enlace de calendario inválido.' });
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('accepts any HTTP method, like the legacy handler', async () => {
      await http().post(`/api/agenda.ics?t=${TOKEN}`).expect(200);
    });
  });
});
