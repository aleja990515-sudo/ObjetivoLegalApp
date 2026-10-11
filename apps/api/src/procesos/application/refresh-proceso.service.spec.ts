import { FakeCpnu } from '../testing/fake-cpnu.js';
import { InMemoryProcesoRepository } from '../testing/in-memory-proceso.repository.js';
import { actuacion, nota, proceso } from '../testing/proceso.fixtures.js';
import { RefreshProcesoService } from './refresh-proceso.service.js';

describe('RefreshProcesoService', () => {
  let cpnu: FakeCpnu;
  let repo: InMemoryProcesoRepository;
  let service: RefreshProcesoService;

  beforeEach(() => {
    cpnu = new FakeCpnu();
    repo = new InMemoryProcesoRepository([
      proceso('1', { actuaciones: [actuacion(1)], alias: 'Caso', notas: [nota('n1')] }),
    ]);
    service = new RefreshProcesoService(cpnu, repo);
  });

  it('stores the CPNU data and reports new actuaciones', async () => {
    cpnu.procesos.set('1', { detalle: { despacho: 'J' }, sujetos: [], actuaciones: [actuacion(2), actuacion(1)] });
    const result = await service.refresh('1');
    expect(result).toMatchObject({ nuevas: 1, error: null });
    const stored = await repo.findById('1');
    expect(stored).toMatchObject({ detalle: { despacho: 'J' }, noVistas: [2], error: null, alias: 'Caso' });
    expect(stored?.ultimaConsulta).toEqual(expect.any(String));
    expect(stored?.notas).toHaveLength(1);
  });

  it('records the CPNU error message and keeps the previous data', async () => {
    cpnu.procesos.set('1', new Error('La Rama Judicial respondió 500'));
    const result = await service.refresh('1');
    expect(result).toMatchObject({ nuevas: 0, error: 'La Rama Judicial respondió 500' });
    const stored = await repo.findById('1');
    expect(stored).toMatchObject({ error: 'La Rama Judicial respondió 500', actuaciones: [actuacion(1)] });
  });

  it('does nothing for a proceso deleted meanwhile', async () => {
    cpnu.procesos.set('2', { detalle: {}, sujetos: [], actuaciones: [actuacion(9)] });
    expect(await service.refresh('2')).toEqual({ state: null, nuevas: 0, error: null });
    expect(await repo.findById('2')).toBeNull();
  });

  describe('hydrateNew', () => {
    it('loads the CPNU data of a not-yet-stored proceso without marking anything new', async () => {
      cpnu.procesos.set('7', { detalle: { a: 1 }, sujetos: [{ tipo: 't', nombre: 'n' }], actuaciones: [actuacion(3)] });
      const hydrated = await service.hydrateNew(proceso('7', { alias: 'Nuevo' }));
      expect(hydrated).toMatchObject({
        idProceso: '7',
        alias: 'Nuevo',
        detalle: { a: 1 },
        sujetos: [{ tipo: 't', nombre: 'n' }],
        actuaciones: [actuacion(3)],
        noVistas: [],
        error: null,
      });
      expect(hydrated.ultimaConsulta).toEqual(expect.any(String));
      expect(await repo.findById('7')).toBeNull(); // the caller stores it
    });

    it('keeps the proceso with the error message when CPNU fails', async () => {
      const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
      cpnu.procesos.set('7', timeout as unknown as Error);
      const hydrated = await service.hydrateNew(proceso('7'));
      expect(hydrated).toMatchObject({ error: 'The operation was aborted due to timeout', ultimaConsulta: null });
    });
  });
});
