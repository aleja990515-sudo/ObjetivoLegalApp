import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { loadAppConfig } from '../../src/config/app-config.js';
import { buildDataSourceOptions } from '../../src/database/typeorm-options.js';

/**
 * Connects to the e2e database (`DATABASE_URL` set by vitest.config.e2e.ts from
 * `TEST_DATABASE_URL`) and applies every migration.
 */
export async function createTestDataSource(): Promise<DataSource> {
  const { database } = loadAppConfig(process.env);
  const dataSource = new DataSource({ ...buildDataSourceOptions(database), migrationsRun: false });
  await dataSource.initialize();
  await dataSource.runMigrations();
  return dataSource;
}

/** Empties every application table (keeps the migrations table). */
export async function truncateAll(dataSource: DataSource): Promise<void> {
  await dataSource.query('TRUNCATE procesos, actuaciones, autos_publicados, sujetos, notas, tareas, meta, usuarios RESTART IDENTITY CASCADE');
}
