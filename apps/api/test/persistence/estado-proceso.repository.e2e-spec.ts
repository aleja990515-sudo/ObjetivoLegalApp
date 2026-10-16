import type { DataSource } from 'typeorm';
import type { Proceso } from '../../src/procesos/domain/proceso.js';
import type { EstadoProceso } from '../../src/procesos/domain/estado-proceso.repository.js';
import { TypeOrmEstadoProcesoRepository } from '../../src/procesos/infrastructure/persistence/typeorm-estado-proceso.repository.js';
import { TypeOrmProcesoRepository } from '../../src/procesos/infrastructure/persistence/typeorm-proceso.repository.js';
import { proceso } from '../../src/procesos/testing/proceso.fixtures.js';
import { BETO, asegurarUsuarioActivo } from '../support/sesion.js';
import { createTestDataSource, truncateAll } from '../support/test-database.js';

/** A well-formed surrogate that is never stored, for "the proceso does not exist" cases. */
const AUSENTE = '00000000-0000-4000-8000-000000000000';

describe('TypeOrmEstadoProcesoRepository (Postgres)', () => {
  let dataSource: DataSource;
  let repo: TypeOrmEstadoProcesoRepository;
  let procesos: TypeOrmProcesoRepository;
  let caso: Proceso;

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
    // `procesos.usuario_id` is a real FK, and detections hang from the surrogate `id`.
    caso = proceso('101', { esPrivado: true, usuarioId: await asegurarUsuarioActivo(dataSource) });
    await procesos.insert(caso);
  });

  const deteccion = (overrides: Partial<EstadoProceso> = {}): EstadoProceso => ({
    procesoId: caso.id,
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
    expect(await repo.listarPorProceso(caso.id)).toEqual([deteccion()]);
    expect(await repo.listarPorProceso(AUSENTE)).toEqual([]);
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

    expect(await repo.listarPorProceso(caso.id)).toEqual([deteccion()]);
  });

  it('is deleted with its proceso and is not stored for a missing one', async () => {
    await repo.guardar(deteccion());
    await procesos.delete(caso.id);
    expect(await repo.listarPorProceso(caso.id)).toEqual([]);
    expect(await repo.guardar(deteccion())).toBe(false);
  });

  it('keeps the detections of two owners that follow the same idProceso apart', async () => {
    const beto = await asegurarUsuarioActivo(dataSource, BETO);
    const copia = proceso('101', { esPrivado: true, usuarioId: beto });
    await procesos.insert(copia);
    await repo.guardar(deteccion());
    await repo.guardar(deteccion({ procesoId: copia.id }));

    expect(await repo.listarNoVistos([caso.id])).toEqual([deteccion()]);
    expect(await repo.listarNoVistos([])).toEqual([]);
    expect(await repo.contarNoVistos()).toEqual(
      new Map([
        [caso.id, 1],
        [copia.id, 1],
      ]),
    );

    await repo.marcarVistos(caso.id);
    expect(await repo.listarNoVistos([caso.id, copia.id])).toEqual([deteccion({ procesoId: copia.id })]);
  });
});
