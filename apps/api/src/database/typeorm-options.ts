import type { DataSourceOptions } from 'typeorm';
import type { DatabaseConfig } from '../config/app-config.js';
import { ENTITIES } from './entities.js';
import { MIGRATIONS } from './migrations/index.js';

function sslOptions(db: DatabaseConfig): false | { ca?: string; rejectUnauthorized: boolean } {
  if (db.caCert) return { ca: db.caCert, rejectUnauthorized: true };
  if (db.sslNoVerify) return { rejectUnauthorized: false };
  return false;
}

// With sslmode in the URL, pg verifies the certificate regardless of the `ssl` option.
function withoutSslMode(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.delete('sslmode');
  return parsed.toString();
}

/**
 * PostgreSQL options shared by the Nest app, the TypeORM CLI and the tests.
 * The schema is managed only by migrations (`synchronize: false`).
 */
export function buildDataSourceOptions(db: DatabaseConfig): DataSourceOptions {
  return {
    type: 'postgres',
    url: db.caCert || !db.sslNoVerify ? db.url : withoutSslMode(db.url),
    ssl: sslOptions(db),
    entities: ENTITIES,
    migrations: MIGRATIONS,
    migrationsTableName: 'migraciones',
    migrationsRun: db.migrationsRun,
    synchronize: false,
    // Serverless-friendly pool: few connections, released quickly when idle.
    extra: { max: db.poolMax, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 },
  };
}
