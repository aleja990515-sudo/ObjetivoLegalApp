import { readSession, safeEqual, sessionCookie, sign } from './session.js';

const NOW = Temporal.Instant.from('2026-10-10T12:00:00Z').epochMilliseconds;
const cookieHeader = (setCookie: string) => setCookie.split(';')[0];
const SECRET = 'secreto-de-sesion-de-prueba-de-32-chars';
const ANA = { id: '0b6f4c2e-1111-4222-8333-944455556666', nombre: 'Ana María' };

describe('session', () => {
  it('stores the user id and name in the signed payload', () => {
    const cookie = cookieHeader(sessionCookie(SECRET, ANA, NOW, false));
    expect(readSession(SECRET, cookie, NOW + 1000)).toEqual(ANA);
    const payload = decodeURIComponent(cookie.split('=')[1]).split('.')[0];
    expect(JSON.parse(Buffer.from(payload, 'base64url').toString())).toEqual([ANA.id, ANA.nombre, NOW + 30 * 864e5]);
  });

  it('keeps the cookie attributes (HttpOnly, SameSite=Lax, 30 days, Secure when asked)', () => {
    expect(sessionCookie(SECRET, ANA, NOW, false)).toMatch(/^sesion=.+; HttpOnly; SameSite=Lax; Path=\/; Max-Age=2592000$/);
    expect(sessionCookie(SECRET, ANA, NOW, true)).toMatch(/; Secure$/);
  });

  it('rejects expired sessions after 30 days', () => {
    const cookie = cookieHeader(sessionCookie(SECRET, ANA, NOW, false));
    const thirtyDays = 30 * 864e5;
    expect(readSession(SECRET, cookie, NOW + thirtyDays - 1)).toEqual(ANA);
    expect(readSession(SECRET, cookie, NOW + thirtyDays)).toBeNull();
  });

  it('rejects cookies signed with another secret, including a legacy APP_PASSWORD-derived one', () => {
    const cookie = cookieHeader(sessionCookie(SECRET, ANA, NOW, false));
    expect(readSession('otro-secreto-de-sesion-de-prueba-largo', cookie, NOW)).toBeNull();
  });

  it('rejects forged, malformed, legacy-format or missing cookies', () => {
    const cookie = cookieHeader(sessionCookie(SECRET, ANA, NOW, false));
    expect(readSession(SECRET, cookie.replace(/.$/, (c) => (c === 'A' ? 'B' : 'A')), NOW)).toBeNull();
    expect(readSession(SECRET, 'sesion=%E0%A4%A', NOW)).toBeNull();
    expect(readSession(SECRET, 'sesion=sinpunto', NOW)).toBeNull();
    expect(readSession(SECRET, 'otra=1', NOW)).toBeNull();
    expect(readSession(SECRET, undefined, NOW)).toBeNull();
  });

  it('rejects a validly signed payload in the legacy [nombre, exp] shape', () => {
    const value = Buffer.from(JSON.stringify(['Luis', NOW + 1e9])).toString('base64url');
    expect(readSession(SECRET, `sesion=${encodeURIComponent(sign(SECRET, value))}`, NOW)).toBeNull();
  });

  it('compares secrets in constant time regardless of type or length', () => {
    expect(safeEqual('clave', 'clave')).toBe(true);
    expect(safeEqual('clave', 'clave-larga')).toBe(false);
    expect(safeEqual(undefined, 'clave')).toBe(false);
    expect(safeEqual(1234, '1234')).toBe(true);
  });
});
