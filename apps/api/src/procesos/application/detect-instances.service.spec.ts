import { encontrado, FakeCpnu } from '../testing/fake-cpnu.js';
import { InMemoryProcesoRepository } from '../testing/in-memory-proceso.repository.js';
import { actuacion, proceso, USUARIO } from '../testing/proceso.fixtures.js';
import { DetectInstancesService } from './detect-instances.service.js';
import { RefreshProcesoService } from './refresh-proceso.service.js';

const RADICADO = '11001310300120190012300';
const LUIS = '9b8c7d6e-5f4a-4b3c-9d8e-7f6a5b4c3d2e';

describe('DetectInstancesService', () => {
  let cpnu: FakeCpnu;
  let repo: InMemoryProcesoRepository;
  let service: DetectInstancesService;
  const base = proceso('1', { radicado: RADICADO, alias: 'Caso A', responsable: 'Luis', etiquetas: ['civil'] });

  beforeEach(() => {
    cpnu = new FakeCpnu();
    repo = new InMemoryProcesoRepository([base]);
    service = new DetectInstancesService(cpnu, repo, new RefreshProcesoService(cpnu, repo));
  });

  it('adds new public instances inheriting the office data, skipping known and private ones', async () => {
    cpnu.radicados.set(RADICADO, [encontrado('1'), encontrado('2'), encontrado('3', { esPrivado: true })]);
    cpnu.procesos.set('2', { detalle: { despacho: 'TRIBUNAL' }, sujetos: [], actuaciones: [actuacion(5)] });

    expect(await service.detect(RADICADO, [base])).toBe(1);

    expect(await repo.porIdProceso('3')).toBeNull();
    expect(await repo.porIdProceso('2')).toMatchObject({
      radicado: RADICADO,
      alias: 'Caso A (nueva instancia)',
      responsable: 'Luis',
      etiquetas: ['civil'],
      nuevaInstancia: true,
      agregadoPor: 'Revisión automática',
      detalle: { despacho: 'TRIBUNAL' },
      actuaciones: [actuacion(5)],
      noVistas: [],
    });
  });

  it('stores the new instance with the error when loading it fails', async () => {
    cpnu.radicados.set(RADICADO, [encontrado('2')]);
    cpnu.procesos.set('2', new Error('La Rama Judicial respondió 503'));
    expect(await service.detect(RADICADO, [null])).toBe(1);
    expect(await repo.porIdProceso('2')).toMatchObject({ error: 'La Rama Judicial respondió 503', alias: '' });
  });

  it('propagates search failures to the caller', async () => {
    cpnu.radicados.set(RADICADO, new Error('La Rama Judicial respondió 500'));
    await expect(service.detect(RADICADO, [base])).rejects.toThrow('La Rama Judicial respondió 500');
  });

  it('gives the new instance to the owner of the base, and never to the office', async () => {
    cpnu.radicados.set(RADICADO, [encontrado('2')]);
    await service.detect(RADICADO, [base]);
    const creado = await repo.porIdProceso('2');
    expect(creado?.usuarioId).toBe(base.usuarioId);
    expect(await repo.findAll(LUIS)).toEqual([]);
    expect(await repo.listRefs(USUARIO.id)).toEqual([
      expect.objectContaining({ idProceso: '1', radicado: RADICADO }),
      expect.objectContaining({ idProceso: '2', radicado: RADICADO }),
    ]);
    // The two rows share `idProceso`, so only the surrogate tells them apart.
    expect(new Set((await repo.listRefs(USUARIO.id)).map((r) => r.id)).size).toBe(2);
  });

  it('gives the base owner its own copy even when another user already follows the id', async () => {
    // With `id_proceso` as the global key this insert was a silent skip that hid the
    // colleague's caseload. Now the conflict is per owner, so both copies exist.
    repo = new InMemoryProcesoRepository([base, proceso('2', { radicado: RADICADO, usuarioId: LUIS })]);
    service = new DetectInstancesService(cpnu, repo, new RefreshProcesoService(cpnu, repo));
    cpnu.radicados.set(RADICADO, [encontrado('2')]);

    expect(await service.detect(RADICADO, [base])).toBe(1);
    expect(await repo.porIdProceso('2', LUIS)).toMatchObject({ usuarioId: LUIS });
    expect(await repo.porIdProceso('2', USUARIO.id)).toMatchObject({
      usuarioId: USUARIO.id,
      nuevaInstancia: true,
    });
  });

  it('gives the new instance to every co-follower of the radicado, off a single search', async () => {
    repo = new InMemoryProcesoRepository([base, proceso('2', { radicado: RADICADO, usuarioId: LUIS })]);
    service = new DetectInstancesService(cpnu, repo, new RefreshProcesoService(cpnu, repo));
    cpnu.radicados.set(RADICADO, [encontrado('9')]);

    expect(await service.detect(RADICADO, [base, await repo.findById('2', LUIS)])).toBe(2);

    expect(cpnu.calls.filter((c) => c.startsWith('search:'))).toEqual([`search:${RADICADO}`]);
    expect(await repo.porIdProceso('9', USUARIO.id)).toMatchObject({ usuarioId: USUARIO.id });
    expect(await repo.porIdProceso('9', LUIS)).toMatchObject({ usuarioId: LUIS, nuevaInstancia: true });
  });

  it('does not fail on an ownerless base: there is no uuid to scope the dedup with', async () => {
    cpnu.radicados.set(RADICADO, [encontrado('2')]);
    const huerfano = proceso('1', { radicado: RADICADO, usuarioId: null });

    expect(await service.detect(RADICADO, [huerfano])).toBe(1);
    expect((await repo.porIdProceso('2'))?.usuarioId).toBeNull();
  });

  it('never appends a second orphan for the same id_proceso, however often it runs', async () => {
    // Regression: with only `UNIQUE (usuario_id, id_proceso)` an ownerless base dedupes
    // against nothing and the insert never conflicts, so every review appended another
    // copy. `procesos_huerfano_uniq` is what stops the pile from growing.
    cpnu.radicados.set(RADICADO, [encontrado('2'), encontrado('3')]);
    const huerfano = proceso('1', { radicado: RADICADO, usuarioId: null });
    repo = new InMemoryProcesoRepository([huerfano]);
    service = new DetectInstancesService(cpnu, repo, new RefreshProcesoService(cpnu, repo));

    await service.detect(RADICADO, [huerfano]);
    const tras = (await repo.listRefsForReview()).map((r) => r.idProceso).sort();
    await service.detect(RADICADO, [huerfano]);

    expect((await repo.listRefsForReview()).map((r) => r.idProceso).sort()).toEqual(tras);
    expect(tras).toEqual(['1', '2', '3']);
  });
});
