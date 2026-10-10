import type { DataSourceOptions } from 'typeorm';
import type { DatabaseConfig } from '../config/app-config.js';
import { ENTITIES } from './entities.js';
import { MIGRATIONS } from './migrations/index.js';

/**
 * PostgreSQL options shared by the Nest app, the TypeORM CLI and the tests.
 * The schema is managed only by migrations (`synchronize: false`).
 */
export function buildDataSourceOptions(db: DatabaseConfig): DataSourceOptions {
  return {
    type: 'postgres',
    url: db.url,
    ssl: db.caCert ? { ca: db.caCert, rejectUnauthorized: true } : false,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    migrationsTableName: 'migraciones',
    migrationsRun: db.migrationsRun,
    synchronize: false,
    // Serverless-friendly pool: few connections, released quickly when idle.
    extra: { max: db.poolMax, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 },
  };
}
