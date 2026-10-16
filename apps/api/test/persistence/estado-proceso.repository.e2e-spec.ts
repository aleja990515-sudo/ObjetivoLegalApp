import type { DataSource } from 'typeorm';
import type { EstadoProceso } from '../../src/procesos/domain/estado-proceso.repository.js';
import { TypeOrmEstadoProcesoRepository } from '../../src/procesos/infrastructure/persistence/typeorm-estado-proceso.repository.js';
import { TypeOrmProcesoRepository } from '../../src/procesos/infrastructure/persistence/typeorm-proceso.repository.js';
import { proceso } from '../../src/procesos/testing/proceso.fixtures.js';
import { createTestDataSource, truncateAll } from '../support/test-database.js';

describe('TypeOrmEstadoProcesoRepository (Postgres)', () => {
  let dataSource: DataSource;
  let repo: TypeOrmEstadoProcesoRepository;
  let procesos: TypeOrmProcesoRepository;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    repo = new TypeOrmEstadoProcesoRepository(dataSource);
    procesos = new TypeOrmProcesoRepository(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await truncateAll(dataSource);
    await procesos.insert(proceso('101', { esPrivado: true }));
  });

  const deteccion = (overrides: Partial<EstadoProceso> = {}): EstadoProceso => ({
    idProceso: '101',
    urlEstado: 'https://portal.test/web/publicaciones-procesales/inicio?articleId=174',
    numeroEstado: '174',
    fechaPublicacion: '2026-10-14',
    radicadoEncontrado: '05001311000320260030200',
    visto: false,
    detectadoEn: '2026-10-15T12:00:00.123Z',
    ...overrides,
  });

  it('stores a detection and reads it back', async () => {
    expect(await repo.guardar(deteccion())).toBe(true);
    expect(await repo.listarPorProceso('101')).toEqual([deteccion()]);
    expect(await repo.listarPorProceso('999')).toEqual([]);
  });

  it('does not duplicate the same (proceso, estado) and keeps the committed row', async () => {
    await repo.guardar(deteccion());
    await repo.guardar(
      deteccion({
        visto: true,
        radicadoEncontrado: '05001311000320260030201',
        detectadoEn: '2026-11-01T00:00:00.000Z',
      }),
    );

    expect(await repo.listarPorProceso('101')).toEqual([deteccion()]);
  });

  it('is deleted with its proceso and is not stored for a missing one', async () => {
    await repo.guardar(deteccion());
    await procesos.delete('101');
    expect(await repo.listarPorProceso('101')).toEqual([]);
    expect(await repo.guardar(deteccion())).toBe(false);
  });
});
