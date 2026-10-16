import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Estados in which a followed private case appeared. The estados search form has
 * no radicado field, so a detection is only known after reading the estado's own
 * `LISTADO <n>.pdf`. The key is `(proceso, estado)`: the same estado is never
 * recorded twice, and `visto` is cleared when the office reads the case.
 */
export class EstadosProceso1792118400000 implements MigrationInterface {
  name = 'EstadosProceso1792118400000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE estados_proceso (
        id_proceso          text NOT NULL REFERENCES procesos (id_proceso) ON DELETE CASCADE,
        url_estado          text NOT NULL,
        numero_estado       text,
        fecha_publicacion   date,
        radicado_encontrado text NOT NULL,
        visto               boolean NOT NULL DEFAULT false,
        detectado_en        timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (id_proceso, url_estado)
      )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE estados_proceso`);
  }
}
