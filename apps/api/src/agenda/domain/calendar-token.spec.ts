import { createHash, createHmac } from 'node:crypto';
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

  it('derives from SESSION_SECRET, never from the retired APP_PASSWORD secret', () => {
    const sesion = 'secreto-de-sesion-de-prueba-de-32-chars';
    const porClaveAntigua = createHmac('sha256', createHash('sha256').update('s:clave-de-oficina').digest('hex'))
      .update('agenda-ics')
      .digest('hex')
      .slice(0, 32);
    expect(tokenAgenda(sesion)).toBe(createHmac('sha256', sesion).update('agenda-ics').digest('hex').slice(0, 32));
    expect(tokenAgenda(sesion)).not.toBe(porClaveAntigua);
  });
});
