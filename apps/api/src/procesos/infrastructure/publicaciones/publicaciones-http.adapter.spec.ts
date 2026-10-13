import { readFileSync } from 'node:fs';
import { PortalBloqueadoError, PortalNoDisponibleError } from '../../application/ports/publicaciones.port.js';
import { evaluarEstado, ordenarEstados, type EstadoPublicado } from '../../domain/autos.js';
import { ColaPortal, PORTAL_INTERVALO_MS } from './cola-portal.js';
import { parseBusqueda, parseCategoriasDepartamento, parseDetalle } from './publicaciones-html.js';
import {
  PORTAL_ENFRIAMIENTO_MS,
  PORTAL_INICIO,
  PORTAL_ORIGIN,
  PublicacionesHttpAdapter,
  validarRutaPortal,
} from './publicaciones-http.adapter.js';

const fixture = (nombre: string): string =>
  readFileSync(new URL(`../../testing/fixtures/publicaciones/${nombre}.html`, import.meta.url), 'utf8');

const INICIO = fixture('inicio');
const BUSQUEDA_FAMILIA = fixture('busqueda-familia-015');
const DETALLE_FAMILIA = fixture('detalle-familia-015');
const BUSQUEDA_CIVIL = fixture('busqueda-civil-021');
const DETALLE_CIVIL = fixture('detalle-civil-021');
const BUSQUEDA_TITULOS_FECHA = fixture('busqueda-civil-021-titulos-fecha');

// Radicados of the two despachos recorded in the fixtures (tests only).
const RAD_FAMILIA = '05001311001520260010000';
const RAD_CIVIL = '05001400302120250133300';

type Respuesta = { status?: number; body?: string; headers?: Record<string, string> } | Error;

interface Llamada {
  url: URL;
  cookie: string | undefined;
  t: number;
}

/** Fake fetch over a fake clock: `responder` maps each request to an answer; sleeps advance the clock. */
function montar(responder: (url: URL, n: number) => Respuesta) {
  const reloj = { t: 1_000_000 };
  const llamadas: Llamada[] = [];
  const sleep = async (ms: number) => {
    reloj.t += ms;
  };
  const fetchFalso = (async (input: URL, init: RequestInit) => {
    const url = new URL(String(input));
    llamadas.push({ url, cookie: (init.headers as Record<string, string>).Cookie, t: reloj.t });
    reloj.t += 300; // every request takes some time
    const r = responder(url, llamadas.length);
    if (r instanceof Error) throw r;
    return new Response(r.body ?? '', { status: r.status ?? 200, headers: r.headers });
  }) as unknown as typeof fetch;
  const ahora = () => reloj.t;
  const adapter = new PublicacionesHttpAdapter({
    fetch: fetchFalso,
    sleep,
    ahora,
    cola: new ColaPortal(PORTAL_INTERVALO_MS, sleep, ahora),
  });
  return { adapter, llamadas, reloj };
}

const esInicio = (url: URL) => url.toString() === PORTAL_INICIO;
const esBusqueda = (url: URL) => url.search.includes('action=busqueda');
const conSesion = { headers: { 'Set-Cookie': 'JSESSIONID=abc123; Path=/; HttpOnly' } };

/** Portal that answers with the recorded fixtures of one despacho. */
function portal(busqueda: string, detalle: string) {
  return (url: URL): Respuesta => {
    if (esInicio(url)) return { body: INICIO, ...conSesion };
    if (esBusqueda(url)) return { body: busqueda };
    return { body: detalle };
  };
}

const estadoDe = (urlEstado: string): EstadoPublicado => ({
  titulo: 'Notificación por Estado No.001 de 2 de enero de 2026',
  tipo: 'Notificaciones por Estados',
  fechaPublicacion: '2026-01-02',
  urlEstado,
});

