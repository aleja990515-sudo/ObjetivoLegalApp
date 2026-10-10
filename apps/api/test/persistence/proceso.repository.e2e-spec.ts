import type { DataSource } from 'typeorm';
import { actuacion, nota, proceso, tarea } from '../../src/procesos/domain/proceso.fixtures.js';
import type { ProcesoCpnuState } from '../../src/procesos/domain/proceso.js';
import { TypeOrmMetaRepository } from '../../src/procesos/infrastructure/persistence/typeorm-meta.repository.js';
import { TypeOrmProcesoRepository } from '../../src/procesos/infrastructure/persistence/typeorm-proceso.repository.js';
import { createTestDataSource, truncateAll } from '../support/test-database.js';

describe('TypeOrmProcesoRepository (Postgres)', () => {
  let dataSource: DataSource;
  let repo: TypeOrmProcesoRepository;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    repo = new TypeOrmProcesoRepository(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  beforeEach(async () => {
    await truncateAll(dataSource);
  });

  const full = proceso('101', {
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
  });

  it('inserts and reads back a full aggregate', async () => {
    expect(await repo.insert(full)).toBe(true);
    expect(await repo.findById('101')).toEqual(full);
    expect(await repo.findAll()).toEqual([full]);
    expect(await repo.listRefs()).toEqual([{ idProceso: '101', radicado: full.radicado }]);
  });

  it('does not insert the same idProceso twice', async () => {
    await repo.insert(full);
    expect(await repo.insert(proceso('101', { alias: 'otro' }))).toBe(false);
    expect((await repo.findById('101'))?.alias).toBe('Caso A');
  });

  it('returns null for unknown procesos and deletes with cascade', async () => {
    expect(await repo.findById('nope')).toBeNull();
    await repo.insert(full);
    expect(await repo.delete('101')).toBe(true);
    expect(await repo.delete('101')).toBe(false);
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
      await repo.insert(full);
      const result = await repo.updateCpnuState('101', fetched);
      expect(result?.noVistas).toEqual([4, 9_000_000_003]);
      const after = await repo.findById('101');
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
        notas: full.notas,
        tareas: full.tareas,
      });
      expect(after?.actuaciones.map((a) => a.id)).toEqual([4, 9_000_000_003, 2, 1]);
    });

    it('prunes unseen ids that are not among the actuaciones', async () => {
      await repo.insert(full);
      const result = await repo.updateCpnuState('101', (c) => ({ ...c, noVistas: [...c.noVistas, 777] }));
      expect(result?.noVistas).toEqual([9_000_000_003]);
    });

    it('updates only the error when the actuaciones did not change', async () => {
      await repo.insert(full);
      await repo.updateCpnuState('101', (c) => ({ ...c, error: 'La Rama Judicial respondió 500' }));
      const after = await repo.findById('101');
      expect(after).toEqual({ ...full, error: 'La Rama Judicial respondió 500' });
    });

    it('never resurrects a deleted proceso', async () => {
      const mutate = vi.fn(fetched);
      expect(await repo.updateCpnuState('nope', mutate)).toBeNull();
      expect(mutate).not.toHaveBeenCalled();
      expect(await repo.findById('nope')).toBeNull();
    });

    it('waits for the row lock and keeps office edits committed meanwhile', async () => {
      await repo.insert(full);
      const runner = dataSource.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      await runner.query(`SELECT 1 FROM procesos WHERE id_proceso = '101' FOR UPDATE`);
      await runner.query(`UPDATE procesos SET alias = 'Editado' WHERE id_proceso = '101'`);

      let done = false;
      const refresh = repo.updateCpnuState('101', fetched).then((r) => {
        done = true;
        return r;
      });
      await new Promise((r) => setTimeout(r, 300));
      expect(done).toBe(false); // blocked by FOR UPDATE

      await runner.commitTransaction();
      await runner.release();
      await refresh;

      const after = await repo.findById('101');
      expect(after?.alias).toBe('Editado');
      expect(after?.detalle).toEqual({ despacho: 'TRIBUNAL' });
    });

    it('does not resurrect a proceso deleted while the refresh waited for the lock', async () => {
      await repo.insert(full);
      const runner = dataSource.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      await runner.query(`DELETE FROM procesos WHERE id_proceso = '101'`);
      const refresh = repo.updateCpnuState('101', fetched);
      await new Promise((r) => setTimeout(r, 200));
      await runner.commitTransaction();
      await runner.release();
      expect(await refresh).toBeNull();
      expect(await repo.findById('101')).toBeNull();
    });
  });

  it('updates office fields and marks everything as seen', async () => {
    await repo.insert(full);
    expect(await repo.updateOffice('101', { alias: 'Nuevo', etiquetas: [] })).toBe(true);
    expect(await repo.updateOffice('nope', { alias: 'x' })).toBe(false);
    expect(await repo.markSeen('101')).toBe(true);
    expect(await repo.markSeen('nope')).toBe(false);
    const after = await repo.findById('101');
    expect(after).toMatchObject({
      alias: 'Nuevo',
      etiquetas: [],
      responsable: 'Luis',
      nuevaInstancia: false,
      noVistas: [],
    });
  });

  it('adds and deletes notas (newest first)', async () => {
    await repo.insert(full);
    expect(await repo.addNota('101', nota('n3', { fecha: '2026-02-04T00:00:00.000Z' }))).toBe(true);
    expect(await repo.addNota('nope', nota('n4'))).toBe(false);
    expect((await repo.findById('101'))?.notas.map((n) => n.id)).toEqual(['n3', 'n2', 'n1']);
    expect(await repo.deleteNota('101', 'n2')).toBe(true);
    expect(await repo.deleteNota('101', 'n2')).toBe(false);
    expect((await repo.findById('101'))?.notas.map((n) => n.id)).toEqual(['n3', 'n1']);
  });

  it('adds, updates and deletes tareas (creation order)', async () => {
    await repo.insert(full);
    expect(await repo.addTarea('101', tarea('t3'))).toBe(true);
    expect(await repo.updateTarea('101', 't1', { hecha: true, hechaPor: 'Ana', fecha: '2026-04-01' })).toBe(true);
    expect(await repo.updateTarea('101', 'zz', { hecha: true })).toBe(false);
    expect(await repo.updateTarea('101', 't1', {})).toBe(true);
    expect(await repo.deleteTarea('101', 't2')).toBe(true);
    const tareas = (await repo.findById('101'))?.tareas;
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
