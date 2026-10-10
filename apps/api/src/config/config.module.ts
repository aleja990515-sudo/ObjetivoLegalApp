import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { join } from 'node:path';
import { REPO_ROOT } from '../app.paths.js';
import { loadAppConfig } from './app-config.js';
import { APP_CONFIG, appConfigProvider } from './app-config.provider.js';

/**
 * Loads `.env` (repository root, then `apps/api/.env`) unless running tests,
 * validates it and exposes the typed configuration under {@link APP_CONFIG}.
 */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: [join(REPO_ROOT, '.env'), join(REPO_ROOT, 'apps/api/.env')],
      ignoreEnvFile: process.env.NODE_ENV === 'test',
      validate: (env) => ({ app: loadAppConfig(env) }),
    }),
  ],
  providers: [appConfigProvider],
  exports: [APP_CONFIG],
})
export class AppConfigModule {}