describe('Publicaciones Procesales HTML parsers', () => {
  it('reads the department ids of the start page', () => {
    const categorias = parseCategoriasDepartamento(INICIO);
    expect(categorias.get('05')).toBe('178845807');
    expect(categorias.get('11')).toBe('178847780');
  });

  it('reads the search rows with title, type, date and detail link', () => {
    const filas = parseBusqueda(BUSQUEDA_FAMILIA);
    expect(filas).toHaveLength(4);
    expect(filas[2]).toMatchObject({
      titulo: 'Notificación por Estado No.132 de 15 de septiembre de 2026',
      tipo: 'Notificaciones por Estados',
      fechaPublicacion: '2026-09-15',
    });
    expect(filas[2].urlEstado).toMatch(/^https:\/\/publicacionesprocesales\.ramajudicial\.gov\.co\/web\/publicaciones-procesales\/inicio\?/);
    expect(new URL(filas[2].urlEstado).searchParams.get(`_co_com_avanti_efectosProcesales_PublicacionesEfectosProcesalesPortletV2_INSTANCE_BIyXQFHVaYaq_articleId`)).toBe('261677488');
  });

  it('reads compact titles and other publication types', () => {
    const filas = parseBusqueda(BUSQUEDA_TITULOS_FECHA);
    expect(filas.map((f) => f.titulo)).toEqual([
      'ESTADOS20250825',
      'TRASLADOS20250822',
      'ESTADOS20250821',
      'TRASLADOS20250820',
      'ESTADOS20250820',
    ]);
    expect(filas[1].tipo).not.toBe(filas[0].tipo);
  });

  it('reads the files of a detail page as absolute links', () => {
    const archivos = parseDetalle(DETALLE_FAMILIA);
    expect(archivos).toHaveLength(21);
    expect(archivos).toContainEqual({
      nombre: '031202600100ConcedeApelación-NiegaSolicitud.pdf',
      url: expect.stringMatching(/^https:\/\/publicacionesprocesales\.ramajudicial\.gov\.co\/c\/document_library\/get_file\?uuid=[0-9a-f-]+&groupId=\d+$/),
    });
    expect(parseDetalle(DETALLE_CIVIL).map((a) => a.nombre)).toEqual(['AUTOS20260611.pdf', 'ESTADOSTYBA20260611.pdf']);
  });

  it('returns nothing for pages without rows or files', () => {
    expect(parseBusqueda('<html></html>')).toEqual([]);
    expect(parseDetalle('<html></html>')).toEqual([]);
  });
});

describe('validarRutaPortal', () => {
  it('allows the start, search and detail pages', () => {
    expect(() => validarRutaPortal(PORTAL_INICIO)).not.toThrow();
    expect(() => validarRutaPortal(parseBusqueda(BUSQUEDA_FAMILIA)[0].urlEstado)).not.toThrow();
  });

  it.each([
    `${PORTAL_ORIGIN}/c/document_library/get_file?uuid=1&groupId=2`,
    `${PORTAL_ORIGIN}/C/Document_Library/get_file?uuid=1`,
    `${PORTAL_ORIGIN}/%63/document_library/get_file?uuid=1`,
    `${PORTAL_ORIGIN}/documents/6098902/0/AUTOS.pdf`,
    `${PORTAL_ORIGIN}/dtd/x.dtd`,
    `${PORTAL_ORIGIN}/web/guest/otra`,
    'https://otro.example.com/web/publicaciones-procesales/inicio',
  ])('refuses %s', (url) => {
    expect(() => validarRutaPortal(url)).toThrow(/no permitida/);
  });
});

