import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { PortalBloqueadoError, PortalNoDisponibleError, type EstadoPublicado } from '../src/procesos/application/ports/publicaciones.port.js';
import { AUTO_PUBLICADO_REPOSITORY, type AutoPublicadoRepository } from '../src/procesos/domain/auto-publicado.repository.js';
import { PROCESO_REPOSITORY, type ProcesoRepository } from '../src/procesos/domain/proceso.repository.js';
import { FakePublicaciones } from '../src/procesos/testing/fake-publicaciones.js';
import { actuacion, proceso } from '../src/procesos/testing/proceso.fixtures.js';
import { iniciarSesion } from './support/sesion.js';
import { createTestApp } from './support/test-app.js';
import { truncateAll } from './support/test-database.js';

// Radicado of the despacho recorded in phase P (tests only).
const RADICADO = '05001311001520260010000';
const DESPACHO = '050013110015';
const RUTA = '/api/procesos/1/actuaciones/11/auto';

const estado = (numero: string, dia: string): EstadoPublicado => ({
  titulo: `Notificación por Estado No.${numero} de ${Number(dia.slice(8))} de septiembre de 2026`,
  tipo: 'Notificaciones por Estados',
  fechaPublicacion: dia,
  urlEstado: `https://publicacionesprocesales.ramajudicial.gov.co/web/publicaciones-procesales/inicio?articleId=${numero}`,
});
const PDF = 'https://publicacionesprocesales.ramajudicial.gov.co/c/document_library/get_file?uuid=2cc4470b&groupId=6098902';

describe('GET /api/procesos/:id/actuaciones/:actuacionId/auto (e2e)', () => {
  let app: NestExpressApplication;
  let portal: FakePublicaciones;
  let procesos: ProcesoRepository;
  let autos: AutoPublicadoRepository;
  let cookie: string;

  const get = (ruta = RUTA) => request(app.getHttpServer()).get(ruta).set('Cookie', cookie);

  beforeAll(async () => {
    portal = new FakePublicaciones();
    app = await createTestApp({ publicaciones: portal });
    procesos = app.get(PROCESO_REPOSITORY);
    autos = app.get(AUTO_PUBLICADO_REPOSITORY);
    cookie = await iniciarSesion(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(app.get(DataSource));
    portal.estados.clear();
    portal.archivos.clear();
    portal.calls.length = 0;
    await procesos.insert(
      proceso('1', {
        radicado: RADICADO,
        actuaciones: [
          actuacion(13, { actuacion: 'Recepción memorial', fecha: '2026-09-16T00:00:00' }),
          actuacion(12, { actuacion: 'Fijación Estado', fecha: '2026-09-15T00:00:00' }),
          actuacion(11, { actuacion: 'Auto Concede', fecha: '2026-09-14T00:00:00' }),
        ],
      }),
    );
  });

  const conPdfExacto = () => {
    portal.estados.set(DESPACHO, [estado('133', '2026-09-16'), estado('132', '2026-09-15')]);
    portal.archivos.set(estado('132', '2026-09-15').urlEstado, [
      { nombre: '002202600589ResuelveApelacion.pdf', url: `${PDF}x` },
      { nombre: '031202600100ConcedeApelación-NiegaSolicitud.pdf', url: PDF },
    ]);
  };

  it('needs a session', async () => {
    const res = await request(app.getHttpServer()).get(RUTA).expect(401);
    expect(res.body).toEqual({ error: 'Inicia sesión.' });
  });

  it('finds the exacto PDF in the estado of the fijación date and stores it', async () => {
    conPdfExacto();
    const res = await get().expect(200);
    expect(res.body).toEqual({
      confianza: 'exacto',
      urlPdf: PDF,
      nombreArchivo: '031202600100ConcedeApelación-NiegaSolicitud.pdf',
      urlEstado: estado('132', '2026-09-15').urlEstado,
      numeroEstado: '132',
      fechaPublicacion: '2026-09-15',
    });
    expect(portal.calls).toEqual([
      `buscar:${DESPACHO}:2026-09-14:2026-09-17`,
      `archivos:${estado('132', '2026-09-15').urlEstado}`,
    ]);

    portal.calls.length = 0;
    await get().expect(200);
    expect(portal.calls).toEqual([]);
    expect(await autos.buscar('1', 11)).toMatchObject({ confianza: 'exacto', intentos: 1 });
  });

  it('links to the closest estado when no PDF is identified', async () => {
    portal.estados.set(DESPACHO, [estado('132', '2026-09-15')]);
    const res = await get().expect(200);
    expect(res.body).toEqual({
      confianza: 'estado',
      urlPdf: null,
      nombreArchivo: null,
      urlEstado: estado('132', '2026-09-15').urlEstado,
      numeroEstado: '132',
      fechaPublicacion: '2026-09-15',
    });
  });

  it('answers sin_resultado and does not search again before 3 days', async () => {
    const res = await get().expect(200);
    expect(res.body.confianza).toBe('sin_resultado');
    portal.calls.length = 0;
    await get().expect(200);
    expect(portal.calls).toEqual([]);
  });

  it('searches an old unresolved result again and counts the attempt', async () => {
    await autos.guardar({
      ...(await get().expect(200)).body,
      idProceso: '1',
      idActuacion: 11,
      buscadoEn: '2026-01-01T00:00:00.000Z',
      intentos: 2,
    });
    conPdfExacto();
    const res = await get().expect(200);
    expect(res.body.confianza).toBe('exacto');
    expect(await autos.buscar('1', 11)).toMatchObject({ confianza: 'exacto', intentos: 3 });
  });

  it.each([
    ['blocked', new PortalBloqueadoError(), 'Publicaciones Procesales bloqueó la consulta. Intenta más tarde.'],
    ['down', new PortalNoDisponibleError(), 'Publicaciones Procesales no está disponible en este momento. Intenta más tarde.'],
  ])('answers 503 and stores nothing when the portal is %s', async (_, error, mensaje) => {
    portal.estados.set(DESPACHO, error);
    const res = await get().expect(503);
    expect(res.body).toEqual({ error: mensaje });
    expect(await autos.buscar('1', 11)).toBeNull();
  });

  it('keeps answering the stored result when a new search fails', async () => {
    await autos.guardar({
      idProceso: '1',
      idActuacion: 11,
      confianza: 'estado',
      urlPdf: null,
      nombreArchivo: null,
      urlEstado: estado('132', '2026-09-15').urlEstado,
      numeroEstado: '132',
      fechaPublicacion: '2026-09-15',
      buscadoEn: '2026-01-01T00:00:00.000Z',
      intentos: 1,
    });
    portal.estados.set(DESPACHO, new PortalBloqueadoError());
    const res = await get().expect(200);
    expect(res.body.confianza).toBe('estado');
    expect(await autos.buscar('1', 11)).toMatchObject({ intentos: 1 });
  });

  it.each([
    ['/api/procesos/9/actuaciones/11/auto', 'Proceso no encontrado.'],
    ['/api/procesos/1/actuaciones/99/auto', 'Actuación no encontrada.'],
    ['/api/procesos/1/actuaciones/13/auto', 'Esa actuación no es un auto ni una sentencia.'],
    ['/api/procesos/1/actuaciones/12/auto', 'Esa actuación no es un auto ni una sentencia.'],
    ['/api/procesos/1/actuaciones/abc/auto', 'Ruta no encontrada.'],
  ])('answers 404 for %s', async (ruta, mensaje) => {
    const res = await get(ruta).expect(404);
    expect(res.body).toEqual({ error: mensaje });
    expect(portal.calls).toEqual([]);
  });
});
