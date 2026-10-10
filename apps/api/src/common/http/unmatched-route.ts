import type { Request } from 'express';

export const UNMATCHED_ROUTE_RESPONDER = Symbol('UNMATCHED_ROUTE_RESPONDER');

/**
 * Optional hook for unknown /api routes. Returns a replacement status/message,
 * or `null` to keep the default 404 "Ruta no encontrada.".
 */
export interface UnmatchedRouteResponder {
  respond(req: Request): { status: number; message: string } | null;
}
