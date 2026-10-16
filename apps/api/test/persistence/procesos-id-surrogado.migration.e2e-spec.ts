import type { DataSource, QueryRunner } from 'typeorm';
import { ProcesosIdSurrogado1792291200000 } from '../../src/database/migrations/1792291200000-procesos-id-surrogado.js';
import { createTestDataSource } from '../support/test-database.js';

// The whole cycle happens inside one transaction that is rolled back: the migration
// moves the primary key of `procesos`, and leaving it half applied would break every
// spec that runs after this file. `vitest.config.e2e.ts` keeps `fileParallelism: false`
// because the specs share and truncate this database.

const ANA = '11111111-1111-4111-8111-111111111111';
const BETO = '22222222-2222-4222-8222-222222222222';

const R_ANA = '11001310300120190012300';
const R_COMPARTIDO = '05001311001520260010001';

describe('ProcesosIdSurrogado1792291200000 (Postgres)', () => {
  let dataSource: DataSource;
  let runner: QueryRunner;
  const migracion = new ProcesosIdSurrogado1792291200000();

  const usuario = (id: string, nombre: string, cedula: string) =>
    runner.query(
      `INSERT INTO usuarios (id, nombre, nombre_completo, correo_indice, correo_cifrado, cedula_indice,
        cedula_cifrada, celular_cifrado, password_hash, activo, creado)
       VALUES ($1, $2, $2, $3, 'cifrado', $4, 'cifrado', 'cifrado', 'hash', true, now())`,
      [id, nombre, `indice-${cedula}@example.com`, cedula],
    );

  const proceso = (idProceso: string, radicado: string, usuarioId: string | null) =>
    runner.query('INSERT INTO procesos (id_proceso, radicado, usuario_id) VALUES ($1, $2, $3)', [
      idProceso,
      radicado,
      usuarioId,
    ]);

  const columnas = (tabla: string, columna: string) =>
    runner.query(
      'SELECT data_type FROM information_schema.columns WHERE table_name = $1 AND column_name = $2',
      [tabla, columna],
    );

  const constraints = (tabla: string) =>
    runner.query('SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = $1::regclass', [tabla]);

  const indices = () => runner.query('SELECT indexname FROM pg_indexes WHERE tablename = $1', ['procesos']);

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    runner = dataSource.createQueryRunner();
    await runner.startTransaction();
    await runner.query(
      'TRUNCATE procesos, actuaciones, autos_publicados, estados_proceso, sujetos, notas, tareas, meta, usuarios RESTART IDENTITY CASCADE',
    );
    // Back to the shape the migration found: no surrogate key at all.
    await migracion.down(runner);

    await usuario(ANA, 'Ana', '1000000001');
    await usuario(BETO, 'Beto', '1000000002');
    await proceso('1', R_ANA, ANA);
    await proceso('2', R_COMPARTIDO, null); // orphan: no pass could attribute it
    await runner.query('INSERT INTO actuaciones (id_proceso, id, orden) VALUES ($1, 10, 0)', ['1']);
    await runner.query('INSERT INTO notas (id, id_proceso, texto) VALUES ($2, $1, $3)', ['1', 'n1', 'Nota']);
    await runner.query('INSERT INTO tareas (id, id_proceso, titulo, fecha) VALUES ($2, $1, $3, $4)', [
      '1',
      't1',
      'Tarea',
      '2026-03-10',
    ]);
    await runner.query('INSERT INTO sujetos (id_proceso, orden, tipo) VALUES ($1, 0, $2)', ['1', 'Demandante']);
    await runner.query(
      `INSERT INTO autos_publicados (id_proceso, id_actuacion, confianza, buscado_en)
       VALUES ($1, 10, 'exacto', now())`,
      ['1'],
    );
    // The orphan keeps children in all six tables: they have to survive the cycle and
    // come back re-pointed at their CPNU id when `1` is the row deleted for `down()`.
    await runner.query(
      `INSERT INTO estados_proceso (id_proceso, url_estado, radicado_encontrado)
       VALUES ($1, 'https://portal.test/estado/1', $2)`,
      ['1', R_ANA],
    );
    await runner.query(
      `INSERT INTO estados_proceso (id_proceso, url_estado, radicado_encontrado)
       VALUES ($1, 'https://portal.test/estado/2', $2)`,
      ['2', R_COMPARTIDO],
    );
    await runner.query('INSERT INTO actuaciones (id_proceso, id, orden) VALUES ($1, 20, 0)', ['2']);
    await runner.query('INSERT INTO notas (id, id_proceso, texto) VALUES ($2, $1, $3)', ['2', 'n2', 'Nota huérfana']);
    await runner.query('INSERT INTO tareas (id, id_proceso, titulo, fecha) VALUES ($2, $1, $3, $4)', [
      '2',
      't2',
      'Tarea huérfana',
      '2026-03-11',
    ]);
    await runner.query('INSERT INTO sujetos (id_proceso, orden, tipo) VALUES ($1, 0, $2)', ['2', 'Demandado']);
    await runner.query(
      `INSERT INTO autos_publicados (id_proceso, id_actuacion, confianza, buscado_en)
       VALUES ($1, 20, 'exacto', now())`,
      ['2'],
    );

    await migracion.up(runner);
  });

  afterAll(async () => {
    await runner.rollbackTransaction();
    await runner.release();
    await dataSource.destroy();
  });

  it('moves the primary key to a backfilled uuid surrogate and keeps id_proceso as text', async () => {
    expect((await columnas('procesos', 'id'))[0].data_type).toBe('uuid');
    expect((await columnas('procesos', 'id_proceso'))[0].data_type).toBe('text');
    const [pkey] = (await constraints('procesos')).filter((c: { def: string }) => c.def.startsWith('PRIMARY KEY'));
    expect(pkey.def).toBe('PRIMARY KEY (id)');
    const [{ huerfanos }] = await runner.query('SELECT count(*)::int AS huerfanos FROM procesos WHERE id IS NULL');
    expect(huerfanos).toBe(0); // the default backfilled every existing row
  });

  it('re-points every child at procesos (id) and turns its column into a uuid', async () => {
    for (const tabla of ['actuaciones', 'sujetos', 'notas', 'tareas', 'autos_publicados', 'estados_proceso']) {
      expect((await columnas(tabla, 'id_proceso'))[0].data_type).toBe('uuid');
      const [fk] = (await constraints(tabla)).filter((c: { def: string }) => c.def.startsWith('FOREIGN KEY'));
      expect(fk.def).toBe('FOREIGN KEY (id_proceso) REFERENCES procesos(id) ON DELETE CASCADE');
    }
  });

  it('carries the existing rows and their children over to the surrogate', async () => {
    const [{ id }] = await runner.query('SELECT id FROM procesos WHERE id_proceso = $1', ['1']);
    expect(id).toEqual(expect.any(String));
    for (const tabla of ['actuaciones', 'notas', 'tareas']) {
      const [{ total }] = await runner.query(`SELECT count(*)::int AS total FROM ${tabla} WHERE id_proceso = $1`, [id]);
      expect({ tabla, total }).toEqual({ tabla, total: 1 });
    }
    expect(await runner.query('SELECT count(*)::int AS total FROM sujetos WHERE id_proceso = $1', [id])).toEqual([
      { total: 1 },
    ]);
    expect(
      await runner.query('SELECT count(*)::int AS total FROM autos_publicados WHERE id_proceso = $1', [id]),
    ).toEqual([{ total: 1 }]);
    expect(
      await runner.query('SELECT count(*)::int AS total FROM estados_proceso WHERE id_proceso = $1', [id]),
    ).toEqual([{ total: 1 }]);
  });

  it('keeps the owner and radicado indexes of the table', async () => {
    const names = (await indices()).map((i: { indexname: string }) => i.indexname);
    expect(names).toContain('procesos_usuario_idx');
    expect(names).toContain('procesos_radicado_idx');
  });

  it('makes (usuario_id, id_proceso) the per-owner key and lets two owners share the id', async () => {
    const [uniq] = (await constraints('procesos')).filter((c: { def: string }) => c.def.startsWith('UNIQUE'));
    expect(uniq.def).toBe('UNIQUE (usuario_id, id_proceso)');

    // Same idProceso, same owner: rejected. The violation aborts the transaction, so it
    // is caught inside a savepoint instead of poisoning the rest of the spec.
    await runner.query('SAVEPOINT conflicto');
    await expect(runner.query('INSERT INTO procesos (id_proceso, radicado, usuario_id) VALUES ($1, $2, $3)', [
      '1',
      R_ANA,
      ANA,
    ])).rejects.toThrow('procesos_usuario_id_proceso_uniq');
    await runner.query('ROLLBACK TO SAVEPOINT conflicto');

    // Same idProceso, another owner: two rows coexist.
    await proceso('1', R_ANA, BETO);
    const [{ total }] = await runner.query('SELECT count(*)::int AS total FROM procesos WHERE id_proceso = $1', ['1']);
    expect(total).toBe(2);
  });

  it('refuses a second orphan with the same id_proceso, so the cron cannot pile them up', async () => {
    // `UNIQUE (usuario_id, id_proceso)` compares NULLs as distinct and would let this
    // through, so the oracle the scheduled review relies on is the partial index.
    await runner.query('SAVEPOINT huerfano');
    await expect(
      runner.query('INSERT INTO procesos (id_proceso, radicado, usuario_id) VALUES ($1, $2, NULL)', [
        '2',
        R_COMPARTIDO,
      ]),
    ).rejects.toThrow('procesos_huerfano_uniq');
    await runner.query('ROLLBACK TO SAVEPOINT huerfano');

    const [{ total }] = await runner.query('SELECT count(*)::int AS total FROM procesos WHERE id_proceso = $1', ['2']);
    expect(total).toBe(1);
  });

  it('refuses to revert while a radicado is followed twice, leaving the schema untouched', async () => {
    // Ana and Beto both follow `1` right now. Restoring the global key cannot express
    // that, and `down()` says so instead of failing on a bare unique-index error.
    await expect(migracion.down(runner)).rejects.toThrow(
      `No se puede revertir ${migracion.name}: ${R_ANA} (2 filas) están seguidos por más de un usuario`,
    );

    const [pkey] = (await constraints('procesos')).filter((c: { def: string }) => c.def.startsWith('PRIMARY KEY'));
    expect(pkey.def).toBe('PRIMARY KEY (id)');
    expect((await indices()).map((i: { indexname: string }) => i.indexname)).toContain('procesos_huerfano_uniq');
  });

  it('still cascades the children of the deleted copy only', async () => {
    const [{ id }] = await runner.query('SELECT id FROM procesos WHERE id_proceso = $1 AND usuario_id = $2', [
      '1',
      BETO,
    ]);
    await runner.query('INSERT INTO actuaciones (id_proceso, id, orden) VALUES ($1, 99, 0)', [id]);
    await runner.query('DELETE FROM procesos WHERE id = $1', [id]);

    expect(await runner.query('SELECT count(*)::int AS total FROM actuaciones WHERE id = 99')).toEqual([{ total: 0 }]);
    const [{ total }] = await runner.query('SELECT count(*)::int AS total FROM actuaciones WHERE id = 10');
    expect(total).toBe(1); // Ana's copy keeps its actuaciones
  });

  describe('down() and up() again', () => {
    let idHuerfano: string;

    beforeAll(async () => {
      // `down()` restores a global key, so the co-followed `1` has to go first. The
      // orphan `2` survives: the partial index already leaves one row per id_proceso.
      await runner.query('DELETE FROM procesos WHERE id_proceso = $1', ['1']);
      [{ id: idHuerfano }] = await runner.query('SELECT id FROM procesos WHERE id_proceso = $1', ['2']);
      await migracion.down(runner);
    });

    it('restores the global primary key on the text id_proceso and drops the surrogate', async () => {
      expect((await columnas('procesos', 'id_proceso'))[0].data_type).toBe('text');
      expect(await columnas('procesos', 'id')).toEqual([]);
      const [pkey] = (await constraints('procesos')).filter((c: { def: string }) => c.def.startsWith('PRIMARY KEY'));
      expect(pkey.def).toBe('PRIMARY KEY (id_proceso)');
      expect((await constraints('procesos')).some((c: { def: string }) => c.def.includes('id_proceso)'))).toBe(true);
      expect((await indices()).map((i: { indexname: string }) => i.indexname)).not.toContain(
        'procesos_huerfano_uniq',
      );
    });

    it('puts the children back on procesos (id_proceso) with a text column again', async () => {
      for (const tabla of ['actuaciones', 'sujetos', 'notas', 'tareas', 'autos_publicados', 'estados_proceso']) {
        expect((await columnas(tabla, 'id_proceso'))[0].data_type).toBe('text');
        const [fk] = (await constraints(tabla)).filter((c: { def: string }) => c.def.startsWith('FOREIGN KEY'));
        expect(fk.def).toBe('FOREIGN KEY (id_proceso) REFERENCES procesos(id_proceso) ON DELETE CASCADE');
      }
    });

    it('re-points the children of the surviving orphan at its CPNU id, in all six tables', async () => {
      // `1` and its children were deleted to make `down()` possible, so the orphan is
      // the only row left to prove the backfill of every child table.
      expect(idHuerfano).toEqual(expect.any(String));
      for (const tabla of ['actuaciones', 'sujetos', 'notas', 'tareas', 'autos_publicados', 'estados_proceso']) {
        const [{ en_surrogate }] = await runner.query(
          `SELECT count(*)::int AS en_surrogate FROM ${tabla} WHERE id_proceso = $1`,
          [idHuerfano],
        );
        const [{ en_cpn }] = await runner.query(
          `SELECT count(*)::int AS en_cpn FROM ${tabla} WHERE id_proceso = $1`,
          ['2'],
        );
        expect({ tabla, en_surrogate, en_cpn }).toEqual({ tabla, en_surrogate: 0, en_cpn: 1 });
      }
    });

    it('applies cleanly a second time, with the orphan rows still in place', async () => {
      await migracion.up(runner);
      expect((await columnas('procesos', 'id'))[0].data_type).toBe('uuid');
      const [pkey] = (await constraints('procesos')).filter((c: { def: string }) => c.def.startsWith('PRIMARY KEY'));
      expect(pkey.def).toBe('PRIMARY KEY (id)');
      const [{ total }] = await runner.query(
        'SELECT count(*)::int AS total FROM procesos WHERE usuario_id IS NULL',
      );
      expect(total).toBe(1);
    });
  });
});
