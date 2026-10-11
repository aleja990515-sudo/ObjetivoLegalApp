import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import type { AppConfig } from './config/app-config.js';
import { APP_CONFIG } from './config/app-config.provider.js';
import { configureApp } from './configure-app.js';

async function bootstrap(): Promise<void> {
  const app = configureApp(await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false }));
  app.enableShutdownHooks();
  const config = app.get<AppConfig>(APP_CONFIG);
  await app.listen(config.port);
  const logger = new Logger('Bootstrap');
  if (config.database.sslNoVerify && !config.database.caCert) {
    logger.warn('DATABASE_SSL_NO_VERIFY=true: the database certificate is NOT verified. Configure DATABASE_CA_CERT.');
  }
  logger.log(`Seguimiento de procesos en http://localhost:${config.port}`);
}

await bootstrap();
