import { CPNU_BASE_URL, CpnuHttpAdapter } from './cpnu-http.adapter.js';

type Route = { status?: number; body?: unknown } | Error;

/** Stubs global fetch with a path → response table and records requests. */
function stubFetch(routes: Record<string, Route>) {
  const requests: { url: string; init: RequestInit }[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    requests.push({ url, init });
    const route = routes[url.slice(CPNU_BASE_URL.length)];
    if (route instanceof Error) throw route;
    const status = route?.status ?? (route ? 200 : 404);
    return new Response(JSON.stringify(route?.body ?? {}), { status });
  });
  vi.stubGlobal('fetch', fetchMock);
  return requests;
}

const rawActuacion = (id: number) => ({
  idRegActuacion: id,
  consActuacion: id,
  fechaActuacion: '2026-01-01T00:00:00',
  actuacion: 'Auto',
  anotacion: 'x',
  fechaInicial: null,
  fechaFinal: null,
  fechaRegistro: '2026-01-02T00:00:00',
  conDocumentos: true,
  extra: 'ignored',
});

describe('CpnuHttpAdapter', () => {
  const cpnu = new CpnuHttpAdapter();

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('searchRadicado', () => {
    const path = '/Procesos/Consulta/NumeroRadicacion?numero=123&SoloActivos=false&pagina=1';

    it('calls CPNU with the legacy headers and a 25s timeout', async () => {
      const requests = stubFetch({
        [path]: {
          body: {
            procesos: [{ idProceso: 55, despacho: 'J', sujetosProcesales: 'A', esPrivado: false, otro: 1 }],
          },
        },
      });
      expect(await cpnu.searchRadicado('123')).toEqual([
        { idProceso: '55', despacho: 'J', sujetosProcesales: 'A', esPrivado: false },
      ]);
      expect(requests[0].url).toBe(CPNU_BASE_URL + path);
      expect(requests[0].init.headers).toEqual({
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0 SeguimientoProcesos',
      });
      expect(requests[0].init.signal).toBeInstanceOf(AbortSignal);
    });

    it('returns no procesos on 404', async () => {
      stubFetch({});
      expect(await cpnu.searchRadicado('123')).toEqual([]);
    });

    it('throws the legacy message for other non-2xx answers', async () => {
      stubFetch({ [path]: { status: 503 } });
      await expect(cpnu.searchRadicado('123')).rejects.toThrow('La Rama Judicial respondió 503');
    });
  });

  describe('loadProceso', () => {
    const detalle = '/Proceso/Detalle/9';
    const sujetos = '/Proceso/Sujetos/9?pagina=1';
    const page = (n: number) => `/Proceso/Actuaciones/9?pagina=${n}`;

    it('loads detail, parties and every page of actuaciones', async () => {
      stubFetch({
        [detalle]: { body: { despacho: 'J', claseProceso: 'Verbal' } },
        [sujetos]: { body: { sujetos: [{ tipoSujeto: 'Demandante', nombreRazonSocial: 'A', x: 1 }] } },
        [page(1)]: { body: { actuaciones: [rawActuacion(3)], paginacion: { cantidadPaginas: 2 } } },
        [page(2)]: { body: { actuaciones: [rawActuacion(2)], paginacion: { cantidadPaginas: 2 } } },
      });
      expect(await cpnu.loadProceso('9')).toEqual({
        detalle: { despacho: 'J', claseProceso: 'Verbal' },
        sujetos: [{ tipo: 'Demandante', nombre: 'A' }],
        actuaciones: [3, 2].map((id) => ({
          id,
          cons: id,
          fecha: '2026-01-01T00:00:00',
          actuacion: 'Auto',
          anotacion: 'x',
          fechaInicial: null,
          fechaFinal: null,
          fechaRegistro: '2026-01-02T00:00:00',
          conDocumentos: true,
        })),
      });
    });

    it('stops paginating at an empty page, a missing paginacion or 20 pages', async () => {
      const routes: Record<string, Route> = { [detalle]: { body: {} }, [sujetos]: { body: { sujetos: [] } } };
      for (let n = 1; n <= 25; n++) {
        routes[page(n)] = { body: { actuaciones: [rawActuacion(n)], paginacion: { cantidadPaginas: 99 } } };
      }
      const requests = stubFetch(routes);
      expect((await cpnu.loadProceso('9')).actuaciones).toHaveLength(20);
      expect(requests.filter((r) => r.url.includes('/Actuaciones/'))).toHaveLength(20);

      stubFetch({ ...routes, [page(2)]: { body: { actuaciones: [] } } });
      expect((await cpnu.loadProceso('9')).actuaciones).toHaveLength(1);

      stubFetch({ ...routes, [page(1)]: { body: { actuaciones: [rawActuacion(1)] } } });
      expect((await cpnu.loadProceso('9')).actuaciones).toHaveLength(1);
    });

    it('tolerates failing sujetos/actuaciones (null = keep previous) but not a failing detail', async () => {
      stubFetch({ [detalle]: { body: { a: 1 } }, [sujetos]: { status: 500 }, [page(1)]: { status: 500 } });
      expect(await cpnu.loadProceso('9')).toEqual({ detalle: { a: 1 }, sujetos: null, actuaciones: null });

      stubFetch({ [detalle]: { status: 500 } });
      await expect(cpnu.loadProceso('9')).rejects.toThrow('La Rama Judicial respondió 500');
    });

    it('treats a missing detail (404) as an empty one and missing sujetos (404) as unknown', async () => {
      stubFetch({ [page(1)]: { body: { actuaciones: [] } } });
      expect(await cpnu.loadProceso('9')).toEqual({ detalle: {}, sujetos: null, actuaciones: [] });
    });

    it('propagates timeouts with their TimeoutError name', async () => {
      stubFetch({ [detalle]: new DOMException('The operation was aborted due to timeout', 'TimeoutError') });
      await expect(cpnu.loadProceso('9')).rejects.toMatchObject({ name: 'TimeoutError' });
    });
  });

  describe('listDocumentos', () => {
    it('maps documents with the legacy name rule and download URL', async () => {
      stubFetch({
        '/Proceso/DocumentosActuacion/77': {
          body: [
            { idRegDocumento: 1, tipo: 'PDF', fechaCarga: 'f', descripcion: 'Auto admisorio', nombre: 'a.pdf' },
            { idRegDocumento: 2, tipo: 'PDF', fechaCarga: 'f', descripcion: 'Cargado el 01/01', nombre: 'b.pdf' },
            { idRegDocumento: 3, tipo: 'PDF', fechaCarga: 'f' },
          ],
        },
      });
      expect(await cpnu.listDocumentos('77')).toEqual([
        { id: 1, tipo: 'PDF', fechaCarga: 'f', nombre: 'Auto admisorio', url: `${CPNU_BASE_URL}/Descarga/Documento/1` },
        { id: 2, tipo: 'PDF', fechaCarga: 'f', nombre: 'b.pdf', url: `${CPNU_BASE_URL}/Descarga/Documento/2` },
        { id: 3, tipo: 'PDF', fechaCarga: 'f', nombre: 'Documento', url: `${CPNU_BASE_URL}/Descarga/Documento/3` },
      ]);
    });

    it('returns an empty list on 404', async () => {
      stubFetch({});
      expect(await cpnu.listDocumentos('77')).toEqual([]);
    });
  });
});
