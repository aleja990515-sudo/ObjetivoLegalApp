import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { META_REPOSITORY, META_ULTIMA_REVISION, type MetaRepository } from '../src/procesos/domain/meta.repository.js';
import { PROCESO_REPOSITORY, type ProcesoRepository } from '../src/procesos/domain/proceso.repository.js';
import { encontrado, FakeCpnu } from '../src/procesos/testing/fake-cpnu.js';
import { actuacion, proceso } from '../src/procesos/testing/proceso.fixtures.js';
import { asegurarUsuarioActivo, BETO } from './support/sesion.js';
import { createTestApp } from './support/test-app.js';
import { truncateAll } from './support/test-database.js';

const RADICADO = '11001310300120190012300';

describe('Review: /api/cron and /api/salud (e2e)', () => {
  let app: NestExpressApplication;
  let cpnu: FakeCpnu;
  let procesos: ProcesoRepository;
  let ana: string;
  const sleep = vi.fn(async (_ms: number) => undefined);

  beforeAll(async () => {
    cpnu = new FakeCpnu();
    app = await createTestApp({ cpnu, sleep });
    procesos = app.get(PROCESO_REPOSITORY);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(app.get(DataSource));
    // The cron has no session, but `procesos.usuario_id` is still a real FK.
    ana = await asegurarUsuarioActivo(app.get(DataSource));
    cpnu.radicados.clear();
    cpnu.procesos.clear();
    sleep.mockClear();
  });

  describe('/api/cron', () => {
    it.each([undefined, 'Bearer otro', 'cron-de-prueba'])('rejects authorization %s with 401', async (auth) => {
      const req = request(app.getHttpServer()).get('/api/cron');
      if (auth) req.set('Authorization', auth);
      const res = await req.expect(401);
      expect(res.body).toEqual({ error: 'No autorizado' });
    });

    it('reviews every proceso and stores the results in Postgres', async () => {
      await procesos.insert(proceso('1', { usuarioId: ana, radicado: RADICADO, alias: 'Caso', actuaciones: [actuacion(1)] }));
      cpnu.procesos.set('1', { detalle: { despacho: 'J' }, sujetos: [], actuaciones: [actuacion(2), actuacion(1)] });
      cpnu.radicados.set(RADICADO, [encontrado('1'), encontrado('2')]);

      const res = await request(app.getHttpServer())
        .post('/api/cron')
        .set('Authorization', 'Bearer cron-de-prueba')
        .expect(200);

      expect(res.body).toEqual({ nuevas: 1, instancias: 1, errores: 0 });
      expect(await procesos.findByIdForReview('1')).toMatchObject({ noVistas: [2], alias: 'Caso', detalle: { despacho: 'J' } });
      expect(await procesos.findByIdForReview('2')).toMatchObject({
        alias: 'Caso (nueva instancia)',
        nuevaInstancia: true,
        agregadoPor: 'Revisión automática',
      });
      expect(await app.get<MetaRepository>(META_REPOSITORY).get(META_ULTIMA_REVISION)).toEqual(expect.any(String));
      expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 500]);
    });

    it('refreshes the procesos of every user: the cron reads in the system scope', async () => {
      const beto = await asegurarUsuarioActivo(app.get(DataSource), BETO);
      await procesos.insert(proceso('1', { usuarioId: ana, radicado: RADICADO, actuaciones: [actuacion(1)] }));
      await procesos.insert(proceso('2', { usuarioId: beto, radicado: '05001311001520260010001', actuaciones: [actuacion(1)] }));
      cpnu.procesos.set('1', { detalle: { despacho: 'J' }, sujetos: [], actuaciones: [actuacion(3), actuacion(1)] });
      cpnu.procesos.set('2', { detalle: { despacho: 'J' }, sujetos: [], actuaciones: [actuacion(4), actuacion(1)] });

      const res = await request(app.getHttpServer())
        .post('/api/cron')
        .set('Authorization', 'Bearer cron-de-prueba')
        .expect(200);

      expect(res.body).toEqual({ nuevas: 2, instancias: 0, errores: 0 });
      expect(await procesos.findByIdForReview('1')).toMatchObject({ noVistas: [3] });
      expect(await procesos.findByIdForReview('2')).toMatchObject({ noVistas: [4] });
    });

    it('rejects every request when CRON_SECRET is not configured', async () => {
      const noSecret = await createTestApp({ cpnu, config: { cronSecret: null } });
      try {
        await request(noSecret.getHttpServer()).get('/api/cron').set('Authorization', 'Bearer ').expect(401);
      } finally {
        await noSecret.close();
      }
    });
  });

  describe('/api/salud', () => {
    it('reports "ok" when CPNU answers', async () => {
      const res = await request(app.getHttpServer()).get('/api/salud').expect(200);
      expect(res.body.rama).toBe('ok');
      expect(cpnu.calls).toContain(`search:${RADICADO}`);
    });

    it('reports the CPNU error message otherwise', async () => {
      cpnu.radicados.set(RADICADO, new Error('La Rama Judicial respondió 503'));
      const res = await request(app.getHttpServer()).get('/api/salud').expect(200);
      expect(res.body.rama).toBe('La Rama Judicial respondió 503');
    });
  });
});
