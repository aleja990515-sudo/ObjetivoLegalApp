// Data source for the TypeORM CLI (`npm run -w apps/api migration:run`).
// Uses the same validated environment as the app, including the root `.env`.
import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { REPO_ROOT } from '../app.paths.js';
import { loadAppConfig } from '../config/app-config.js';
import { buildDataSourceOptions } from './typeorm-options.js';

const envFile = join(REPO_ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default new DataSource({
  ...buildDataSourceOptions(loadAppConfig(process.env).database),
  migrationsRun: false,
});
