import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Resultado de buscar cada providencia en Publicaciones Procesales: solo
 * enlaces (el servidor nunca descarga ni guarda los PDF). La llave foránea va a
 * `procesos` y no a `actuaciones`, porque una actualización de CPNU reescribe
 * las actuaciones y no debe borrar lo ya encontrado.
 */
export class AutosPublicados1791763200000 implements MigrationInterface {
  name = 'AutosPublicados1791763200000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE autos_publicados (
        id_proceso        text NOT NULL REFERENCES procesos (id_proceso) ON DELETE CASCADE,
        id_actuacion      bigint NOT NULL,
        confianza         text NOT NULL CHECK (confianza IN ('exacto', 'del_dia', 'estado', 'sin_resultado')),
        url_pdf           text,
        nombre_archivo    text,
        url_estado        text,
        numero_estado     text,
        fecha_publicacion text,
        buscado_en        timestamptz NOT NULL,
        intentos          integer NOT NULL DEFAULT 1,
        PRIMARY KEY (id_proceso, id_actuacion)
      )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE autos_publicados`);
  }
}