describe('PublicacionesHttpAdapter', () => {
  it('finds the exacto PDF of a despacho with one PDF per auto (recorded fixtures)', async () => {
    const { adapter, llamadas } = montar(portal(BUSQUEDA_FAMILIA, DETALLE_FAMILIA));
    const estados = await adapter.buscarEstados({ despacho: RAD_FAMILIA.slice(0, 12), desde: '2026-09-14', hasta: '2026-09-17' });
    const [primero] = ordenarEstados(estados, '2026-09-15');
    const archivos = await adapter.listarArchivos(primero);

    expect(evaluarEstado(primero, archivos, RAD_FAMILIA, '2026-09-15')).toMatchObject({
      confianza: 'exacto',
      nombreArchivo: '031202600100ConcedeApelación-NiegaSolicitud.pdf',
      numeroEstado: '132',
      fechaPublicacion: '2026-09-15',
    });

    const busqueda = llamadas[1].url.searchParams;
    const ns = '_co_com_avanti_efectosProcesales_PublicacionesEfectosProcesalesPortletV2_INSTANCE_BIyXQFHVaYaq_';
    expect(busqueda.get(`${ns}idDepto`)).toBe('05');
    expect(busqueda.get(`${ns}idDespacho`)).toBe('050013110015');
    expect(busqueda.get(`${ns}idDeptoIdCategory`)).toBe('178845807');
    expect(busqueda.get(`${ns}fechaInicio`)).toBe('2026-09-14');
    expect(busqueda.get(`${ns}fechaFin`)).toBe('2026-09-17');
    expect(llamadas.map((l) => l.cookie)).toEqual([undefined, 'JSESSIONID=abc123', 'JSESSIONID=abc123']);
  });

  it('offers the combined AUTOS file of a despacho with one PDF per estado (recorded fixtures)', async () => {
    const { adapter } = montar(portal(BUSQUEDA_CIVIL, DETALLE_CIVIL));
    const estados = await adapter.buscarEstados({ despacho: RAD_CIVIL.slice(0, 12), desde: '2026-06-10', hasta: '2026-06-15' });
    const [primero] = ordenarEstados(estados, '2026-06-11');
    const archivos = await adapter.listarArchivos(primero);

    expect(primero.titulo).toBe('Notificación por Estado No.095 de 11 de junio de 2026');
    expect(evaluarEstado(primero, archivos, RAD_CIVIL, '2026-06-11')).toMatchObject({
      confianza: 'del_dia',
      nombreArchivo: 'AUTOS20260611.pdf',
      numeroEstado: '095',
    });
  });

  it('keeps at least 2 s between the end of a request and the next one', async () => {
    const { adapter, llamadas } = montar(portal(BUSQUEDA_FAMILIA, DETALLE_FAMILIA));
    const estados = await adapter.buscarEstados({ despacho: '050013110015', desde: '2026-09-14', hasta: '2026-09-17' });
    await Promise.all(estados.map((e) => adapter.listarArchivos(e)));
    expect(llamadas).toHaveLength(6);
    for (let i = 1; i < llamadas.length; i++) {
      expect(llamadas[i].t - (llamadas[i - 1].t + 300)).toBeGreaterThanOrEqual(PORTAL_INTERVALO_MS);
    }
  });

  it('reuses the session and caches detail pages', async () => {
    const { adapter, llamadas } = montar(portal(BUSQUEDA_FAMILIA, DETALLE_FAMILIA));
    const busqueda = { despacho: '050013110015', desde: '2026-09-14', hasta: '2026-09-17' };
    const [estado] = await adapter.buscarEstados(busqueda);
    await adapter.buscarEstados(busqueda);
    await adapter.listarArchivos(estado);
    await adapter.listarArchivos(estado);
    expect(llamadas.filter((l) => esInicio(l.url))).toHaveLength(1);
    expect(llamadas).toHaveLength(4);
  });

  it('opens a new session when the search answers an empty body', async () => {
    let busquedas = 0;
    const { adapter, llamadas } = montar((url) => {
      if (esInicio(url)) return { body: INICIO, ...conSesion };
      return { body: busquedas++ === 0 ? '' : BUSQUEDA_FAMILIA };
    });
    const estados = await adapter.buscarEstados({ despacho: '050013110015', desde: '2026-09-14', hasta: '2026-09-17' });
    expect(estados).toHaveLength(4);
    expect(llamadas.map((l) => (esInicio(l.url) ? 'inicio' : 'busqueda'))).toEqual(['inicio', 'busqueda', 'inicio', 'busqueda']);
  });

  it('returns no publications for an unknown department or despacho code', async () => {
    const { adapter, llamadas } = montar(portal(BUSQUEDA_FAMILIA, DETALLE_FAMILIA));
    expect(await adapter.buscarEstados({ despacho: '990013110015', desde: '2026-09-14', hasta: '2026-09-17' })).toEqual([]);
    expect(await adapter.buscarEstados({ despacho: 'abc', desde: '2026-09-14', hasta: '2026-09-17' })).toEqual([]);
    expect(llamadas.filter((l) => esBusqueda(l.url))).toHaveLength(0);
  });

  it('retries once after a 5xx answer', async () => {
    const { adapter, llamadas } = montar((url, n) => (n === 1 ? { status: 504 } : portal(BUSQUEDA_FAMILIA, '')(url)));
    await expect(adapter.buscarEstados({ despacho: '050013110015', desde: '2026-09-14', hasta: '2026-09-17' })).resolves.toHaveLength(4);
    expect(llamadas.filter((l) => esInicio(l.url))).toHaveLength(2);
  });

  it('retries once after a timeout', async () => {
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    const { adapter } = montar((url, n) => (n === 2 ? timeout : portal(BUSQUEDA_FAMILIA, '')(url)));
    await expect(adapter.buscarEstados({ despacho: '050013110015', desde: '2026-09-14', hasta: '2026-09-17' })).resolves.toHaveLength(4);
  });

  it('gives up with PortalNoDisponibleError after the retry fails', async () => {
    const { adapter, llamadas } = montar(() => ({ status: 503 }));
    await expect(adapter.buscarEstados({ despacho: '050013110015', desde: '2026-09-14', hasta: '2026-09-17' })).rejects.toBeInstanceOf(
      PortalNoDisponibleError,
    );
    expect(llamadas).toHaveLength(2);
  });

  it('does not retry other client errors', async () => {
    const { adapter, llamadas } = montar(() => ({ status: 404 }));
    await expect(adapter.listarArchivos(estadoDe(PORTAL_INICIO))).rejects.toThrow('Publicaciones Procesales respondió 404');
    expect(llamadas.filter((l) => !esInicio(l.url))).toHaveLength(0);
  });

  it.each([
    ['403', { status: 403 }],
    ['429', { status: 429 }],
    ['a captcha page', { body: '<html><div class="g-recaptcha">captcha</div></html>' }],
  ])('stops on %s without retrying, and stays stopped for the cool-down', async (_, respuesta) => {
    const { adapter, llamadas, reloj } = montar((url) => (esInicio(url) ? { body: INICIO, ...conSesion } : respuesta));
    const busqueda = { despacho: '050013110015', desde: '2026-09-14', hasta: '2026-09-17' };
    await expect(adapter.buscarEstados(busqueda)).rejects.toBeInstanceOf(PortalBloqueadoError);
    expect(llamadas).toHaveLength(2);

    await expect(adapter.buscarEstados(busqueda)).rejects.toBeInstanceOf(PortalBloqueadoError);
    expect(llamadas).toHaveLength(2);

    // After the cool-down the session has expired too: start page, then the search.
    reloj.t += PORTAL_ENFRIAMIENTO_MS;
    await expect(adapter.buscarEstados(busqueda)).rejects.toBeInstanceOf(PortalBloqueadoError);
    expect(llamadas).toHaveLength(4);
  });

  it('never requests a PDF or another path disallowed by robots.txt', async () => {
    const { adapter, llamadas } = montar(() => ({ body: INICIO, ...conSesion }));
    for (const url of [
      `${PORTAL_ORIGIN}/c/document_library/get_file?uuid=1&groupId=2`,
      `${PORTAL_ORIGIN}/documents/6098902/0/AUTOS.pdf`,
      'https://otro.example.com/web/publicaciones-procesales/inicio',
    ]) {
      await expect(adapter.listarArchivos(estadoDe(url))).rejects.toThrow(/no permitida/);
    }
    expect(llamadas).toHaveLength(0);
  });

  it('follows a redirect only to an allowed page', async () => {
    const { adapter, llamadas } = montar((url) => {
      if (esInicio(url)) return { body: INICIO, ...conSesion };
      return { status: 302, headers: { Location: '/c/document_library/get_file?uuid=1' } };
    });
    const detalle = parseBusqueda(BUSQUEDA_FAMILIA)[0];
    await expect(adapter.listarArchivos(detalle)).rejects.toThrow(/no permitida/);
    expect(llamadas.every((l) => !l.url.pathname.startsWith('/c/'))).toBe(true);
  });
});
