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

    expect(await service.detect(RADICADO, base)).toBe(1);

    expect(await repo.findByIdForReview('3')).toBeNull();
    expect(await repo.findByIdForReview('2')).toMatchObject({
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
    expect(await service.detect(RADICADO, null)).toBe(1);
    expect(await repo.findByIdForReview('2')).toMatchObject({ error: 'La Rama Judicial respondió 503', alias: '' });
  });

  it('propagates search failures to the caller', async () => {
    cpnu.radicados.set(RADICADO, new Error('La Rama Judicial respondió 500'));
    await expect(service.detect(RADICADO, base)).rejects.toThrow('La Rama Judicial respondió 500');
  });

  it('gives the new instance to the owner of the base, and never to the office', async () => {
    cpnu.radicados.set(RADICADO, [encontrado('2')]);
    await service.detect(RADICADO, base);
    const creado = await repo.findByIdForReview('2');
    expect(creado?.usuarioId).toBe(base.usuarioId);
    expect(await repo.findAll(LUIS)).toEqual([]);
    expect(await repo.listRefs(USUARIO.id)).toEqual([
      { idProceso: '1', radicado: RADICADO },
      { idProceso: '2', radicado: RADICADO },
    ]);
  });

  it('dedupes only inside the owner list, so an id followed by another user is re-proposed', async () => {
    repo = new InMemoryProcesoRepository([base, proceso('2', { radicado: RADICADO, usuarioId: LUIS })]);
    service = new DetectInstancesService(cpnu, repo, new RefreshProcesoService(cpnu, repo));
    cpnu.radicados.set(RADICADO, [encontrado('2')]);

    expect(await service.detect(RADICADO, base)).toBe(0);
    expect((await repo.findByIdForReview('2'))?.usuarioId).toBe(LUIS);
  });

  it('does not fail on an ownerless base: there is no uuid to scope the dedup with', async () => {
    cpnu.radicados.set(RADICADO, [encontrado('2')]);
    const huerfano = proceso('1', { radicado: RADICADO, usuarioId: null });

    expect(await service.detect(RADICADO, huerfano)).toBe(1);
    expect((await repo.findByIdForReview('2'))?.usuarioId).toBeNull();
  });
});
