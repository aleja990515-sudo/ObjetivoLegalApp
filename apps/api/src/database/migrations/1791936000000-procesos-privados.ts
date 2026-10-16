import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Marca los procesos que la Rama reserva (`esPrivado` en la consulta de
 * radicado). CPNU no entrega detalle, sujetos ni actuaciones de un proceso
 * privado (404), así que se guardan con lo que devuelve la búsqueda y se
 * vigilan por los estados publicados del despacho.
 */
export class ProcesosPrivados1791936000000 implements MigrationInterface {
  name = 'ProcesosPrivados1791936000000';

  async up(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE procesos ADD COLUMN es_privado boolean NOT NULL DEFAULT false`);
  }

  async down(q: QueryRunner): Promise<void> {
    await q.query(`ALTER TABLE procesos DROP COLUMN es_privado`);
  }
}
