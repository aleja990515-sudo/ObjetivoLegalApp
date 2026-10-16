import { Logger } from '@nestjs/common';
import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Owner of each proceso. `agregado_por` only holds `usuarios.nombre`, the display
 * name, so existing rows are backfilled in two deterministic passes:
 * 1. by name (`lower(trim(...))`), where a duplicated name goes to the oldest account;
 * 2. by radicado, for the rows the name pass cannot match: every instance detected by
 *    `DetectInstancesService` is stamped `agregado_por = 'Revisión automática'`, which
 *    is nobody's name, and it belongs to whoever owns another instance of that radicado.
 *
 * A radicado with more than one owner is ambiguous, so its rows stay NULL rather than
 * being handed to an arbitrary colleague. The column stays nullable so an unknown name
 * survives instead of being dropped, and `ON DELETE RESTRICT` keeps a user from being
 * deleted while processes of theirs remain.
 */
export class ProcesosUsuario1792204800000 implements MigrationInterface {
  name = 'ProcesosUsuario1792204800000';
  private readonly logger = new Logger(ProcesosUsuario1792204800000.name);

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE procesos ADD COLUMN usuario_id uuid NULL REFERENCES usuarios (id) ON DELETE RESTRICT`);
    await q.query(`CREATE INDEX procesos_usuario_idx ON procesos (usuario_id)`);
    // `usuarios.nombre` is not unique, so DISTINCT ON resolves the duplicates here
    // instead of leaving them to the planner, which would pick any row it liked.
    await q.query(`
      WITH owners AS (
        SELECT DISTINCT ON (lower(trim(nombre))) id, lower(trim(nombre)) AS nombre
        FROM usuarios
        ORDER BY lower(trim(nombre)), creado
      )
      UPDATE procesos p
      SET usuario_id = owners.id
      FROM owners
      WHERE p.usuario_id IS NULL AND lower(trim(p.agregado_por)) = owners.nombre
    `);
    // An auto-detected instance is named after nobody. It belongs to the owner of the
    // other instance of its radicado, and `count(DISTINCT usuario_id) = 1` leaves a
    // radicado shared by two lawyers unassigned rather than picking between them.
    await q.query(`
      WITH por_radicado AS (
        SELECT radicado, min(usuario_id::text)::uuid AS usuario_id
        FROM procesos
        WHERE usuario_id IS NOT NULL
        GROUP BY radicado
        HAVING count(DISTINCT usuario_id) = 1
      )
      UPDATE procesos p
      SET usuario_id = por_radicado.usuario_id
      FROM por_radicado
      WHERE p.usuario_id IS NULL AND p.radicado = por_radicado.radicado
    `);
    // What the two passes left behind, and the duplicated names they had to break, so
    // both are visible instead of being silently accepted.
    const [{ huerfanos, nombresAmbiguos }] = (await q.query(`
      SELECT
        (SELECT count(*)::int FROM procesos WHERE usuario_id IS NULL) AS "huerfanos",
        (
          SELECT count(*)::int FROM (
            SELECT lower(trim(nombre)) FROM usuarios GROUP BY lower(trim(nombre)) HAVING count(*) > 1
          ) duplicados
        ) AS "nombresAmbiguos"
    `)) as [{ huerfanos: number; nombresAmbiguos: number }];
    this.logger.log(
      `[migracion] procesos sin usuario: ${huerfanos} (SELECT count(*) FROM procesos WHERE usuario_id IS NULL); ` +
        `nombres de usuario duplicados: ${nombresAmbiguos} (SELECT lower(trim(nombre)), count(*) FROM usuarios GROUP BY lower(trim(nombre)) HAVING count(*) > 1)`,
    );
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP INDEX procesos_usuario_idx`);
    await q.query(`ALTER TABLE procesos DROP COLUMN usuario_id`);
  }
}