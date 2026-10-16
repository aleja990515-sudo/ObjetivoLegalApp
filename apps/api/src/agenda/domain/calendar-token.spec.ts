import { createHash, createHmac } from 'node:crypto';
import { tokenAgenda } from './calendar-token.js';

const SECRET = 'secreto-de-prueba';

describe('tokenAgenda', () => {
  it('is `<usuarioId>.<first 32 hex digits of HMAC-SHA256(secret, "agenda-ics:<usuarioId>")>`', () => {
    const esperado = createHmac('sha256', SECRET).update('agenda-ics:u-ana').digest('hex').slice(0, 32);
    expect(tokenAgenda(SECRET, 'u-ana')).toBe(`u-ana.${esperado}`);
    expect(tokenAgenda(SECRET, 'u-ana')).toMatch(/^u-ana\.[0-9a-f]{32}$/);
  });

  it('gives a different token to every user, so a link only unlocks its own calendar', () => {
    expect(tokenAgenda(SECRET, 'u-ana')).not.toBe(tokenAgenda(SECRET, 'u-luis'));
  });

  it('changes with the secret', () => {
    expect(tokenAgenda('uno', 'u-ana')).not.toBe(tokenAgenda('dos', 'u-ana'));
  });

  it('derives from SESSION_SECRET, never from the retired APP_PASSWORD secret', () => {
    const sesion = 'secreto-de-sesion-de-prueba-de-32-chars';
    const porClaveAntigua = createHmac('sha256', createHash('sha256').update('s:clave-de-oficina').digest('hex'))
      .update('agenda-ics:u-ana')
      .digest('hex')
      .slice(0, 32);
    expect(tokenAgenda(sesion, 'u-ana')).toBe(`u-ana.${createHmac('sha256', sesion).update('agenda-ics:u-ana').digest('hex').slice(0, 32)}`);
    expect(tokenAgenda(sesion, 'u-ana')).not.toBe(`u-ana.${porClaveAntigua}`);
  });
});
