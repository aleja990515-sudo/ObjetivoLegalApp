// Ownership boundary of the procesos routes: a user only ever sees, reads and
// writes the procesos they added. Every write path funnels through `existente`,
// so the isolation of the whole route table is asserted here at the service edge.
import { ApiError } from '../../common/http/api-error.js';
import { FakeCpnu } from '../testing/fake-cpnu.js';
import { InMemoryMetaRepository, InMemoryProcesoRepository } from '../testing/in-memory-proceso.repository.js';
import { actuacion, nota, proceso, tarea, USUARIO } from '../testing/proceso.fixtures.js';
import { DetectInstancesService } from './detect-instances.service.js';
import { ProcesosService } from './procesos.service.js';
import { RefreshProcesoService } from './refresh-proceso.service.js';

const OTRO = { id: 'u-luis', nombre: 'Luis' };
const RADICADO = '11001310300120190012300';

/** A foreign proceso must be indistinguishable from a missing one: 404, no data. */
async function esperaNoEncontrado(promesa: Promise<unknown>): Promise<void> {
  const error = await promesa.then(
    () => null,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(ApiError);
  const api = error as ApiError;
  expect(api.getStatus()).toBe(404);
  expect(api.getResponse()).toEqual({ error: 'Proceso no encontrado.' });
}

describe('ProcesosService (per-user ownership)', () => {
  let cpnu: FakeCpnu;
  let repo: InMemoryProcesoRepository;
  let meta: InMemoryMetaRepository;
  let service: ProcesosService;

  beforeEach(() => {
    cpnu = new FakeCpnu();
    repo = new InMemoryProcesoRepository([
      proceso('1', {
        alias: 'Caso de Ana',
        usuarioId: USUARIO.id,
        actuaciones: [actuacion(5)],
        notas: [nota('n1')],
        tareas: [tarea('t1')],
      }),
      proceso('2', { alias: 'Caso de Luis', usuarioId: OTRO.id, nuevaInstancia: true }),
    ]);
    meta = new InMemoryMetaRepository();
    const refresher = new RefreshProcesoService(cpnu, repo);
    service = new ProcesosService(repo, meta, cpnu, refresher, new DetectInstancesService(cpnu, repo, refresher));
  });

  /** Every `/procesos/:id` write, as the controller calls it. */
  const ESCRITURAS: [string, (id: string) => Promise<unknown>][] = [
    ['detalle', (id) => service.detalle(OTRO, id)],
    ['actualizarOficina', (id) => service.actualizarOficina(OTRO, id, { alias: 'Secuestrado' })],
    ['eliminar', (id) => service.eliminar(OTRO, id)],
    ['marcarVisto', (id) => service.marcarVisto(OTRO, id)],
    ['actualizar', (id) => service.actualizar(OTRO, id)],
    ['agregarNota', (id) => service.agregarNota(OTRO, id, { texto: 'Nota de Luis' })],
    ['eliminarNota', (id) => service.eliminarNota(OTRO, id, 'n1')],
    ['agregarTarea', (id) => service.agregarTarea(OTRO, id, { titulo: 'Tarea de Luis', fecha: '2026-03-10' })],
    ['actualizarTarea', (id) => service.actualizarTarea(OTRO, id, 't1', { hecha: true })],
    ['eliminarTarea', (id) => service.eliminarTarea(OTRO, id, 't1')],
    // The actuación has to belong to the proceso, not only the proceso to the caller.
    ['documentos', (id) => service.documentos(OTRO, id, '5')],
  ];

  it.each(ESCRITURAS)('%s answers 404 (never 403) on a proceso of another user', async (_, escribir) => {
    await esperaNoEncontrado(escribir('1'));
    // Nothing was touched: the owner still sees the proceso exactly as it was.
    expect(await repo.porIdProceso('1')).toMatchObject({
      alias: 'Caso de Ana',
      noVistas: [],
      notas: [nota('n1')],
      tareas: [tarea('t1')],
    });
  });

  it('keeps the owner able to read and write the same proceso', async () => {
    expect(await service.detalle(USUARIO, '1')).toMatchObject({ idProceso: '1', alias: 'Caso de Ana' });
    await expect(service.actualizarOficina(USUARIO, '1', { alias: 'Renombrado' })).resolves.toMatchObject({
      alias: 'Renombrado',
    });
  });

  it('lists and reports novedades only for the caller', async () => {
    expect((await service.list(OTRO)).procesos.map((p) => p.idProceso)).toEqual(['2']);
    expect((await service.list(USUARIO)).procesos.map((p) => p.idProceso)).toEqual(['1']);
    expect((await service.novedades(OTRO)).map((n) => n.idProceso)).toEqual(['2']);
    expect(await service.novedades(USUARIO)).toEqual([]);
  });

  it('leaves a row with no owner invisible to everyone', async () => {
    const huerfano = new InMemoryProcesoRepository([proceso('9', { usuarioId: null })]);
    const refresher = new RefreshProcesoService(cpnu, huerfano);
    const otro = new ProcesosService(huerfano, meta, cpnu, refresher, new DetectInstancesService(cpnu, huerfano, refresher));
    await esperaNoEncontrado(otro.detalle(USUARIO, '9'));
    await esperaNoEncontrado(otro.detalle(OTRO, '9'));
  });

  it('lists the documents of an actuación only for the owner', async () => {
    cpnu.documentos.set('5', [
      { id: 77, tipo: 'PDF', fechaCarga: '2026-01-01', nombre: 'Auto.pdf', url: 'https://cpnu/Descarga/Documento/77' },
    ]);

    await esperaNoEncontrado(service.documentos(OTRO, '1', '5'));
    expect(cpnu.calls).toEqual([]); // the foreign request never reaches CPNU

    await expect(service.documentos(USUARIO, '1', '5')).resolves.toEqual([
      expect.objectContaining({ nombre: 'Auto.pdf' }),
    ]);
  });

  it('answers 404 for an actuación that is not in the proceso, without asking CPNU', async () => {
    cpnu.documentos.set('99', [
      { id: 78, tipo: 'PDF', fechaCarga: '2026-01-01', nombre: 'Secreto.pdf', url: 'https://cpnu/Descarga/Documento/78' },
    ]);

    // CPNU looks up `idActuacion` office-wide, so owning the proceso is not enough.
    await esperaNoEncontrado(service.documentos(USUARIO, '1', '99'));
    expect(cpnu.calls).toEqual([]);
  });

  it('stamps the owner and the caller name on a new proceso', async () => {
    cpnu.radicados.set('11001310300120190012300', [{ idProceso: '7', despacho: 'J', sujetosProcesales: null, esPrivado: false }]);
    await service.add(USUARIO, { radicado: RADICADO });
    expect(await repo.porIdProceso('7')).toMatchObject({ usuarioId: USUARIO.id, agregadoPor: 'Ana' });
  });

  it('stamps hechaPor with the name of the user that completes a task', async () => {
    await service.actualizarTarea(USUARIO, '1', 't1', { hecha: true });
    expect((await repo.porIdProceso('1'))?.tareas[0]).toMatchObject({ hecha: true, hechaPor: 'Ana' });

    await service.actualizarTarea(USUARIO, '1', 't1', { hecha: false });
    expect((await repo.porIdProceso('1'))?.tareas[0]).toMatchObject({ hecha: false, hechaPor: null });
  });

  it('answers 409 when the radicado is already followed, for the same user', async () => {
    cpnu.radicados.set(RADICADO, [{ idProceso: '1', despacho: 'J', sujetosProcesales: null, esPrivado: false }]);
    const error = await service.add(USUARIO, { radicado: RADICADO }).then(() => null, (e: unknown) => e as ApiError);
    expect(error?.getStatus()).toBe(409);
    expect(error?.getResponse()).toEqual({ error: 'Ese proceso ya está en la lista.' });
  });
});
