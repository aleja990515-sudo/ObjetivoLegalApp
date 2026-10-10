import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Normalized schema replacing the legacy JSON documents (Redis / data/db.json).
 * CPNU-owned data lives in `procesos` (detalle, error, ultima_consulta, despacho,
 * sujetos_texto), `actuaciones` and `sujetos`; office-owned data in the
 * remaining `procesos` columns, `notas` and `tareas`.
 */
export class InitialSchema1791590400000 implements MigrationInterface {
  name = 'InitialSchema1791590400000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`
      CREATE TABLE procesos (
        id_proceso      text PRIMARY KEY,
        radicado        text NOT NULL,
        despacho        text,
        sujetos_texto   text,
        detalle         jsonb NOT NULL DEFAULT '{}'::jsonb,
        error           text,
        ultima_consulta timestamptz,
        alias           text NOT NULL DEFAULT '',
        responsable     text NOT NULL DEFAULT '',
        etiquetas       text[] NOT NULL DEFAULT '{}',
        nueva_instancia boolean NOT NULL DEFAULT false,
        agregado_por    text NOT NULL DEFAULT '',
        agregado        timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX procesos_radicado_idx ON procesos (radicado)`);

    await q.query(`
      CREATE TABLE actuaciones (
        id_proceso     text NOT NULL REFERENCES procesos (id_proceso) ON DELETE CASCADE,
        id             bigint NOT NULL,
        orden          integer NOT NULL,
        cons           integer,
        fecha          text,
        actuacion      text,
        anotacion      text,
        fecha_inicial  text,
        fecha_final    text,
        fecha_registro text,
        con_documentos boolean,
        no_vista       boolean NOT NULL DEFAULT false,
        PRIMARY KEY (id_proceso, id)
      )`);
    await q.query(`CREATE INDEX actuaciones_orden_idx ON actuaciones (id_proceso, orden)`);
    await q.query(`CREATE INDEX actuaciones_no_vista_idx ON actuaciones (id_proceso) WHERE no_vista`);

    await q.query(`
      CREATE TABLE sujetos (
        id_proceso text NOT NULL REFERENCES procesos (id_proceso) ON DELETE CASCADE,
        orden      integer NOT NULL,
        tipo       text,
        nombre     text,
        PRIMARY KEY (id_proceso, orden)
      )`);

    await q.query(`
      CREATE TABLE notas (
        id         text PRIMARY KEY,
        id_proceso text NOT NULL REFERENCES procesos (id_proceso) ON DELETE CASCADE,
        seq        bigint GENERATED ALWAYS AS IDENTITY,
        texto      text NOT NULL,
        autor      text NOT NULL DEFAULT '',
        fecha      timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX notas_proceso_idx ON notas (id_proceso, seq)`);

    await q.query(`
      CREATE TABLE tareas (
        id           text PRIMARY KEY,
        id_proceso   text NOT NULL REFERENCES procesos (id_proceso) ON DELETE CASCADE,
        seq          bigint GENERATED ALWAYS AS IDENTITY,
        titulo       text NOT NULL,
        fecha        date NOT NULL,
        hora         text NOT NULL DEFAULT '',
        responsable  text NOT NULL DEFAULT '',
        id_actuacion text,
        hecha        boolean NOT NULL DEFAULT false,
        hecha_por    text,
        autor        text NOT NULL DEFAULT '',
        creada       timestamptz NOT NULL DEFAULT now()
      )`);
    await q.query(`CREATE INDEX tareas_proceso_idx ON tareas (id_proceso, seq)`);
    await q.query(`CREATE INDEX tareas_pendientes_idx ON tareas (fecha) WHERE NOT hecha`);

    await q.query(`
      CREATE TABLE meta (
        clave text PRIMARY KEY,
        valor text
      )`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`DROP TABLE meta`);
    await q.query(`DROP TABLE tareas`);
    await q.query(`DROP TABLE notas`);
    await q.query(`DROP TABLE sujetos`);
    await q.query(`DROP TABLE actuaciones`);
    await q.query(`DROP TABLE procesos`);
  }
}
