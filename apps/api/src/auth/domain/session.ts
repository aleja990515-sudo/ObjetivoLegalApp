import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export { safeEqual } from '../../common/security/safe-equal.js';

// Session format shared with the legacy server (lib/app.js) so existing cookies
// stay valid after the migration. Do not change without a migration plan.

export const SESSION_COOKIE = 'sesion';
export const SESSION_DAYS = 30;
const DAY_MS = 864e5;

export interface SessionUser {
  nombre: string;
}

/** `SESSION_SECRET`, or `sha256hex('s:' + APP_PASSWORD)` when it is not set. */
export function deriveSecret(appPassword: string, sessionSecret: string | null): string {
  return (
    sessionSecret ||
    createHash('sha256')
      .update('s:' + appPassword)
      .digest('hex')
  );
}

/** `value + '.' + base64url(HMAC_SHA256(secret, value))`. */
export function sign(secret: string, value: string): string {
  return value + '.' + createHmac('sha256', secret).update(value).digest('base64url');
}

/** Signed token for `nombre`, valid for 30 days from `nowMs`. */
export function createSessionToken(secret: string, nombre: string, nowMs: number): string {
  const value = Buffer.from(JSON.stringify([nombre, nowMs + SESSION_DAYS * DAY_MS])).toString('base64url');
  return sign(secret, value);
}

/** `Set-Cookie` header value for a new session. */
export function sessionCookie(secret: string, nombre: string, nowMs: number, secure: boolean): string {
  const token = encodeURIComponent(createSessionToken(secret, nombre, nowMs));
  return (
    `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}` +
    (secure ? '; Secure' : '')
  );
}

export const CLEAR_SESSION_COOKIE = `${SESSION_COOKIE}=; Path=/; Max-Age=0`;

const COOKIE_PATTERN = new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`);

/** Reads and verifies the session from a `Cookie` header; `null` if missing, forged or expired. */
export function readSession(secret: string, cookieHeader: string | undefined, nowMs: number): SessionUser | null {
  const match = COOKIE_PATTERN.exec(cookieHeader || '');
  if (!match) return null;
  try {
    const token = decodeURIComponent(match[1]);
    const value = token.slice(0, token.lastIndexOf('.'));
    const expected = Buffer.from(sign(secret, value));
    const actual = Buffer.from(token);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const [nombre, exp] = JSON.parse(Buffer.from(value, 'base64url').toString()) as [string, number];
    return nowMs < exp ? { nombre } : null;
  } catch {
    return null;
  }
}
