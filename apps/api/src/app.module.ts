import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ServeStaticModule } from '@nestjs/serve-static';
import { DEFAULT_PUBLIC_DIR } from './app.paths.js';
import { AgendaModule } from './agenda/agenda.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ApiExceptionFilter } from './common/http/api-exception.filter.js';
import { TimeModule } from './common/time/sleep.js';
import type { AppConfig } from './config/app-config.js';
import { APP_CONFIG } from './config/app-config.provider.js';
import { AppConfigModule } from './config/config.module.js';
import { DatabaseModule } from './database/database.module.js';
import { ProcesosModule } from './procesos/procesos.module.js';
import { SaludModule } from './salud/salud.module.js';

@Module({
  imports: [
    AppConfigModule,
    TimeModule,
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    // Static frontend (`public/`) with SPA fallback to index.html for every
    // non-API GET, like the legacy server.js.
    ServeStaticModule.forRootAsync({
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => [
        {
          rootPath: config.publicDir ?? DEFAULT_PUBLIC_DIR,
          exclude: /^\/api(\/|$)/,
          serveStaticOptions: {
            setHeaders: (res: { setHeader(name: string, value: string): void }) =>
              res.setHeader('Cache-Control', 'no-cache'),
          },
        },
      ],
    }),
    ProcesosModule,
    AgendaModule,
    SaludModule,
  ],
  providers: [{ provide: APP_FILTER, useClass: ApiExceptionFilter }],
})
export class AppModule {}
