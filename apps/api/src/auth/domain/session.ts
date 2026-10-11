import { createHmac, timingSafeEqual } from 'node:crypto';

export { safeEqual } from '../../common/security/safe-equal.js';

export const SESSION_COOKIE = 'sesion';
export const SESSION_DAYS = 30;
const DAY_MS = 864e5;

/** Usuario autenticado: el id va firmado en la cookie; el nombre es lo que muestra la app. */
export interface SessionUser {
  id: string;
  nombre: string;
}

/** `value + '.' + base64url(HMAC_SHA256(secret, value))`. */
export function sign(secret: string, value: string): string {
  return value + '.' + createHmac('sha256', secret).update(value).digest('base64url');
}

/** Signed token for `usuario`, valid for 30 days from `nowMs`. Payload: `[usuarioId, nombre, expMs]`. */
export function createSessionToken(secret: string, usuario: SessionUser, nowMs: number): string {
  const value = Buffer.from(JSON.stringify([usuario.id, usuario.nombre, nowMs + SESSION_DAYS * DAY_MS])).toString(
    'base64url',
  );
  return sign(secret, value);
}

/** `Set-Cookie` header value for a new session. */
export function sessionCookie(secret: string, usuario: SessionUser, nowMs: number, secure: boolean): string {
  const token = encodeURIComponent(createSessionToken(secret, usuario, nowMs));
  return (
    `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}` +
    (secure ? '; Secure' : '')
  );
}

export const CLEAR_SESSION_COOKIE = `${SESSION_COOKIE}=; Path=/; Max-Age=0`;

const COOKIE_PATTERN = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`);

const esPayloadValido = (payload: unknown): payload is [string, string, number] =>
  Array.isArray(payload) &&
  payload.length === 3 &&
  typeof payload[0] === 'string' &&
  typeof payload[1] === 'string' &&
  typeof payload[2] === 'number';

/**
 * Reads and verifies the session from a `Cookie` header; `null` if missing, forged,
 * expired or in the legacy `[nombre, exp]` format (those were signed with a different secret).
 */
export function readSession(secret: string, cookieHeader: string | undefined, nowMs: number): SessionUser | null {
  const match = COOKIE_PATTERN.exec(cookieHeader || '');
  if (!match) return null;
  try {
    const token = decodeURIComponent(match[1]);
    const value = token.slice(0, token.lastIndexOf('.'));
    const expected = Buffer.from(sign(secret, value));
    const actual = Buffer.from(token);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const payload: unknown = JSON.parse(Buffer.from(value, 'base64url').toString());
    if (!esPayloadValido(payload)) return null;
    const [id, nombre, exp] = payload;
    return nowMs < exp ? { id, nombre } : null;
  } catch {
    return null;
  }
}
