import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Cuentas de la oficina. Los datos personales (correo, cédula, celular) se
 * guardan cifrados con AES-256-GCM; `correo_indice` y `cedula_indice` son
 * HMAC-SHA256 deterministas para unicidad e inicio de sesión. Las cuentas
 * nuevas nacen inactivas hasta que la oficina las active.
 */
export class Usuarios1791676800000 implements MigrationInterface {
  name = 'Usuarios1791676800000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE usuarios (
        id                uuid PRIMARY KEY,
        nombre            text NOT NULL,
        nombre_completo   text NOT NULL,
        correo_indice     text NOT NULL UNIQUE,
        correo_cifrado    text NOT NULL,
        cedula_indice     text NOT NULL UNIQUE,
        cedula_cifrada    text NOT NULL,
        celular_cifrado   text NOT NULL,
        password_hash     text NOT NULL,
        consentimiento_at timestamptz,
        activo            boolean NOT NULL DEFAULT false,
        creado            timestamptz NOT NULL DEFAULT now(),
        actualizado       timestamptz NOT NULL DEFAULT now()
      )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE usuarios`);
  }
}
