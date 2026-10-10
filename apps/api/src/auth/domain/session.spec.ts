import { legacyCookieSesion, legacyLeerSesion, legacySecret } from './legacy-session.fixture.js';
import { deriveSecret, readSession, safeEqual, sessionCookie } from './session.js';

const NOW = Date.UTC(2026, 9, 10, 12);
const cookieHeader = (setCookie: string) => setCookie.split(';')[0];

describe('session (legacy compatible)', () => {
  const secret = deriveSecret('clave-oficina', null);

  it('derives the secret like the legacy server', () => {
    expect(secret).toBe(legacySecret('clave-oficina'));
    expect(deriveSecret('clave-oficina', 'explicit')).toBe('explicit');
  });

  it('produces byte-identical cookies to the legacy algorithm', () => {
    expect(sessionCookie(secret, 'Ana María', NOW, false)).toBe(legacyCookieSesion(secret, 'Ana María', NOW, false));
    expect(sessionCookie(secret, 'Ana', NOW, true)).toBe(legacyCookieSesion(secret, 'Ana', NOW, true));
  });

  it('accepts a cookie signed by the legacy algorithm', () => {
    const legacy = cookieHeader(legacyCookieSesion(secret, 'Ñandú José', NOW, false));
    expect(readSession(secret, `otra=1; ${legacy}; x=y`, NOW + 1000)).toEqual({ nombre: 'Ñandú José' });
  });

  it('issues cookies the legacy server accepts (rollback safety)', () => {
    const cookie = cookieHeader(sessionCookie(secret, 'Luis', NOW, false));
    expect(legacyLeerSesion(secret, cookie, NOW + 1000)).toEqual({ nombre: 'Luis' });
  });

  it('rejects expired sessions after 30 days', () => {
    const cookie = cookieHeader(sessionCookie(secret, 'Luis', NOW, false));
    const thirtyDays = 30 * 864e5;
    expect(readSession(secret, cookie, NOW + thirtyDays - 1)).toEqual({ nombre: 'Luis' });
    expect(readSession(secret, cookie, NOW + thirtyDays)).toBeNull();
  });

  it('rejects forged, foreign-secret, malformed or missing cookies', () => {
    const cookie = cookieHeader(sessionCookie(secret, 'Luis', NOW, false));
    expect(readSession(deriveSecret('otra-clave', null), cookie, NOW)).toBeNull();
    expect(
      readSession(
        secret,
        cookie.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')),
        NOW,
      ),
    ).toBeNull();
    expect(readSession(secret, 'sesion=%E0%A4%A', NOW)).toBeNull();
    expect(readSession(secret, 'sesion=sinpunto', NOW)).toBeNull();
    expect(readSession(secret, 'otra=1', NOW)).toBeNull();
    expect(readSession(secret, undefined, NOW)).toBeNull();
  });

  it('compares secrets in constant time regardless of type or length', () => {
    expect(safeEqual('clave', 'clave')).toBe(true);
    expect(safeEqual('clave', 'clave-larga')).toBe(false);
    expect(safeEqual(undefined, 'clave')).toBe(false);
    expect(safeEqual(1234, '1234')).toBe(true);
  });
});
