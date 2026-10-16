import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { PROCESO_REPOSITORY, type ProcesoRepository } from '../src/procesos/domain/proceso.repository.js';
import { encontrado, FakeCpnu } from '../src/procesos/testing/fake-cpnu.js';
import { actuacion, nota, proceso, tarea } from '../src/procesos/testing/proceso.fixtures.js';
import { BETO, asegurarUsuarioActivo, iniciarSesion } from './support/sesion.js';
import { createTestApp } from './support/test-app.js';
import { truncateAll } from './support/test-database.js';

const RADICADO = '11001310300120190012300';

describe('Procesos API contract (e2e)', () => {
  let app: NestExpressApplication;
  let cpnu: FakeCpnu;
  let procesos: ProcesoRepository;
  let cookie: string;
  let ana: string;

  const http = () => request(app.getHttpServer());

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
    // The session is minted here, after the truncate: it kills `usuarios`, so a cookie
    // from `beforeAll` would name a user that no longer exists and every read would
    // come back empty. The id must also match the fixtures, `procesos.usuario_id` is a FK.
    ({ cookie, usuarioId: ana } = await iniciarSesion(app));
    cpnu.radicados.clear();
    cpnu.procesos.clear();
    cpnu.documentos.clear();
    cpnu.calls.length = 0;
  });

  const sembrar = (overrides = {}) =>
    procesos.insert(proceso('1', { usuarioId: ana, radicado: RADICADO, alias: 'Caso', responsable: 'Luz', ...overrides }));

  describe('session', () => {
    const rutas: [string, string][] = [
      ['get', '/api/procesos'],
      ['post', '/api/procesos'],
      ['get', '/api/novedades'],
      ['get', '/api/procesos/1/actuaciones/5/documentos'],
      ['get', '/api/procesos/1'],
      ['patch', '/api/procesos/1'],
      ['delete', '/api/procesos/1'],
      ['post', '/api/procesos/1/visto'],
      ['post', '/api/procesos/1/actualizar'],
      ['post', '/api/procesos/1/notas'],
      ['delete', '/api/procesos/1/notas/n1'],
      ['post', '/api/procesos/1/tareas'],
      ['patch', '/api/procesos/1/tareas/t1'],
      ['delete', '/api/procesos/1/tareas/t1'],
    ];

    it.each(rutas)('answers %s %s without a session with 401 "Inicia sesión."', async (method, url) => {
      const res = await request(app.getHttpServer())[method as 'get'](url).expect(401);
      expect(res.body).toEqual({ error: 'Inicia sesión.' });
    });
  });

  describe('POST /api/procesos', () => {
    it('answers 400 when the radicado does not have 23 digits', async () => {
      const res = await http().post('/api/procesos').set('Cookie', cookie).send({ radicado: '123-456' }).expect(400);
      expect(res.body).toEqual({ error: 'El radicado debe tener 23 dígitos.' });
    });

    it('answers 404 when CPNU does not know the radicado', async () => {
      const res = await http().post('/api/procesos').set('Cookie', cookie).send({ radicado: RADICADO }).expect(404);
      expect(res.body).toEqual({
        error: 'No se encontró ese radicado en la Consulta Nacional Unificada.',
      });
    });

    it('adds the proceso with its first load (nothing is new) and answers 201 {agregados}', async () => {
      cpnu.radicados.set(RADICADO, [encontrado('1')]);
      cpnu.procesos.set('1', {
        detalle: { despacho: 'J' },
        sujetos: [{ tipo: 'Demandante', nombre: 'A' }],
        actuaciones: [actuacion(2), actuacion(1)],
      });

      const res = await http()
        .post('/api/procesos')
        .set('Cookie', cookie)
        .send({ radicado: '110-013-103-001-2019-0012-300', alias: '  Caso nuevo  ' })
        .expect(201);

      expect(res.body.agregados).toEqual([
        expect.objectContaining({
          idProceso: '1',
          radicado: RADICADO,
          alias: 'Caso nuevo',
          despacho: 'J',
          noVistas: 0,
          nuevaInstancia: false,
          agregadoPor: 'Ana',
          error: null,
          ultimaActuacion: expect.objectContaining({ id: 2 }),
        }),
      ]);
      expect(await procesos.findById('1', ana)).toMatchObject({ alias: 'Caso nuevo', actuaciones: [expect.anything(), expect.anything()] });
    });

    it('keeps the proceso with an error message when CPNU fails during the first load', async () => {
      cpnu.radicados.set(RADICADO, [encontrado('1')]);
      cpnu.procesos.set('1', new Error('La Rama Judicial respondió 500'));
      const res = await http().post('/api/procesos').set('Cookie', cookie).send({ radicado: RADICADO }).expect(201);
      expect(res.body.agregados[0]).toMatchObject({ idProceso: '1', error: 'La Rama Judicial respondió 500' });
    });

    it('reports private procesos as {idProceso, privado: true} without storing them', async () => {
      cpnu.radicados.set(RADICADO, [encontrado('7', { esPrivado: true })]);
      const res = await http().post('/api/procesos').set('Cookie', cookie).send({ radicado: RADICADO }).expect(201);
      expect(res.body.agregados).toEqual([{ idProceso: '7', privado: true }]);
      expect(await procesos.findById('7', ana)).toBeNull();
    });

    it('answers 409 when every instance is already followed', async () => {
      await sembrar();
      cpnu.radicados.set(RADICADO, [encontrado('1')]);
      const res = await http().post('/api/procesos').set('Cookie', cookie).send({ radicado: RADICADO }).expect(409);
      expect(res.body).toEqual({ error: 'Ese proceso ya está en la lista.' });
    });
  });

  describe('GET /api/procesos', () => {
    it('answers {procesos, ultimaRevision} with the list summary, sorted like legacy', async () => {
      await sembrar({ actuaciones: [actuacion(1, { fecha: '2026-01-10T00:00:00' })] });
      await procesos.insert(proceso('2', { usuarioId: ana, radicado: RADICADO, noVistas: [5], actuaciones: [actuacion(5, { fecha: '2025-01-01T00:00:00' })] }));
      await procesos.insert(proceso('3', { usuarioId: ana, radicado: RADICADO, actuaciones: [] }));
      await procesos.insert(proceso('4', { usuarioId: ana, radicado: RADICADO, actuaciones: [actuacion(9, { fecha: '2026-02-01T00:00:00' })] }));

      const res = await http().get('/api/procesos').set('Cookie', cookie).expect(200);

      expect(res.body.ultimaRevision).toBeNull();
      expect(res.body.procesos.map((p: { idProceso: string }) => p.idProceso)).toEqual(['2', '4', '1', '3']);
      expect(res.body.procesos[0]).toMatchObject({ noVistas: 1, nuevaInstancia: false, responsable: '', etiquetas: [] });
      expect(res.body.procesos[0]).not.toHaveProperty('detalle');
    });

    it('returns the stored ultimaRevision when the reviewer has run', async () => {
      await app.get(DataSource).query(
        "INSERT INTO meta (clave, valor) VALUES ('ultimaRevision', '2026-10-10T11:00:00.000Z')",
      );
      const res = await http().get('/api/procesos').set('Cookie', cookie).expect(200);
      expect(res.body.ultimaRevision).toBe('2026-10-10T11:00:00.000Z');
    });
  });

  describe('GET /api/novedades', () => {
    it('answers a bare array of unseen actuaciones and new instances, newest first', async () => {
      await sembrar({
        actuaciones: [actuacion(1, { fecha: '2026-01-01T00:00:00' }), actuacion(2, { fecha: '2026-03-01T00:00:00' })],
        noVistas: [1, 2],
      });
      await procesos.insert(proceso('2', { usuarioId: ana, radicado: RADICADO, nuevaInstancia: true, agregado: '2026-02-01T00:00:00.000Z' }));

      const res = await http().get('/api/novedades').set('Cookie', cookie).expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.map((i: { tipo: string; fecha: string }) => [i.tipo, i.fecha])).toEqual([
        ['actuacion', '2026-03-01T00:00:00'],
        ['instancia', '2026-02-01T00:00:00.000Z'],
        ['actuacion', '2026-01-01T00:00:00'],
      ]);
      expect(res.body[0]).toMatchObject({ idProceso: '1', alias: 'Caso', actuacion: { id: 2 } });
    });
  });

  describe('GET /api/procesos/:id/actuaciones/:actuacionId/documentos', () => {
    it('lists the CPNU documents of an actuación', async () => {
      await sembrar({ actuaciones: [actuacion(5)] });
      cpnu.documentos.set('5', [
        { id: 77, tipo: 'PDF', fechaCarga: '2026-01-01', nombre: 'Auto.pdf', url: 'https://cpnu/Descarga/Documento/77' },
      ]);
      const res = await http().get('/api/procesos/1/actuaciones/5/documentos').set('Cookie', cookie).expect(200);
      expect(res.body).toEqual([
        { id: 77, tipo: 'PDF', fechaCarga: '2026-01-01', nombre: 'Auto.pdf', url: 'https://cpnu/Descarga/Documento/77' },
      ]);
    });

    it('answers 404 "Ruta no encontrada." for a non-numeric actuación id', async () => {
      await sembrar();
      const res = await http().get('/api/procesos/1/actuaciones/abc/documentos').set('Cookie', cookie).expect(404);
      expect(res.body).toEqual({ error: 'Ruta no encontrada.' });
    });

    it('answers 404 for an actuación that is not in the proceso, without asking CPNU', async () => {
      // CPNU resolves `idActuacion` office-wide, so owning the proceso is not a proof.
      await sembrar({ actuaciones: [actuacion(5)] });
      cpnu.documentos.set('99', [
        { id: 78, tipo: 'PDF', fechaCarga: '2026-01-01', nombre: 'Otro.pdf', url: 'https://cpnu/Descarga/Documento/78' },
      ]);

      const res = await http().get('/api/procesos/1/actuaciones/99/documentos').set('Cookie', cookie).expect(404);

      expect(res.body).toEqual({ error: 'Proceso no encontrado.' });
      expect(cpnu.calls).toEqual([]);
    });

    it('is not reachable unscoped: the legacy /actuaciones/:id/documentos route is gone', async () => {
      await sembrar();
      cpnu.documentos.set('5', [{ id: 77, tipo: 'PDF', fechaCarga: '2026-01-01', nombre: 'Auto.pdf', url: 'https://x/77' }]);
      const res = await http().get('/api/actuaciones/5/documentos').set('Cookie', cookie).expect(404);
      expect(res.body).toEqual({ error: 'Ruta no encontrada.' });
      expect(cpnu.calls).toEqual([]);
    });

    it('answers 404 on a proceso of another user and leaks no document name or url', async () => {
      await sembrar({ actuaciones: [actuacion(5)] });
      cpnu.documentos.set('5', [
        { id: 77, tipo: 'PDF', fechaCarga: '2026-01-01', nombre: 'Auto.pdf', url: 'https://cpnu/Descarga/Documento/77' },
      ]);
      const { cookie: beto } = await iniciarSesion(app, BETO);

      const res = await http().get('/api/procesos/1/actuaciones/5/documentos').set('Cookie', beto).expect(404);

      expect(res.body).toEqual({ error: 'Proceso no encontrado.' });
      expect(res.text).not.toContain('Auto.pdf');
      expect(cpnu.calls).toEqual([]); // CPNU was never asked, so no actuator id is probeable

      // The owner is still served: the 404 above is about ownership, not about the row.
      const propio = await http()
        .get('/api/procesos/1/actuaciones/5/documentos')
        .set('Cookie', cookie)
        .expect(200);
      expect(propio.body).toHaveLength(1);
    });
  });

  describe('cross-user boundary', () => {
    it('lists and reports novedades only for the caller', async () => {
      const beto = await asegurarUsuarioActivo(app.get(DataSource), BETO);
      await sembrar({ actuaciones: [actuacion(1)], noVistas: [1] });
      await procesos.insert(proceso('2', { usuarioId: beto, actuaciones: [actuacion(7)], noVistas: [7] }));
      const { cookie: cookieBeto } = await iniciarSesion(app, BETO);

      const listaAna = await http().get('/api/procesos').set('Cookie', cookie).expect(200);
      const listaBeto = await http().get('/api/procesos').set('Cookie', cookieBeto).expect(200);

      expect(listaAna.body.procesos.map((x: { idProceso: string }) => x.idProceso)).toEqual(['1']);
      expect(listaBeto.body.procesos.map((x: { idProceso: string }) => x.idProceso)).toEqual(['2']);

      const novedadesAna = await http().get('/api/novedades').set('Cookie', cookie).expect(200);
      const novedadesBeto = await http().get('/api/novedades').set('Cookie', cookieBeto).expect(200);

      expect(novedadesAna.body.map((x: { idProceso: string }) => x.idProceso)).toEqual(['1']);
      expect(novedadesBeto.body.map((x: { idProceso: string }) => x.idProceso)).toEqual(['2']);
    });

    it.each([
      ['get', '/api/procesos/1'],
      ['patch', '/api/procesos/1'],
      ['delete', '/api/procesos/1'],
      ['post', '/api/procesos/1/visto'],
      ['post', '/api/procesos/1/actualizar'],
    ])('answers 404 (never 403) to %s %s of another user while the owner still gets 200', async (method, url) => {
      await sembrar({ alias: 'Caso de Ana', tareas: [tarea('t1')], notas: [nota('n1')] });
      const { cookie: beto } = await iniciarSesion(app, BETO);

      const req = request(app.getHttpServer())[method as 'get'](url).set('Cookie', beto);
      const res = await (method === 'patch' ? req.send({ alias: 'Secuestrado' }) : req).expect(404);

      expect(res.body).toEqual({ error: 'Proceso no encontrado.' });
      expect(await procesos.findById('1', ana)).toMatchObject({
        alias: 'Caso de Ana',
        notas: [nota('n1')],
        tareas: [tarea('t1')],
      });

      // Without this the 404 above would also prove the row is missing, so it would be
      // a "the process does not exist" test wearing an isolation test's name.
      const own = request(app.getHttpServer())[method as 'get'](url).set('Cookie', cookie);
      await (method === 'patch' ? own.send({ alias: 'Caso de Ana' }) : own).expect(200);
    });
  });

  describe('GET /api/procesos/:id', () => {
    it('answers the full detail with noVistasIds, notas (newest first) and tareas', async () => {
      await sembrar({
        detalle: { despacho: 'J' },
        actuaciones: [actuacion(1)],
        noVistas: [1],
        notas: [nota('n2'), nota('n1')],
        tareas: [tarea('t1')],
      });
      const res = await http().get('/api/procesos/1').set('Cookie', cookie).expect(200);
      expect(res.body).toMatchObject({
        idProceso: '1',
        detalle: { despacho: 'J' },
        actuaciones: [expect.objectContaining({ id: 1 })],
        noVistasIds: [1],
        notas: [expect.objectContaining({ id: 'n2' }), expect.objectContaining({ id: 'n1' })],
        tareas: [expect.objectContaining({ id: 't1' })],
      });
    });

    it('answers 404 "Proceso no encontrado." for an unknown id', async () => {
      const res = await http().get('/api/procesos/999').set('Cookie', cookie).expect(404);
      expect(res.body).toEqual({ error: 'Proceso no encontrado.' });
    });
  });

  describe('PATCH /api/procesos/:id', () => {
    it('updates alias, responsable and etiquetas with the legacy limits and returns the detail', async () => {
      await sembrar();
      const res = await http()
        .patch('/api/procesos/1')
        .set('Cookie', cookie)
        .send({ alias: 'x'.repeat(130), responsable: '  Ana  ', etiquetas: ' civil, ,civil, laboral ' })
        .expect(200);

      expect(res.body).toMatchObject({ alias: 'x'.repeat(120), responsable: 'Ana', etiquetas: ['civil', 'laboral'] });
      expect(res.body.notas).toEqual([]);
      expect(await procesos.findById('1', ana)).toMatchObject({ alias: 'x'.repeat(120), responsable: 'Ana' });
    });

    it('turns etiquetas null into [] (deliberate fix, never the tag "null") and keeps at most 10', async () => {
      await sembrar({ etiquetas: ['previa'] });
      const nulo = await http().patch('/api/procesos/1').set('Cookie', cookie).send({ etiquetas: null }).expect(200);
      expect(nulo.body.etiquetas).toEqual([]);

      const muchas = Array.from({ length: 12 }, (_, i) => `e${i}`);
      const res = await http().patch('/api/procesos/1').set('Cookie', cookie).send({ etiquetas: muchas }).expect(200);
      expect(res.body.etiquetas).toHaveLength(10);
    });

    it('answers 404 "Proceso no encontrado." for an unknown id', async () => {
      await http().patch('/api/procesos/999').set('Cookie', cookie).send({ alias: 'x' }).expect(404);
    });
  });

  describe('DELETE /api/procesos/:id', () => {
    it('removes the proceso and answers {ok: true}', async () => {
      await sembrar();
      const res = await http().delete('/api/procesos/1').set('Cookie', cookie).expect(200);
      expect(res.body).toEqual({ ok: true });
      await http().get('/api/procesos/1').set('Cookie', cookie).expect(404);
    });
  });

  describe('POST /api/procesos/:id/visto', () => {
    it('clears unseen actuaciones and the new-instance flag and answers the summary', async () => {
      await sembrar({ actuaciones: [actuacion(1)], noVistas: [1], nuevaInstancia: true });
      const res = await http().post('/api/procesos/1/visto').set('Cookie', cookie).expect(200);
      expect(res.body).toMatchObject({ idProceso: '1', noVistas: 0, nuevaInstancia: false });
      expect(res.body).not.toHaveProperty('detalle');
    });
  });

  describe('POST /api/procesos/:id/actualizar', () => {
    it('refreshes from CPNU, reports detected instances and answers the summary with instanciasNuevas', async () => {
      await sembrar({ actuaciones: [actuacion(1)] });
      cpnu.procesos.set('1', { detalle: {}, sujetos: [], actuaciones: [actuacion(2), actuacion(1)] });
      cpnu.radicados.set(RADICADO, [encontrado('1'), encontrado('2')]);

      const res = await http().post('/api/procesos/1/actualizar').set('Cookie', cookie).expect(200);

      expect(res.body).toMatchObject({ idProceso: '1', noVistas: 1, instanciasNuevas: 1, error: null });
      expect(await procesos.findById('2', ana)).toMatchObject({ nuevaInstancia: true, alias: 'Caso (nueva instancia)' });
    });

    it('records a CPNU failure in error and still answers 200', async () => {
      await sembrar();
      cpnu.procesos.set('1', new Error('La Rama Judicial respondió 503'));
      cpnu.radicados.set(RADICADO, new Error('La Rama Judicial respondió 503'));
      const res = await http().post('/api/procesos/1/actualizar').set('Cookie', cookie).expect(200);
      expect(res.body).toMatchObject({ error: 'La Rama Judicial respondió 503', instanciasNuevas: 0 });
    });

    it('answers 404 "Proceso no encontrado." for an unknown id', async () => {
      await http().post('/api/procesos/999/actualizar').set('Cookie', cookie).expect(404);
    });
  });

  describe('notas', () => {
    it('adds a note with the author and answers 201 with the detail', async () => {
      await sembrar();
      const res = await http().post('/api/procesos/1/notas').set('Cookie', cookie).send({ texto: '  Llamar  ' }).expect(201);
      expect(res.body.notas).toEqual([
        expect.objectContaining({ texto: 'Llamar', autor: 'Ana', id: expect.stringMatching(/^[0-9a-f]{12}$/) }),
      ]);
    });

    it('answers 400 "La nota está vacía." for a blank note', async () => {
      await sembrar();
      const res = await http().post('/api/procesos/1/notas').set('Cookie', cookie).send({ texto: '   ' }).expect(400);
      expect(res.body).toEqual({ error: 'La nota está vacía.' });
    });

    it('deletes a note and answers 200 with the detail', async () => {
      // Domain order is newest first: [n2, n1] stores n1 as the oldest note.
      await sembrar({ notas: [nota('n2'), nota('n1')] });
      const res = await http().delete('/api/procesos/1/notas/n1').set('Cookie', cookie).expect(200);
      expect(res.body.notas).toEqual([expect.objectContaining({ id: 'n2' })]);
    });
  });

  describe('tareas', () => {
    it('adds a task with the legacy defaults and answers 201 with the detail', async () => {
      await sembrar();
      const res = await http()
        .post('/api/procesos/1/tareas')
        .set('Cookie', cookie)
        .send({ titulo: 'Contestar', fecha: '2026-03-10', hora: '9:30', idActuacion: 42 })
        .expect(201);
      expect(res.body.tareas).toEqual([
        expect.objectContaining({
          titulo: 'Contestar',
          fecha: '2026-03-10',
          hora: '',
          responsable: 'Luz',
          idActuacion: '42',
          hecha: false,
          hechaPor: null,
          autor: 'Ana',
        }),
      ]);
    });

    it('keeps a valid HH:MM hora and answers 400 for an invalid task', async () => {
      await sembrar();
      const ok = await http()
        .post('/api/procesos/1/tareas')
        .set('Cookie', cookie)
        .send({ titulo: 'Audiencia', fecha: '2026-03-10', hora: '14:00' })
        .expect(201);
      expect(ok.body.tareas[0]).toMatchObject({ hora: '14:00' });

      const bad = await http()
        .post('/api/procesos/1/tareas')
        .set('Cookie', cookie)
        .send({ titulo: '', fecha: '2026-03-10' })
        .expect(400);
      expect(bad.body).toEqual({ error: 'Escribe la actividad y una fecha válida.' });
    });

    it('marks a task done with hechaPor and applies only valid changes', async () => {
      await sembrar({ tareas: [tarea('t1')] });
      const res = await http()
        .patch('/api/procesos/1/tareas/t1')
        .set('Cookie', cookie)
        .send({ hecha: true, fecha: 'no-es-fecha', titulo: '  Nuevo  ', hora: '08:15' })
        .expect(200);
      expect(res.body.tareas[0]).toMatchObject({
        id: 't1',
        hecha: true,
        hechaPor: 'Ana',
        fecha: '2026-03-10',
        titulo: 'Nuevo',
        hora: '08:15',
      });
    });

    it('answers 404 "Tarea no encontrada." for an unknown task on PATCH and DELETE', async () => {
      await sembrar();
      await http().patch('/api/procesos/1/tareas/nope').set('Cookie', cookie).send({ hecha: true }).expect(404);
      const res = await http().delete('/api/procesos/1/tareas/nope').set('Cookie', cookie).expect(404);
      expect(res.body).toEqual({ error: 'Tarea no encontrada.' });
    });

    it('deletes a task and answers 200 with the detail', async () => {
      await sembrar({ tareas: [tarea('t1'), tarea('t2')] });
      const res = await http().delete('/api/procesos/1/tareas/t1').set('Cookie', cookie).expect(200);
      expect(res.body.tareas).toEqual([expect.objectContaining({ id: 't2' })]);
    });
  });
});
