import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * `id_proceso` (the CPNU id) was the global primary key, which made it a natural
 * key that two lawyers on the same expediente could never share: `POST /procesos`
 * answered 409 exactly when a *colleague* already followed the radicado, so any
 * authenticated user could probe the office's caseload by typing radicados.
 *
 * `id` becomes the surrogate key every row owns, and `(usuario_id, id_proceso)`
 * takes over as the per-owner natural key. Rows stay addressable by `id_proceso`
 * in the API, where every read is already owner-scoped.
 *
 * `UNIQUE (usuario_id, id_proceso)` does not constrain the orphans of
 * `usuario_id IS NULL`: a plain unique index treats NULLs as distinct. A partial
 * index closes just that hole, so an ownerless row keeps one row per `id_proceso`
 * and the cron stops appending a duplicate per run.
 */
export class ProcesosIdSurrogado1792291200000 implements MigrationInterface {
  name = 'ProcesosIdSurrogado1792291200000';

  /** Children that hang from `procesos`, in the order the schema created them. */
  private readonly hijos = ['actuaciones', 'sujetos', 'notas', 'tareas', 'autos_publicados', 'estados_proceso'] as const;

  async up(q: QueryRunner): Promise<void> {
    // Postgres 11+ rewrites the table filling `id` from the default, so the
    // existing rows are backfilled by the very statement that adds the column.
    await q.query(`ALTER TABLE procesos ADD COLUMN id uuid NOT NULL DEFAULT gen_random_uuid()`);

    // Every child FK is dropped first: they all point at `procesos_pkey`, the very
    // constraint that has to move from `id_proceso` to `id`.
    for (const tabla of this.hijos) {
      await q.query(`ALTER TABLE ${tabla} DROP CONSTRAINT ${tabla}_id_proceso_fkey`);
    }

    // The name `procesos_pkey` moves with the key, so the table keeps one primary
    // key and the FKs re-added below have something unique to point at.
    await q.query(`ALTER TABLE procesos DROP CONSTRAINT procesos_pkey`);
    await q.query(`ALTER TABLE procesos ADD CONSTRAINT procesos_pkey PRIMARY KEY (id)`);

    // `id_proceso` keeps NOT NULL and stops being unique: uniqueness is now per owner.
    await q.query(
      `ALTER TABLE procesos ADD CONSTRAINT procesos_usuario_id_proceso_uniq UNIQUE (usuario_id, id_proceso)`,
    );

    // The orphan half of the same rule: `(usuario_id, id_proceso)` compares NULLs as
    // distinct, so an ownerless row would never conflict and every scheduled review
    // would append another copy of it. This partial index is the `orIgnore()` target
    // for the orphans, and it cannot weaken the oracle: it only covers the rows the
    // per-owner key leaves unconstrained.
    await q.query('CREATE UNIQUE INDEX procesos_huerfano_uniq ON procesos (id_proceso) WHERE usuario_id IS NULL');

    // Each child carries the CPNU id over to the surrogate. The join is on a plain
    // column, so it needs no index on `procesos.id_proceso` to match the rows.
    for (const tabla of this.hijos) {
      await q.query(`UPDATE ${tabla} c SET id_proceso = p.id FROM procesos p WHERE p.id_proceso = c.id_proceso`);
      await q.query(`ALTER TABLE ${tabla} ALTER COLUMN id_proceso TYPE uuid USING id_proceso::uuid`);
      await q.query(
        `ALTER TABLE ${tabla} ADD CONSTRAINT ${tabla}_id_proceso_fkey ` +
          `FOREIGN KEY (id_proceso) REFERENCES procesos (id) ON DELETE CASCADE`,
      );
    }
  }

  async down(q: QueryRunner): Promise<void> {
    // Restoring the global key needs `id_proceso` to be unique again, so a database
    // holding two copies of the same expediente cannot be reverted: `down()` is the
    // shape before this migration, not a way to keep co-following. Checked before
    // any DDL so the refusal leaves the schema untouched, instead of failing later
    // on an opaque `could not create unique index "procesos_pkey"`.
    const duplicados = (await q.query(
      'SELECT radicado, count(*)::int AS total FROM procesos GROUP BY radicado HAVING count(*) > 1',
    )) as unknown as { radicado: string; total: number }[];
    if (duplicados.length) {
      const detalle = duplicados.map(({ radicado, total }) => `${radicado} (${total} filas)`).join(', ');
      throw new Error(
        `No se puede revertir ${this.name}: ${detalle} están seguidos por más de un usuario y la ` +
          'clave global sobre id_proceso no los representa. Eliminá las copias duplicadas y volvé a ' +
          'ejecutar la reversión.',
      );
    }

    for (const tabla of this.hijos) {
      await q.query(`ALTER TABLE ${tabla} DROP CONSTRAINT ${tabla}_id_proceso_fkey`);
    }
    await q.query('DROP INDEX IF EXISTS procesos_huerfano_uniq');
    await q.query(`ALTER TABLE procesos DROP CONSTRAINT procesos_usuario_id_proceso_uniq`);
    await q.query(`ALTER TABLE procesos DROP CONSTRAINT procesos_pkey`);
    await q.query(`ALTER TABLE procesos ADD CONSTRAINT procesos_pkey PRIMARY KEY (id_proceso)`);

    for (const tabla of this.hijos) {
      // Widened before the backfill, not after: a uuid column refuses a text value,
      // while a text one accepts the uuid it already holds.
      await q.query(`ALTER TABLE ${tabla} ALTER COLUMN id_proceso TYPE text USING id_proceso::text`);
      await q.query(
        `UPDATE ${tabla} c SET id_proceso = p.id_proceso FROM procesos p WHERE p.id::text = c.id_proceso`,
      );
      await q.query(
        `ALTER TABLE ${tabla} ADD CONSTRAINT ${tabla}_id_proceso_fkey ` +
          `FOREIGN KEY (id_proceso) REFERENCES procesos (id_proceso) ON DELETE CASCADE`,
      );
    }

    await q.query(`ALTER TABLE procesos DROP COLUMN id`);
  }
}
