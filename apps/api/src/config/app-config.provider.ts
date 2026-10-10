import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AppConfig } from './app-config.js';

export const APP_CONFIG = Symbol('APP_CONFIG');

/** Injects the validated {@link AppConfig}. */
export const InjectAppConfig = () => Inject(APP_CONFIG);

export const appConfigProvider = {
  provide: APP_CONFIG,
  inject: [ConfigService],
  useFactory: (config: ConfigService): AppConfig => config.getOrThrow<AppConfig>('app'),
};
