import type { NestExpressApplication } from '@nestjs/platform-express';
import { jsonBodyMiddleware, noStoreMiddleware } from './common/http/json-body.middleware.js';

export const API_PREFIX = 'api';

/**
 * HTTP setup shared by `main.ts` and the e2e tests. The app must be created
 * with `{ bodyParser: false }` so the API's own JSON parser handles errors.
 */
export function configureApp(app: NestExpressApplication): NestExpressApplication {
  app.disable('x-powered-by');
  app.setGlobalPrefix(API_PREFIX);
  app.use(`/${API_PREFIX}`, noStoreMiddleware, jsonBodyMiddleware);
  return app;
}
