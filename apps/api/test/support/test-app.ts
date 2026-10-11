import type { NestExpressApplication } from '@nestjs/platform-express';
import { AbstractLoader, ExpressLoader } from '@nestjs/serve-static';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../../src/app.module.js';
import { SLEEP, type Sleep } from '../../src/common/time/sleep.js';
import { loadAppConfig, type AppConfig } from '../../src/config/app-config.js';
import { APP_CONFIG } from '../../src/config/app-config.provider.js';
import { configureApp } from '../../src/configure-app.js';
import { CPNU_PORT, type CpnuPort } from '../../src/procesos/application/ports/cpnu.port.js';
import { FakeCpnu } from '../../src/procesos/testing/fake-cpnu.js';

export interface TestAppOptions {
  /** Overrides on top of the configuration built from the e2e environment. */
  config?: Partial<AppConfig>;
  /** CPNU port used by the app. Default: an empty {@link FakeCpnu} (never the network). */
  cpnu?: CpnuPort;
  /** Delay function. Default: resolves immediately. */
  sleep?: Sleep;
  /** Extra provider overrides. */
  override?: (builder: TestingModuleBuilder) => TestingModuleBuilder;
}

/**
 * Boots the full AppModule against the test database with the same HTTP setup
 * as `main.ts`. Close it with `app.close()`.
 */
export async function createTestApp(options: TestAppOptions = {}): Promise<NestExpressApplication> {
  const config: AppConfig = { ...loadAppConfig(process.env), ...options.config };
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(APP_CONFIG)
    .useValue(config)
    .overrideProvider(CPNU_PORT)
    .useValue(options.cpnu ?? new FakeCpnu())
    .overrideProvider(SLEEP)
    .useValue(options.sleep ?? (async () => undefined))
    // The testing module compiles before the HTTP adapter exists, so serve-static
    // would pick its no-op loader; force the Express one like the real app.
    .overrideProvider(AbstractLoader)
    .useValue(new ExpressLoader());
  if (options.override) builder = options.override(builder);
  const moduleRef = await builder.compile();
  const app = configureApp(
    moduleRef.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false }),
  );
  await app.init();
  return app;
}
