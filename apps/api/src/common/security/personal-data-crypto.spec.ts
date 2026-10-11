import { randomBytes } from 'node:crypto';
import {
  cifrarCampo,
  derivePersonalDataKeys,
  descifrarCampo,
  indiceCiego,
  parseDataKey,
} from './personal-data-crypto.js';

const CLAVE = Buffer.alloc(32, 7).toString('base64');

describe('personal data encryption', () => {
  const keys = derivePersonalDataKeys(CLAVE);

  it('round-trips UTF-8 text through AES-256-GCM', () => {
    const texto = '1000000000 · Ñandú@example.com';
    const cifrado = cifrarCampo(keys.cifrado, texto);
    expect(descifrarCampo(keys.cifrado, cifrado)).toBe(texto);
  });

  it('never stores the plaintext and uses a fresh IV for every value', () => {
    const a = cifrarCampo(keys.cifrado, '3001234567');
    const b = cifrarCampo(keys.cifrado, '3001234567');
    expect(a).not.toContain('3001234567');
    expect(a).not.toBe(b);
  });

  it('rejects tampered ciphertext and a different key', () => {
    const cifrado = Buffer.from(cifrarCampo(keys.cifrado, '1000000000'), 'base64');
    cifrado[cifrado.length - 1] ^= 0x01;
    expect(() => descifrarCampo(keys.cifrado, cifrado.toString('base64'))).toThrow();
    const otra = derivePersonalDataKeys(randomBytes(32).toString('base64')).cifrado;
    expect(() => descifrarCampo(otra, cifrarCampo(keys.cifrado, 'x'))).toThrow();
    expect(() => descifrarCampo(keys.cifrado, 'corto')).toThrow(/inválido/);
  });

  it('derives independent encryption and index keys', () => {
    expect(keys.cifrado.equals(keys.indice)).toBe(false);
    expect(keys.cifrado).toHaveLength(32);
  });

  it('builds a deterministic keyed index that depends on the key', () => {
    expect(indiceCiego(keys.indice, 'ana@example.com')).toBe(indiceCiego(keys.indice, 'ana@example.com'));
    expect(indiceCiego(keys.indice, 'ana@example.com')).not.toBe(indiceCiego(keys.indice, 'luis@example.com'));
    const otro = derivePersonalDataKeys(randomBytes(32).toString('base64')).indice;
    expect(indiceCiego(otro, 'ana@example.com')).not.toBe(indiceCiego(keys.indice, 'ana@example.com'));
  });

  it('accepts only canonical base64 of 32 bytes as DATA_ENCRYPTION_KEY', () => {
    expect(parseDataKey(CLAVE)).toHaveLength(32);
    expect(() => parseDataKey(Buffer.alloc(16).toString('base64'))).toThrow(/32 bytes/);
    expect(() => parseDataKey('no es base64 !!')).toThrow(/32 bytes/);
  });
});
