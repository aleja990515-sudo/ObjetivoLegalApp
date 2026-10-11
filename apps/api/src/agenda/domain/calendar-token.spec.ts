import { createHmac } from 'node:crypto';
import { tokenAgenda } from './calendar-token.js';

describe('tokenAgenda', () => {
  it('is the first 32 hex digits of HMAC-SHA256(secret, "agenda-ics") as the legacy link', () => {
    const esperado = createHmac('sha256', 'secreto-de-prueba').update('agenda-ics').digest('hex').slice(0, 32);
    expect(tokenAgenda('secreto-de-prueba')).toBe(esperado);
    expect(tokenAgenda('secreto-de-prueba')).toMatch(/^[0-9a-f]{32}$/);
  });

  it('changes with the secret', () => {
    expect(tokenAgenda('uno')).not.toBe(tokenAgenda('dos'));
  });
});
