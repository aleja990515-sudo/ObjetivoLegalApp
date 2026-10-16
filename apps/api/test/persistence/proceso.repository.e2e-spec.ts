import type { DataSource } from 'typeorm';
import { actuacion, nota, proceso, tarea } from '../../src/procesos/testing/proceso.fixtures.js';
import type { Proceso, ProcesoCpnuState } from '../../src/procesos/domain/proceso.js';
import { TypeOrmMetaRepository } from '../../src/procesos/infrastructure/persistence/typeorm-meta.repository.js';
import { TypeOrmProcesoRepository } from '../../src/procesos/infrastructure/persistence/typeorm-proceso.repository.js';
import { BETO, asegurarUsuarioActivo } from '../support/sesion.js';
import { createTestDataSource, truncateAll } from '../support/test-database.js';

/** A well-formed surrogate that is never stored, for "the row does not exist" cases. */
const AUSENTE = '00000000-0000-4000-8000-000000000000';

describe('TypeOrmProcesoRepository (Postgres)', () => {
  let dataSource: DataSource;
  let repo: TypeOrmProcesoRepository;
  let ana: string;
  let caso: Proceso;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    repo = new TypeOrmProcesoRepository(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await truncateAll(dataSource);
    // `procesos.usuario_id` is a real FK, so the owner row must exist before inserting.
    ana = await asegurarUsuarioActivo(dataSource);
    caso = undefined as unknown as Proceso;
  });

  /**
   * Built per test and memoized: `ana` only exists after `beforeEach`, and the
   * surrogate `id` has to be the very one stored, since `id_proceso` is not a key.
   */
  const full = (): Proceso =>
    (caso ??= proceso('101', {
      usuarioId: ana,
      esPrivado: true,
      detalle: { despacho: 'JUZGADO 1', claseProceso: 'Verbal', nested: { a: [1, 2] } },
      sujetos: [
        { tipo: 'Demandante', nombre: 'A' },
        { tipo: 'Demandado', nombre: 'B' },
      ],
      actuaciones: [actuacion(9_000_000_003, { cons: 3 }), actuacion(2), actuacion(1)],
      noVistas: [9_000_000_003],
      ultimaConsulta: '2026-02-02T11:00:00.123Z',
      alias: 'Caso A',
      responsable: 'Luis',
      etiquetas: ['civil', 'urgente'],
      nuevaInstancia: true,
      notas: [nota('n2', { fecha: '2026-02-03T00:00:00.000Z' }), nota('n1')],
      tareas: [tarea('t1', { hora: '09:30', idActuacion: '2' }), tarea('t2', { fecha: '2026-12-31' })],
    }));

  it('inserts and reads back a full aggregate', async () => {
    expect(await repo.insert(full())).toBe(true);
    expect(await repo.findById('101', ana)).toEqual(full());
    expect(await repo.findAll(ana)).toEqual([full()]);
    expect(await repo.listRefs(ana)).toEqual([{ id: caso.id, idProceso: '101', radicado: full().radicado }]);
  });

  it('scopes the reads to the owner and keeps the review scope global', async () => {
    const beto = await asegurarUsuarioActivo(dataSource, BETO);
    const otro = proceso('202', { usuarioId: beto });
    await repo.insert(full());
    await repo.insert(otro);

    expect(await repo.findById('101', beto)).toBeNull();
    expect(await repo.findAll(beto)).toEqual([otro]);
    expect(await repo.listRefs(beto)).toEqual([{ id: otro.id, idProceso: '202', radicado: otro.radicado }]);
    expect(await repo.findByIdForReview(caso.id)).toEqual(full());
    expect((await repo.listRefsForReview()).map((r) => r.id).sort()).toEqual([caso.id, otro.id].sort());
  });

  it('does not insert the same idProceso twice for the same owner', async () => {
    await repo.insert(full());
    expect(await repo.insert(proceso('101', { usuarioId: ana, alias: 'otro' }))).toBe(false);
    expect((await repo.findById('101', ana))?.alias).toBe('Caso A');
  });

  it('lets two owners follow the same idProceso, each with its own children', async () => {
    const beto = await asegurarUsuarioActivo(dataSource, BETO);
    await repo.insert(full());
    const copiaBeto = proceso('101', { usuarioId: beto, alias: 'Copia de Beto', notas: [nota('nb')] });
    expect(await repo.insert(copiaBeto)).toBe(true);
    expect(copiaBeto.id).not.toBe(caso.id);

    expect(await repo.findById('101', ana)).toMatchObject({ alias: 'Caso A', notas: full().notas });
    expect(await repo.findById('101', beto)).toMatchObject({ alias: 'Copia de Beto', notas: [nota('nb')] });

    await repo.delete(caso.id);
    expect(await repo.findById('101', ana)).toBeNull();
    expect(await repo.findById('101', beto)).toMatchObject({ alias: 'Copia de Beto' });
  });

  it('keeps a single orphan per idProceso, so the cron cannot pile duplicates up', async () => {
    // Regression: `UNIQUE (usuario_id, id_proceso)` compares NULL owners as distinct,
    // so `orIgnore()` never saw a conflict and every scheduled review appended another
    // copy. `procesos_huerfano_uniq` is the index that makes this return false.
    await repo.insert(proceso('303', { usuarioId: null }));
    expect(await repo.insert(proceso('303', { usuarioId: null }))).toBe(false);
    expect(await repo.listRefsForReview()).toHaveLength(1);
  });

  it('returns null for unknown procesos and deletes with cascade', async () => {
    expect(await repo.findById('nope', ana)).toBeNull();
    await repo.insert(full());
    expect(await repo.delete(caso.id)).toBe(true);
    expect(await repo.delete(caso.id)).toBe(false);
    const [{ count }] = await dataSource.query('SELECT count(*)::int AS count FROM actuaciones');
    expect(count).toBe(0);
  });

  describe('updateCpnuState', () => {
    const fetched = (current: ProcesoCpnuState): ProcesoCpnuState => ({
      detalle: { despacho: 'TRIBUNAL' },
      sujetos: [{ tipo: 'Demandante', nombre: 'Z' }],
      actuaciones: [actuacion(4), ...current.actuaciones],
      noVistas: [...current.noVistas, 4],
      ultimaConsulta: '2026-03-01T00:00:00.000Z',
      error: null,
    });

    it('writes only CPNU-owned data', async () => {
      await repo.insert(full());
      const result = await repo.updateCpnuState(caso.id, fetched);
      expect(result?.noVistas).toEqual([4, 9_000_000_003]);
      const after = await repo.findById('101', ana);
      expect(after).toMatchObject({
        detalle: { despacho: 'TRIBUNAL' },
        sujetos: [{ tipo: 'Demandante', nombre: 'Z' }],
        noVistas: [4, 9_000_000_003],
        ultimaConsulta: '2026-03-01T00:00:00.000Z',
        // office data untouched
        alias: 'Caso A',
        responsable: 'Luis',
        etiquetas: ['civil', 'urgente'],
        nuevaInstancia: true,
        notas: full().notas,
        tareas: full().tareas,
      });
      expect(after?.actuaciones.map((a) => a.id)).toEqual([4, 9_000_000_003, 2, 1]);
    });

    it('prunes unseen ids that are not among the actuaciones', async () => {
      await repo.insert(full());
      const result = await repo.updateCpnuState(caso.id, (c) => ({ ...c, noVistas: [...c.noVistas, 777] }));
      expect(result?.noVistas).toEqual([9_000_000_003]);
    });

    it('updates only the error when the actuaciones did not change', async () => {
      await repo.insert(full());
      await repo.updateCpnuState(caso.id, (c) => ({ ...c, error: 'La Rama Judicial respondió 500' }));
      const after = await repo.findById('101', ana);
      expect(after).toEqual({ ...full(), error: 'La Rama Judicial respondió 500' });
    });

    it('never resurrects a deleted proceso', async () => {
      const mutate = vi.fn(fetched);
      // A valid uuid that was never stored: `id_proceso` is not a key any more.
      expect(await repo.updateCpnuState(AUSENTE, mutate)).toBeNull();
      expect(mutate).not.toHaveBeenCalled();
      expect(await repo.findById('101', ana)).toBeNull();
    });

    it('waits for the row lock and keeps office edits committed meanwhile', async () => {
      await repo.insert(full());
      const runner = dataSource.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      await runner.query('SELECT 1 FROM procesos WHERE id = $1 FOR UPDATE', [caso.id]);
      await runner.query(`UPDATE procesos SET alias = 'Editado' WHERE id = $1`, [caso.id]);

      let done = false;
      const refresh = repo.updateCpnuState(caso.id, fetched).then((r) => {
        done = true;
        return r;
      });
      await new Promise((r) => setTimeout(r, 300));
      expect(done).toBe(false); // blocked by FOR UPDATE

      await runner.commitTransaction();
      await runner.release();
      await refresh;

      const after = await repo.findById('101', ana);
      expect(after?.alias).toBe('Editado');
      expect(after?.detalle).toEqual({ despacho: 'TRIBUNAL' });
    });

    it('does not resurrect a proceso deleted while the refresh waited for the lock', async () => {
      await repo.insert(full());
      const runner = dataSource.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      await runner.query('DELETE FROM procesos WHERE id = $1', [caso.id]);
      const refresh = repo.updateCpnuState(caso.id, fetched);
      await new Promise((r) => setTimeout(r, 200));
      await runner.commitTransaction();
      await runner.release();
      expect(await refresh).toBeNull();
      expect(await repo.findById('101', ana)).toBeNull();
    });
  });

  it('updates office fields and marks everything as seen', async () => {
    await repo.insert(full());
    expect(await repo.updateOffice(caso.id, { alias: 'Nuevo', etiquetas: [] })).toBe(true);
    expect(await repo.updateOffice(AUSENTE, { alias: 'x' })).toBe(false);
    expect(await repo.markSeen(caso.id)).toBe(true);
    expect(await repo.markSeen(AUSENTE)).toBe(false);
    const after = await repo.findById('101', ana);
    expect(after).toMatchObject({
      alias: 'Nuevo',
      etiquetas: [],
      responsable: 'Luis',
      nuevaInstancia: false,
      noVistas: [],
    });
  });

  it('adds and deletes notas (newest first)', async () => {
    await repo.insert(full());
    expect(await repo.addNota(caso.id, nota('n3', { fecha: '2026-02-04T00:00:00.000Z' }))).toBe(true);
    expect(await repo.addNota(AUSENTE, nota('n4'))).toBe(false);
    expect((await repo.findById('101', ana))?.notas.map((n) => n.id)).toEqual(['n3', 'n2', 'n1']);
    expect(await repo.deleteNota(caso.id, 'n2')).toBe(true);
    expect(await repo.deleteNota(caso.id, 'n2')).toBe(false);
    expect((await repo.findById('101', ana))?.notas.map((n) => n.id)).toEqual(['n3', 'n1']);
  });

  it('adds, updates and deletes tareas (creation order)', async () => {
    await repo.insert(full());
    expect(await repo.addTarea(caso.id, tarea('t3'))).toBe(true);
    expect(await repo.updateTarea(caso.id, 't1', { hecha: true, hechaPor: 'Ana', fecha: '2026-04-01' })).toBe(true);
    expect(await repo.updateTarea(caso.id, 'zz', { hecha: true })).toBe(false);
    expect(await repo.updateTarea(caso.id, 't1', {})).toBe(true);
    expect(await repo.deleteTarea(caso.id, 't2')).toBe(true);
    const tareas = (await repo.findById('101', ana))?.tareas;
    expect(tareas?.map((t) => t.id)).toEqual(['t1', 't3']);
    expect(tareas?.[0]).toMatchObject({ hecha: true, hechaPor: 'Ana', fecha: '2026-04-01', hora: '09:30' });
  });
});

describe('TypeOrmMetaRepository (Postgres)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    await truncateAll(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('gets and upserts values', async () => {
    const meta = new TypeOrmMetaRepository(dataSource);
    expect(await meta.get('ultimaRevision')).toBeNull();
    await meta.set('ultimaRevision', '2026-01-01T00:00:00.000Z');
    await meta.set('ultimaRevision', '2026-01-02T00:00:00.000Z');
    expect(await meta.get('ultimaRevision')).toBe('2026-01-02T00:00:00.000Z');
  });
});
