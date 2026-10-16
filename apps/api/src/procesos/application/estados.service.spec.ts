import { deflateSync } from 'node:zlib';
import { isoMs } from '../../common/time/temporal.js';
import type { ArchivoPublicado, EstadoPublicado } from '../domain/autos.js';
import { fechaBogota, hoyBogota } from '../domain/bogota-time.js';
import { META_ULTIMO_BARRIDO_ESTADOS } from '../domain/meta.repository.js';
import type { Proceso } from '../domain/proceso.js';
import { FakePublicaciones } from '../testing/fake-publicaciones.js';
import { InMemoryEstadoProcesoRepository } from '../testing/in-memory-estado-proceso.repository.js';
import { InMemoryMetaRepository, InMemoryProcesoRepository } from '../testing/in-memory-proceso.repository.js';
import { proceso } from '../testing/proceso.fixtures.js';
import { EstadosService } from './estados.service.js';

// Fake radicados: the first 12 digits are the despacho.
const DESPACHO = '050013110003';
const PRIVADO = `${DESPACHO}20260066200`;
const CON_RECURSO = `${DESPACHO}20260066201`;
const OTRO = `${DESPACHO}20260009900`;

const TITULO = 'Notificación por Estado No.174 de 14 de octubre de 2026';
const URL_ESTADO = 'https://portal.test/web/publicaciones-procesales/inicio?articleId=174';
const URL_LISTADO = 'https://portal.test/c/document_library/get_file?uuid=174';

const LISTADO: ArchivoPublicado = { nombre: 'Anexo LISTADO 174.pdf', url: URL_LISTADO };
const ACTA: ArchivoPublicado = {
  nombre: 'ACTA DE REPARTO.pdf',
  url: 'https://portal.test/c/document_library/get_file?uuid=9',
};

/** Minimal PDF with an inflated text layer, the same shape as a real LISTADO. */
function pdfCon(radicados: string[]): Buffer {
  const contenido = radicados.map((r, i) => `BT /F1 9 Tf 40 ${700 - i * 20} Td (${r}) Tj ET`).join('\n') || ' ';
  const cuerpo = deflateSync(Buffer.from(contenido, 'latin1'));
  return Buffer.concat([
    Buffer.from('%PDF-1.4\n'),
    Buffer.from(`4 0 obj\n<< /Length ${cuerpo.length} /Filter /FlateDecode >>\nstream\n`),
    cuerpo,
    Buffer.from('\nendstream\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n'),
  ]);
}

const estado = (url = URL_ESTADO, titulo = TITULO): EstadoPublicado => ({
  titulo,
  tipo: 'Notificaciones por Estados',
  fechaPublicacion: '2026-10-14',
  urlEstado: url,
});

