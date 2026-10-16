import type { DataSource, QueryRunner } from 'typeorm';
import { ProcesosUsuario1792204800000 } from '../../src/database/migrations/1792204800000-procesos-usuario.js';
import { createTestDataSource } from '../support/test-database.js';

// Runs the real backfill against the e2e database. The whole thing happens inside one
// transaction that is rolled back: dropping `usuario_id` would break the specs that run
// after this file, and a failed migration must not be left half-applied.

const ANA = '11111111-1111-4111-8111-111111111111';
const BETO = '22222222-2222-4222-8222-222222222222';
/** A second colleague also called Ana: `usuarios.nombre` is not unique. */
const ANA_JOVEN = '33333333-3333-4333-8333-333333333333';

const R_ANA = '11001310300120190012300';
const R_COMPARTIDO = '05001311001520260010001';
const R_SIN_DUENIO = '05001311001520260010002';
const R_ANA_JOVEN = '05001311001520260010003';

describe('ProcesosUsuario1792204800000 (Postgres)', () => {
  let dataSource: DataSource;
  let runner: QueryRunner;

  const usuario = (id: string, nombre: string, cedula: string, creado: string) =>
    runner.query(
      `INSERT INTO usuarios (id, nombre, nombre_completo, correo_indice, correo_cifrado, cedula_indice,
        cedula_cifrada, celular_cifrado, password_hash, activo, creado)
       VALUES ($1, $2, $2, $3, 'cifrado', $4, 'cifrado', 'cifrado', 'hash', true, $5)`,
      [id, nombre, `indice-${cedula}@example.com`, cedula, creado],
    );

  const proceso = (idProceso: string, radicado: string, agregadoPor: string) =>
    runner.query('INSERT INTO procesos (id_proceso, radicado, agregado_por) VALUES ($1, $2, $3)', [
      idProceso,
      radicado,
      agregadoPor,
    ]);

  const duenio = async (idProceso: string): Promise<string | null> => {
    const [{ usuario_id: id }] = await runner.query('SELECT usuario_id FROM procesos WHERE id_proceso = $1', [
      idProceso,
    ]);
    return id;
  };

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    runner = dataSource.createQueryRunner();
    await runner.startTransaction();
    await runner.query(
      'TRUNCATE procesos, actuaciones, autos_publicados, sujetos, notas, tareas, meta, usuarios RESTART IDENTITY CASCADE',
    );
    // Back to the shape the migration found: no `usuario_id` column yet.
    await runner.query('ALTER TABLE procesos DROP COLUMN usuario_id');

    await usuario(ANA, 'Ana', '1000000001', '2026-01-01T00:00:00Z');
    await usuario(BETO, 'Beto', '1000000002', '2026-01-02T00:00:00Z');
    await usuario(ANA_JOVEN, 'Ana', '1000000003', '2026-03-01T00:00:00Z');

    await proceso('1', R_ANA, 'Ana');
    await proceso('2', R_ANA, 'Revisión automática'); // nightly review / actualizar
    await proceso('3', R_ANA, ''); // legacy row with no author
    await proceso('4', R_ANA, '  aNa  '); // case and spaces do not match
    await proceso('5', R_COMPARTIDO, 'Ana');
    await proceso('6', R_COMPARTIDO, 'Beto');
    await proceso('7', R_COMPARTIDO, 'Revisión automática');
    await proceso('8', R_SIN_DUENIO, 'Revisión automática');
    await proceso('9', R_ANA_JOVEN, 'Ana'); // duplicated name

    await new ProcesosUsuario1792204800000().up(runner);
  });

  afterAll(async () => {
    await runner.rollbackTransaction();
    await runner.release();
    await dataSource.destroy();
  });

  it('matches agregado_por against usuarios.nombre, ignoring case and spaces', async () => {
    expect(await duenio('1')).toBe(ANA);
    expect(await duenio('4')).toBe(ANA);
    expect(await duenio('6')).toBe(BETO);
  });

  it('gives an auto-detected instance the owner of the base proceso of its radicado', async () => {
    expect(await duenio('2')).toBe(ANA);
  });

  it('gives a row with no author the owner of its radicado instead of orphaning it', async () => {
    expect(await duenio('3')).toBe(ANA);
  });

  it('resolves a duplicated name to the oldest account, deterministically', async () => {
    expect(await duenio('9')).toBe(ANA);
  });

  it('leaves NULL the rows no pass could attribute: shared radicado and no owner at all', async () => {
    expect(await duenio('7')).toBeNull(); // R_COMPARTIDO belongs to Ana and to Beto
    expect(await duenio('8')).toBeNull(); // nothing in that radicado is owned
    const [{ huerfanos }] = await runner.query('SELECT count(*)::int AS huerfanos FROM procesos WHERE usuario_id IS NULL');
    expect(huerfanos).toBe(2);
  });
});