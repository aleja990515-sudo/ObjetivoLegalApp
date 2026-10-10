import express, { type NextFunction, type Request, type Response } from 'express';

export const JSON_BODY_LIMIT = '100kb';
export const INVALID_JSON_MESSAGE = 'JSON inválido';
export const BODY_TOO_LARGE_MESSAGE = 'El cuerpo de la solicitud es demasiado grande.';

const parseJson = express.json({
  limit: JSON_BODY_LIMIT,
  // The legacy API parsed every request body as JSON regardless of Content-Type.
  type: () => true,
});

/**
 * JSON body parsing with the API error shape. Deliberate fixes over the legacy
 * server: malformed JSON answers 400 (was 502) and oversized bodies 413 (was a hang).
 * Requests without a body get `{}` like the legacy `leerCuerpo`.
 */
export function jsonBodyMiddleware(req: Request, res: Response, next: NextFunction): void {
  parseJson(req, res, (err?: unknown) => {
    if (!err) {
      req.body ??= {};
      return next();
    }
    const { type, status } = err as { type?: string; status?: number };
    if (type === 'entity.too.large') {
      res.status(413).json({ error: BODY_TOO_LARGE_MESSAGE });
    } else if (type === 'entity.parse.failed') {
      res.status(400).json({ error: INVALID_JSON_MESSAGE });
    } else {
      res.status(status && status >= 400 && status < 500 ? status : 400).json({ error: INVALID_JSON_MESSAGE });
    }
  });
}

/** API responses are never cached (legacy `Cache-Control: no-store`). */
export function noStoreMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('Cache-Control', 'no-store');
  next();
}
