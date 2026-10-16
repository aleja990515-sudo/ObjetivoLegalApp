// The migration only speaks SQL, so this asserts the contract it hands to
// Postgres: the nullable owner column, the index, the two backfill passes and the
// diagnostic. What the backfill does with real rows needs the e2e database and
// lives in test/persistence/procesos-usuario.migration.e2e-spec.ts.
import type { QueryRunner } from 'typeorm';
import { ProcesosUsuario1791849600000 } from './1791849600000-procesos-usuario.js';

function grabber() {
  const sql: string[] = [];
  const q = {
    query: async (texto: string) => {
      sql.push(texto.replace(/\s+/g, ' ').trim());
      return [{ huerfanos: 0, nombresAmbiguos: 0 }];
    },
  } as unknown as QueryRunner;
  return { q, sql };
}

describe('ProcesosUsuario1791849600000', () => {
  it('adds a nullable owner column with a restrictive FK and an index', async () => {
    const { q, sql } = grabber();
    await new ProcesosUsuario1791849600000().up(q);
    expect(sql[0]).toBe(
      'ALTER TABLE procesos ADD COLUMN usuario_id uuid NULL REFERENCES usuarios (id) ON DELETE RESTRICT',
    );
    expect(sql[1]).toBe('CREATE INDEX procesos_usuario_idx ON procesos (usuario_id)');
  });

  it('backfills by name, resolving a duplicated name to the oldest account', async () => {
    const { q, sql } = grabber();
    await new ProcesosUsuario1791849600000().up(q);
    expect(sql[2]).toBe(
      'WITH owners AS ( SELECT DISTINCT ON (lower(trim(nombre))) id, lower(trim(nombre)) AS nombre FROM usuarios ORDER BY lower(trim(nombre)), creado ) UPDATE procesos p SET usuario_id = owners.id FROM owners WHERE p.usuario_id IS NULL AND lower(trim(p.agregado_por)) = owners.nombre',
    );
  });

  it('gives the auto-detected rows the owner of their radicado, and only when it is unambiguous', async () => {
    const { q, sql } = grabber();
    await new ProcesosUsuario1791849600000().up(q);
    expect(sql[3]).toBe(
      'WITH por_radicado AS ( SELECT radicado, min(usuario_id::text)::uuid AS usuario_id FROM procesos WHERE usuario_id IS NOT NULL GROUP BY radicado HAVING count(DISTINCT usuario_id) = 1 ) UPDATE procesos p SET usuario_id = por_radicado.usuario_id FROM por_radicado WHERE p.usuario_id IS NULL AND p.radicado = por_radicado.radicado',
    );
  });

  it('counts the unassigned rows and the duplicated names it had to break', async () => {
    const { q, sql } = grabber();
    await new ProcesosUsuario1791849600000().up(q);
    expect(sql[4]).toContain('(SELECT count(*)::int FROM procesos WHERE usuario_id IS NULL) AS "huerfanos"');
    expect(sql[4]).toContain('HAVING count(*) > 1');
  });

  it('reverts the index before the column', async () => {
    const { q, sql } = grabber();
    await new ProcesosUsuario1791849600000().down(q);
    expect(sql).toEqual(['DROP INDEX procesos_usuario_idx', 'ALTER TABLE procesos DROP COLUMN usuario_id']);
  });
});