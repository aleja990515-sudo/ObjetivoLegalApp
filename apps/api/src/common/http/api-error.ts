import { HttpException } from '@nestjs/common';

/**
 * HTTP error carrying the API's public JSON shape `{ error: string }`.
 * Messages are user-facing Spanish copy shared with the frontend.
 */
export class ApiError extends HttpException {
  constructor(status: number, message: string) {
    super({ error: message }, status);
  }
}

export const RAMA_TIMEOUT_MESSAGE = 'La Rama Judicial no respondió a tiempo. Intenta de nuevo.';
export const ROUTE_NOT_FOUND_MESSAGE = 'Ruta no encontrada.';
