import { createHash, createHmac } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { tokenAgenda } from '../src/agenda/domain/calendar-token.js';
import { PROCESO_REPOSITORY, type ProcesoRepository } from '../src/procesos/domain/proceso.repository.js';
import { proceso, tarea } from '../src/procesos/testing/proceso.fixtures.js';
import { BETO, asegurarUsuarioActivo, iniciarSesion } from './support/sesion.js';
import { createTestApp } from './support/test-app.js';
import { truncateAll } from './support/test-database.js';

// SESSION_SECRET of the e2e environment (vitest.config.e2e.ts).
const SECRET = 'secreto-de-sesion-de-prueba-e2e-de-32-chars';
/** The token of `usuarioId`; the calendar link is per user, so the url carries the id. */
const token = (usuarioId: string): string => tokenAgenda(SECRET, usuarioId);
/** The `?t=` part of a url, regex-escaped (the token carries a literal dot). */
const tokenEnUrl = (usuarioId: string): string =>
  `t=${tokenAgenda(SECRET, usuarioId).replaceAll('.', '\\.')}`;

describe('Agenda and ICS (e2e)', () => {
  let app: NestExpressApplication;
  let procesos: ProcesoRepository;
  let cookie: string;
  let ana: string;

  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
    procesos = app.get(PROCESO_REPOSITORY);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(app.get(DataSource));
    // The session is minted after the truncate: it empties `usuarios`, so a cookie from
    // `beforeAll` would name a deleted user and the calendar link would carry a dead id.
    ({ cookie, usuarioId: ana } = await iniciarSesion(app));
  });

  describe('GET /api/agenda', () => {
    it('requires a session', async () => {
      const res = await http().get('/api/agenda').expect(401);
      expect(res.body).toEqual({ error: 'Inicia sesión.' });
    });

    it('answers {tareas, hoy, ics} with the office tasks and the calendar link built from the forwarded origin', async () => {
      await procesos.insert(
        proceso('1', {
          usuarioId: ana,
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
      expect(res.body.ics).toBe(`https://misprocesos.test/api/agenda.ics?t=${token(ana)}`);
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

    it('lists only the tasks of the caller', async () => {
      const beto = await asegurarUsuarioActivo(app.get(DataSource), BETO);
      await procesos.insert(proceso('1', { usuarioId: ana, tareas: [tarea('t1')] }));
      await procesos.insert(proceso('2', { usuarioId: beto, tareas: [tarea('t2')] }));

      const { cookie: cookieBeto } = await iniciarSesion(app, BETO);

      const deAna = await http().get('/api/agenda').set('Cookie', cookie).expect(200);
      const deBeto = await http().get('/api/agenda').set('Cookie', cookieBeto).expect(200);

      expect(deAna.body.tareas.map((t: { id: string }) => t.id)).toEqual(['t1']);
      expect(deBeto.body.tareas.map((t: { id: string }) => t.id)).toEqual(['t2']);
      expect(deBeto.body.ics).not.toBe(deAna.body.ics);
    });

    it('falls back to http and the host header when no forwarded headers are sent', async () => {
      const res = await http().get('/api/agenda').set('Cookie', cookie).expect(200);
      expect(res.body.ics).toMatch(new RegExp(`^http://127\\.0\\.0\\.1:\\d+/api/agenda\\.ics\\?${tokenEnUrl(ana)}$`));
      expect(res.body.tareas).toEqual([]);
    });
  });

  describe('GET /api/agenda.ics', () => {
    beforeEach(async () => {
      await procesos.insert(
        proceso('1', {
          usuarioId: ana,
          radicado: '11001310300120190012300',
          alias: 'Caso',
          tareas: [tarea('t1', { titulo: 'Audiencia', fecha: '2026-03-10', hora: '14:00' })],
        }),
      );
    });

    it('serves the calendar publicly with the legacy headers when the token matches', async () => {
      const res = await http().get(`/api/agenda.ics?t=${token(ana)}`).expect(200);
      expect(res.headers['content-type']).toBe('text/calendar; charset=utf-8');
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.headers['content-disposition']).toBe('inline; filename="mis-procesos.ics"');
      expect(res.text.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
      expect(res.text).toContain('UID:t1@misprocesos\r\n');
      expect(res.text).toContain('DTSTART:20260310T190000Z\r\nDTEND:20260310T200000Z');
      expect(res.text.endsWith('END:VCALENDAR')).toBe(true);
    });

    it('never serves the tasks of another user through this user token', async () => {
      const beto = await asegurarUsuarioActivo(app.get(DataSource), BETO);
      await procesos.insert(
        proceso('2', { usuarioId: beto, radicado: '05001311001520260010001', tareas: [tarea('t2', { titulo: 'Secreto de Beto' })] }),
      );

      const res = await http().get(`/api/agenda.ics?t=${token(ana)}`).expect(200);
      expect(res.text).toContain('UID:t1@misprocesos\r\n');
      expect(res.text).not.toContain('UID:t2@misprocesos');
      expect(res.text).not.toContain('Secreto de Beto');
    });

    it.each([
      ['a wrong token', 'deadbeef'],
      ['a missing token', undefined],
    ])('answers 401 for %s with the legacy message and no-store', async (_, valor) => {
      const url = valor === undefined ? '/api/agenda.ics' : `/api/agenda.ics?t=${valor}`;
      const res = await http().get(url).expect(401);
      expect(res.body).toEqual({ error: 'Enlace de calendario inválido.' });
      expect(res.headers['cache-control']).toBe('no-store');
    });

    it('rejects a token whose user id was swapped but the signature kept', async () => {
      const [, firma] = token(ana).split('.');
      await http().get(`/api/agenda.ics?t=u-falso.${firma}`).expect(401);
    });

    it('accepts any HTTP method, like the legacy handler', async () => {
      await http().post(`/api/agenda.ics?t=${token(ana)}`).expect(200);
    });

    it('rejects the link derived from the retired APP_PASSWORD secret', async () => {
      const claveAntigua = createHash('sha256').update('s:clave-de-prueba').digest('hex');
      const tokenAntiguo = createHmac('sha256', claveAntigua).update('agenda-ics').digest('hex').slice(0, 32);
      await http().get(`/api/agenda.ics?t=${tokenAntiguo}`).expect(401);
    });
  });
});