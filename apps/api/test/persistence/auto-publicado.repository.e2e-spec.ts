import type { DataSource } from 'typeorm';
import type { AutoPublicado } from '../../src/procesos/domain/auto-publicado.repository.js';
import type { Proceso } from '../../src/procesos/domain/proceso.js';
import { TypeOrmAutoPublicadoRepository } from '../../src/procesos/infrastructure/persistence/typeorm-auto-publicado.repository.js';
import { TypeOrmProcesoRepository } from '../../src/procesos/infrastructure/persistence/typeorm-proceso.repository.js';
import { actuacion, proceso } from '../../src/procesos/testing/proceso.fixtures.js';
import { asegurarUsuarioActivo } from '../support/sesion.js';
import { createTestDataSource, truncateAll } from '../support/test-database.js';

describe('TypeOrmAutoPublicadoRepository (Postgres)', () => {
  let dataSource: DataSource;
  let repo: TypeOrmAutoPublicadoRepository;
  let procesos: TypeOrmProcesoRepository;
  let ana: string;
  let caso: Proceso;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    repo = new TypeOrmAutoPublicadoRepository(dataSource);
    procesos = new TypeOrmProcesoRepository(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await truncateAll(dataSource);
    // `procesos.usuario_id` is a real uuid FK, so the owner row has to exist for the seed.
    ana = await asegurarUsuarioActivo(dataSource);
    caso = proceso('101', { usuarioId: ana, actuaciones: [actuacion(9_000_000_001, { actuacion: 'Auto Decide', cons: 1 })] });
    await procesos.insert(caso);
  });

  const auto = (overrides: Partial<AutoPublicado> = {}): AutoPublicado => ({
    procesoId: caso.id,
    idActuacion: 9_000_000_001,
    confianza: 'exacto',
    urlPdf: 'https://portal.test/c/document_library/get_file?uuid=1&groupId=2',
    nombreArchivo: '031202600100Concede.pdf',
    urlEstado: 'https://portal.test/web/publicaciones-procesales/inicio?articleId=1',
    numeroEstado: '132',
    fechaPublicacion: '2026-09-15',
    buscadoEn: '2026-10-13T12:00:00.123Z',
    intentos: 1,
    ...overrides,
  });

  it('stores and reads a result', async () => {
    expect(await repo.guardar(auto())).toBe(true);
    expect(await repo.buscar(caso.id, 9_000_000_001)).toEqual(auto());
    expect(await repo.buscar(caso.id, 1)).toBeNull();
  });

  it('replaces the row of the same actuación', async () => {
    await repo.guardar(auto({ confianza: 'sin_resultado', urlPdf: null, nombreArchivo: null, urlEstado: null, numeroEstado: null, fechaPublicacion: null }));
    await repo.guardar(auto({ intentos: 2, buscadoEn: '2026-10-16T12:00:00.000Z' }));
    expect(await repo.buscar(caso.id, 9_000_000_001)).toEqual(auto({ intentos: 2, buscadoEn: '2026-10-16T12:00:00.000Z' }));
  });

  it('keeps the result when CPNU rewrites the actuaciones', async () => {
    await repo.guardar(auto());
    await procesos.updateCpnuState(caso.id, (s) => ({ ...s, actuaciones: [actuacion(9_000_000_001, { actuacion: 'Auto Decide', cons: 7 })] }));
    expect(await repo.buscar(caso.id, 9_000_000_001)).not.toBeNull();
  });

  it('is deleted with its proceso and is not stored for a missing one', async () => {
    await repo.guardar(auto());
    await procesos.delete(caso.id);
    expect(await repo.buscar(caso.id, 9_000_000_001)).toBeNull();
    expect(await repo.guardar(auto())).toBe(false);
  });

  it('rejects an unknown confidence level', async () => {
    await expect(repo.guardar(auto({ confianza: 'quiza' as AutoPublicado['confianza'] }))).rejects.toThrow();
  });
});