describe('EstadosService', () => {
  let portal: FakePublicaciones;
  let estadoRepo: InMemoryEstadoProcesoRepository;
  let meta: InMemoryMetaRepository;
  let servicio: EstadosService;

  function montar(privados: Proceso[] = [proceso('7', { radicado: PRIVADO, esPrivado: true })]) {
    portal = new FakePublicaciones();
    estadoRepo = new InMemoryEstadoProcesoRepository();
    meta = new InMemoryMetaRepository();
    servicio = new EstadosService(new InMemoryProcesoRepository(privados), estadoRepo, meta, portal);
  }

  /** One estado whose LISTADO carries the given radicados. */
  function conListado(radicados: string[], archivos: ArchivoPublicado[] = [ACTA, LISTADO]) {
    portal.estados.set(DESPACHO, [estado()]);
    portal.archivos.set(URL_ESTADO, archivos);
    if (radicados) portal.descargas.set(URL_LISTADO, pdfCon(radicados));
  }

  beforeEach(() => montar());

  it('records one detection for a private caso whose radicado is inside the LISTADO', async () => {
    conListado([OTRO, PRIVADO]);
    const resumen = await servicio.revisar();

    expect(resumen).toEqual({ despachos: 1, estados: 1, detecciones: 1, ilegibles: 0, sinListado: 0 });
    expect(await estadoRepo.listarPorProceso('7')).toEqual([
      expect.objectContaining({
        urlEstado: URL_ESTADO,
        numeroEstado: '174',
        radicadoEncontrado: PRIVADO,
        visto: false,
      }),
    ]);
  });

  it('matches through the case key and stores the radicado as it appeared', async () => {
    conListado([CON_RECURSO]);
    const resumen = await servicio.revisar();

    expect(resumen.detecciones).toBe(1);
    expect((await estadoRepo.listarPorProceso('7')).at(0)?.radicadoEncontrado).toBe(CON_RECURSO);
  });

  it('counts a LISTADO without radicados as unreadable and records nothing', async () => {
    conListado([]);
    const resumen = await servicio.revisar();

    expect(resumen).toMatchObject({ detecciones: 0, ilegibles: 1, sinListado: 0 });
    expect(estadoRepo.filas.size).toBe(0);
  });

  it('counts a download the portal did not hand back, never reading it as "not there"', async () => {
    conListado([]); // no entry in `descargas` answers null, like a block or an HTML answer
    portal.descargas.delete(URL_LISTADO);
    const resumen = await servicio.revisar();

    expect(resumen).toMatchObject({ detecciones: 0, ilegibles: 1 });
    expect(estadoRepo.filas.size).toBe(0);
  });

  it('counts an estado without a LISTADO attachment and skips it', async () => {
    conListado([PRIVADO], [ACTA]);
    const resumen = await servicio.revisar();

    expect(resumen).toMatchObject({ detecciones: 0, sinListado: 1, ilegibles: 0 });
    expect(portal.calls.some((c) => c.startsWith('descargar:'))).toBe(false);
  });

  it('does not sweep a public caso at all', async () => {
    montar([proceso('7', { radicado: PRIVADO, esPrivado: false })]);
    portal.estados.set(DESPACHO, [estado()]);

    const resumen = await servicio.revisar();

    expect(resumen.despachos).toBe(0);
    expect(portal.calls).toEqual([]);
  });

  it('does not duplicate a detection when the sweep runs twice', async () => {
    conListado([PRIVADO]);
    await servicio.revisar();
    await servicio.revisar();

    expect(estadoRepo.filas.size).toBe(1);
    expect(await estadoRepo.listarPorProceso('7')).toHaveLength(1);
  });

  it('searches 30 days back on the first run, then from the last run minus a day', async () => {
    conListado([PRIVADO]);
    const hasta = hoyBogota();

    await servicio.revisar();
    expect(portal.calls[0]).toBe(
      `buscar:${DESPACHO}:${Temporal.PlainDate.from(hasta).subtract({ days: 30 }).toString()}:${hasta}`,
    );

    const ultimo = Temporal.Now.instant().subtract({ hours: 24 * 10 });
    meta.values.set(META_ULTIMO_BARRIDO_ESTADOS, isoMs(ultimo));
    await servicio.revisar();

    const desde = Temporal.PlainDate.from(fechaBogota(ultimo)).subtract({ days: 1 }).toString();
    const busquedas = portal.calls.filter((c) => c.startsWith('buscar:'));
    expect(busquedas.at(-1)).toBe(`buscar:${DESPACHO}:${desde}:${hasta}`);
  });

  it('keeps the previous window when every despacho answered no estados', async () => {
    const previo = '2026-10-01T12:00:00.000Z';
    meta.values.set(META_ULTIMO_BARRIDO_ESTADOS, previo);
    portal.estados.set(DESPACHO, []);

    const resumen = await servicio.revisar();

    expect(resumen).toEqual({ despachos: 1, estados: 0, detecciones: 0, ilegibles: 0, sinListado: 0 });
    expect(await meta.get(META_ULTIMO_BARRIDO_ESTADOS)).toBe(previo);
  });

  it('keeps the previous window when there is no private caso to sweep', async () => {
    montar([proceso('7', { radicado: PRIVADO, esPrivado: false })]);
    const previo = '2026-10-01T12:00:00.000Z';
    meta.values.set(META_ULTIMO_BARRIDO_ESTADOS, previo);

    const resumen = await servicio.revisar();

    expect(resumen.despachos).toBe(0);
    expect(portal.calls).toEqual([]);
    expect(await meta.get(META_ULTIMO_BARRIDO_ESTADOS)).toBe(previo);
  });

  it('records the run when at least one estado came back', async () => {
    const previo = '2026-10-01T12:00:00.000Z';
    meta.values.set(META_ULTIMO_BARRIDO_ESTADOS, previo);
    conListado([PRIVADO], [ACTA]);

    await servicio.revisar();

    expect(await meta.get(META_ULTIMO_BARRIDO_ESTADOS)).not.toBe(previo);
  });
});
