import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { PROCESO_REPOSITORY, type ProcesoRepository } from '../src/procesos/domain/proceso.repository.js';
import { encontrado, FakeCpnu } from '../src/procesos/testing/fake-cpnu.js';
import { actuacion } from '../src/procesos/testing/proceso.fixtures.js';
import { BETO, iniciarSesion } from './support/sesion.js';
import { createTestApp } from './support/test-app.js';
import { truncateAll } from './support/test-database.js';

// Two lawyers on the same expediente. `procesos.id_proceso` used to be the global
// primary key, so the second one to add it got 409 and could use that answer to probe
// the office's caseload. Now each user owns a copy and the 409 means "you follow it".
const RADICADO = '11001310300120190012300';
const CRON = 'Bearer cron-de-prueba';

describe('Two users follow the same expediente (e2e)', () => {
  let app: NestExpressApplication;
  let cpnu: FakeCpnu;
  let procesos: ProcesoRepository;
  let ana: { cookie: string; usuarioId: string };
  let beto: { cookie: string; usuarioId: string };

  const http = () => request(app.getHttpServer());
  const agregar = (cookie: string, alias?: string) =>
    http().post('/api/procesos').set('Cookie', cookie).send({ radicado: RADICADO, alias });

  beforeAll(async () => {
    cpnu = new FakeCpnu();
    app = await createTestApp({ cpnu });
    procesos = app.get(PROCESO_REPOSITORY);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(app.get(DataSource));
    cpnu.radicados.clear();
    cpnu.procesos.clear();
    cpnu.calls.length = 0;
    cpnu.radicados.set(RADICADO, [encontrado('1')]);
    cpnu.procesos.set('1', { detalle: { despacho: 'J' }, sujetos: [], actuaciones: [actuacion(1)] });
    // Both sessions are minted after the truncate, which empties `usuarios`.
    ana = await iniciarSesion(app);
    beto = await iniciarSesion(app, BETO);
  });

  it('answers 201 to the second user, who gets an independent copy with its own notas and tareas', async () => {
    const deAna = await agregar(ana.cookie, 'Caso de Ana').expect(201);
    expect(deAna.body.agregados[0]).toMatchObject({ idProceso: '1', alias: 'Caso de Ana' });

    // The headline case: this was 409 while `id_proceso` was the global key.
    const deBeto = await agregar(beto.cookie, 'Caso de Beto').expect(201);
    expect(deBeto.body.agregados[0]).toMatchObject({ idProceso: '1', alias: 'Caso de Beto' });

    await http()
      .post('/api/procesos/1/notas')
      .set('Cookie', ana.cookie)
      .send({ texto: 'Nota de Ana' })
      .expect(201);
    await http()
      .post('/api/procesos/1/tareas')
      .set('Cookie', beto.cookie)
      .send({ titulo: 'Tarea de Beto', fecha: '2026-03-10' })
      .expect(201);

    const detalleAna = await http().get('/api/procesos/1').set('Cookie', ana.cookie).expect(200);
    const detalleBeto = await http().get('/api/procesos/1').set('Cookie', beto.cookie).expect(200);

    expect(detalleAna.body).toMatchObject({ alias: 'Caso de Ana', notas: [expect.objectContaining({ texto: 'Nota de Ana' })] });
    expect(detalleAna.body.tareas).toEqual([]);
    expect(detalleBeto.body).toMatchObject({ alias: 'Caso de Beto', tareas: [expect.objectContaining({ titulo: 'Tarea de Beto' })] });
    expect(detalleBeto.body.notas).toEqual([]);
  });

  it('gives each user its own copy of GET /procesos/1, with no cross-contaminated actuaciones', async () => {
    await agregar(ana.cookie).expect(201);
    await agregar(beto.cookie).expect(201);
    // Ana refreshes, Beto does not: the actuaciones must not leak into Beto's copy.
    cpnu.procesos.set('1', { detalle: { despacho: 'J' }, sujetos: [], actuaciones: [actuacion(2), actuacion(1)] });
    await http().post('/api/procesos/1/actualizar').set('Cookie', ana.cookie).expect(200);

    const deAna = await http().get('/api/procesos/1').set('Cookie', ana.cookie).expect(200);
    const deBeto = await http().get('/api/procesos/1').set('Cookie', beto.cookie).expect(200);

    expect(deAna.body.actuaciones.map((a: { id: number }) => a.id)).toEqual([2, 1]);
    expect(deBeto.body.actuaciones.map((a: { id: number }) => a.id)).toEqual([1]);
  });

  it('deletes only the copy of the user that asks for it', async () => {
    await agregar(ana.cookie).expect(201);
    await agregar(beto.cookie).expect(201);
    await http()
      .post('/api/procesos/1/notas')
      .set('Cookie', ana.cookie)
      .send({ texto: 'Solo de Ana' })
      .expect(201);

    await http().delete('/api/procesos/1').set('Cookie', beto.cookie).expect(200);

    await http().get('/api/procesos/1').set('Cookie', beto.cookie).expect(404);
    const deAna = await http().get('/api/procesos/1').set('Cookie', ana.cookie).expect(200);
    expect(deAna.body.notas).toEqual([expect.objectContaining({ texto: 'Solo de Ana' })]);
    expect(await procesos.findById('1', ana.usuarioId)).not.toBeNull();
    expect(await procesos.findById('1', beto.usuarioId)).toBeNull();
  });

  it('keeps the 409 meaning only "you already follow it", not "a colleague does"', async () => {
    // Nobody follows it: the first user gets 201.
    await agregar(ana.cookie).expect(201);
    // The same user repeating the add still gets 409.
    const repetido = await agregar(ana.cookie).expect(409);
    expect(repetido.body).toEqual({ error: 'Ese proceso ya está en la lista.' });

    // A colleague following it is invisible: Beto gets 201 too.
    await agregar(beto.cookie).expect(201);
    const repetidoBeto = await agregar(beto.cookie).expect(409);
    expect(repetidoBeto.body).toEqual({ error: 'Ese proceso ya está en la lista.' });
  });

  it('refreshes every row of the cron, including the two copies of one id_proceso', async () => {
    await agregar(ana.cookie).expect(201);
    await agregar(beto.cookie).expect(201);
    cpnu.procesos.set('1', { detalle: {}, sujetos: [], actuaciones: [actuacion(3), actuacion(1)] });

    await request(app.getHttpServer()).post('/api/cron').set('Authorization', CRON).expect(200);

    for (const usuario of [ana, beto]) {
      const copia = await procesos.findById('1', usuario.usuarioId);
      expect(copia?.actuaciones.map((a) => a.id)).toEqual([3, 1]);
      expect(copia?.noVistas).toEqual([3]);
    }
    // Two rows, one `id_proceso`: the surrogate is what keeps them apart.
    const filas = await procesos.listRefsForReview();
    expect(filas).toHaveLength(2);
    expect(new Set(filas.map((r) => r.id)).size).toBe(2);
  });
});
