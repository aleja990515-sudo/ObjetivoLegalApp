import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import type { Response } from 'express';
import { RAMA_TIMEOUT_MESSAGE, ROUTE_NOT_FOUND_MESSAGE } from './api-error.js';

const isApiErrorBody = (body: unknown): body is { error: string } =>
  typeof body === 'object' && body !== null && typeof (body as { error?: unknown }).error === 'string' &&
  !('statusCode' in body);

/**
 * Renders every error as `{ error: string }`, like the legacy API:
 * - {@link ApiError} keeps its status and message;
 * - unmatched routes become 404 "Ruta no encontrada.";
 * - other HTTP exceptions keep their status with their message;
 * - anything else (CPNU failures, timeouts, bugs) becomes 502 with the error message,
 *   or the legacy timeout message for `TimeoutError`.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ApiExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const { status, message } = this.describe(exception);
    if (res.headersSent) return;
    res.status(status).json({ error: message });
  }

  protected describe(exception: unknown): { status: number; message: string } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (isApiErrorBody(body)) return { status, message: body.error };
      if (exception instanceof NotFoundException) return { status, message: ROUTE_NOT_FOUND_MESSAGE };
      return { status, message: httpMessage(body, exception.message) };
    }
    this.logger.error(exception instanceof Error ? (exception.stack ?? exception.message) : String(exception));
    const error = exception as { name?: string; message?: string } | null;
    if (error?.name === 'TimeoutError') return { status: HttpStatus.BAD_GATEWAY, message: RAMA_TIMEOUT_MESSAGE };
    return { status: HttpStatus.BAD_GATEWAY, message: error?.message || String(exception) };
  }
}

function httpMessage(body: string | object, fallback: string): string {
  if (typeof body === 'string') return body;
  const message = (body as { message?: unknown }).message;
  if (Array.isArray(message)) return message.join('; ');
  return typeof message === 'string' ? message : fallback;
}
