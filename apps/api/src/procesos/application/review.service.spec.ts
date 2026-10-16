import { META_ULTIMA_REVISION } from '../domain/meta.repository.js';
import { encontrado, FakeCpnu } from '../testing/fake-cpnu.js';
import { InMemoryMetaRepository, InMemoryProcesoRepository } from '../testing/in-memory-proceso.repository.js';
import { actuacion, proceso } from '../testing/proceso.fixtures.js';
import { DetectInstancesService } from './detect-instances.service.js';
import { RefreshProcesoService } from './refresh-proceso.service.js';
import { ReviewService } from './review.service.js';

const R1 = '11001310300120190012300';
const R2 = '05001310300120200045600';

describe('ReviewService', () => {
  let cpnu: FakeCpnu;
  let repo: InMemoryProcesoRepository;
  let meta: InMemoryMetaRepository;
  let sleep: ReturnType<typeof vi.fn<(ms: number) => Promise<void>>>;
  let service: ReviewService;

  beforeEach(() => {
    cpnu = new FakeCpnu();
    repo = new InMemoryProcesoRepository([
      proceso('1', { radicado: R1, alias: 'Primero', actuaciones: [actuacion(1)] }),
      proceso('2', { radicado: R1, alias: 'Segundo' }),
      proceso('3', { radicado: R2, actuaciones: [actuacion(30)] }),
    ]);
    meta = new InMemoryMetaRepository();
    sleep = vi.fn(async () => undefined);
    const refresher = new RefreshProcesoService(cpnu, repo);
    service = new ReviewService(repo, meta, refresher, new DetectInstancesService(cpnu, repo, refresher), sleep);
  });

  it('refreshes every proceso, detects instances once per radicado and records the review time', async () => {
    cpnu.procesos.set('1', { detalle: {}, sujetos: [], actuaciones: [actuacion(2), actuacion(1)] });
    cpnu.procesos.set('3', new Error('La Rama Judicial respondió 500'));
    cpnu.radicados.set(R1, [encontrado('1'), encontrado('2'), encontrado('9')]);
    cpnu.radicados.set(R2, [encontrado('3')]);

    const before = Temporal.Now.instant().epochMilliseconds;
    expect(await service.reviewAll()).toEqual({ nuevas: 1, instancias: 1, errores: 1 });

    expect(cpnu.calls.filter((c) => c.startsWith('search:'))).toEqual([`search:${R1}`, `search:${R2}`]);
    // The first proceso of each radicado is the base of new instances.
    expect((await repo.porIdProceso('9'))?.alias).toBe('Primero (nueva instancia)');
    expect((await repo.porIdProceso('3'))?.error).toBe('La Rama Judicial respondió 500');
    expect(Temporal.Instant.from((await meta.get(META_ULTIMA_REVISION)) ?? '').epochMilliseconds).toBeGreaterThanOrEqual(before);
  });

  it('paces CPNU calls: 1s per proceso and 0.5s per radicado', async () => {
    await service.reviewAll();
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([1000, 1000, 1000, 500, 500]);
  });

  it('counts failed instance detections as errors', async () => {
    cpnu.radicados.set(R2, new Error('La Rama Judicial respondió 500'));
    expect(await service.reviewAll()).toEqual({ nuevas: 0, instancias: 0, errores: 1 });
  });

  it('skips procesos deleted during the review', async () => {
    const deleting = vi.spyOn(repo, 'findByIdForReview').mockImplementationOnce(async () => null);
    const result = await service.reviewAll();
    expect(deleting).toHaveBeenCalled();
    expect(cpnu.calls).not.toContain('load:1');
    expect(result.errores).toBe(0);
  });

  it('shares a run already in progress instead of starting another', async () => {
    let release!: () => void;
    sleep.mockImplementationOnce(() => new Promise<void>((r) => (release = r)));
    const first = service.reviewAll();
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    expect(service.running).toBe(true);
    const second = service.reviewAll();
    release();
    expect(await second).toEqual(await first);
    expect(cpnu.calls.filter((c) => c === 'load:1')).toHaveLength(1);
    expect(service.running).toBe(false);
  });

  it('reviews the procesos of every user: the cron has no session', async () => {
    const conOtroDueno = new InMemoryProcesoRepository([
      proceso('1', { radicado: R1, usuarioId: 'u-ana' }),
      proceso('4', { radicado: R2, usuarioId: 'u-luis' }),
      proceso('5', { radicado: R2, usuarioId: 'u-luis' }),
    ]);
    const refresher = new RefreshProcesoService(cpnu, conOtroDueno);
    const otro = new ReviewService(
      conOtroDueno,
      meta,
      refresher,
      new DetectInstancesService(cpnu, conOtroDueno, refresher),
      sleep,
    );

    await otro.reviewAll();

    expect(cpnu.calls.filter((c) => c.startsWith('load:')).sort()).toEqual(['load:1', 'load:4', 'load:5']);
  });

  it('propagates a new instance to every co-follower of the radicado', async () => {
    const ANA = '9b8c7d6e-5f4a-4b3c-9d8e-7f6a5b4c3d2e';
    const LUIS = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
    const coSiguen = new InMemoryProcesoRepository([
      proceso('1', { radicado: R1, usuarioId: ANA }),
      proceso('2', { radicado: R1, usuarioId: LUIS }),
    ]);
    const refresher = new RefreshProcesoService(cpnu, coSiguen);
    const otro = new ReviewService(
      coSiguen,
      meta,
      refresher,
      new DetectInstancesService(cpnu, coSiguen, refresher),
      sleep,
    );
    cpnu.radicados.set(R1, [encontrado('9')]);

    expect(await otro.reviewAll()).toEqual({ nuevas: 0, instancias: 2, errores: 0 });

    expect((await coSiguen.porIdProceso('9', ANA))?.nuevaInstancia).toBe(true);
    expect((await coSiguen.porIdProceso('9', LUIS))?.nuevaInstancia).toBe(true);
    // One search per radicado, not one per owner: the co-follower costs no extra call.
    expect(cpnu.calls.filter((c) => c.startsWith('search:'))).toEqual([`search:${R1}`]);
  });
});
