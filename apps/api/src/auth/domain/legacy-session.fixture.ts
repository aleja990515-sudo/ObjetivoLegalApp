// Frozen copy of the legacy session code (lib/app.js:6-7, 172-191 at commit 5ebfef6),
// adapted only to take the secret and clock as parameters. Used by tests to
// prove that cookies keep working across the migration, even after lib/ is removed.
import crypto from 'node:crypto';

export const legacySecret = (appPassword: string, sessionSecret?: string) =>
  sessionSecret ||
  crypto
    .createHash('sha256')
    .update('s:' + appPassword)
    .digest('hex');

export function legacyFirmar(secret: string, valor: string): string {
  return valor + '.' + crypto.createHmac('sha256', secret).update(valor).digest('base64url');
}

export function legacyLeerSesion(secret: string, cookie: string | undefined, now: number): { nombre: string } | null {
  const m = /(?:^|;\s*)sesion=([^;]+)/.exec(cookie || '');
  if (!m) return null;
  try {
    const token = decodeURIComponent(m[1]);
    const valor = token.slice(0, token.lastIndexOf('.'));
    const a = Buffer.from(legacyFirmar(secret, valor)),
      b = Buffer.from(token);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const [nombre, exp] = JSON.parse(Buffer.from(valor, 'base64url').toString());
    return now < exp ? { nombre } : null;
  } catch {
    return null;
  }
}

export function legacyCookieSesion(secret: string, nombre: string, now: number, seguro: boolean): string {
  const valor = Buffer.from(JSON.stringify([nombre, now + 30 * 864e5])).toString('base64url');
  return `sesion=${encodeURIComponent(legacyFirmar(secret, valor))}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 86400}${seguro ? '; Secure' : ''}`;
}
