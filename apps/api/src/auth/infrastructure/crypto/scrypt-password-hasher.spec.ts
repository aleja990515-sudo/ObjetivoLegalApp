import { ScryptPasswordHasher, SCRYPT_DEFAULTS, derivarScrypt, parseScryptHash } from './scrypt-password-hasher.js';

describe('scrypt password hashing', () => {
  it('matches the known answer of node:crypto scrypt (N=16, r=1, p=1, salt "0123456789abcdef")', async () => {
    const salt = Buffer.from('0123456789abcdef');
    const key = await derivarScrypt('clave-de-prueba-larga', salt, { N: 16, r: 1, p: 1 });
    expect(key.toString('base64')).toBe(
      'c+Zg8EqiWj1aM4lnjr1eZL7otksdS5TWDbSbGuJmOBX7O1zb7mDaZznXmGfd3XMANzZwuQDwlDQ2Ht4yK9tDsg==',
    );
  });

  it('stores the hash as scrypt$N$r$p$salt$hash with the current parameters', async () => {
    const hasher = new ScryptPasswordHasher();
    const hash = await hasher.hash('clave-de-prueba-larga');
    const partes = hash.split('$');
    expect(partes).toHaveLength(6);
    expect(partes.slice(0, 4)).toEqual(['scrypt', '32768', '8', '1']);
    expect(hash).not.toContain('clave-de-prueba-larga');
  });

  it('verifies the right password and rejects others', async () => {
    const hasher = new ScryptPasswordHasher();
    const hash = await hasher.hash('clave-de-prueba-larga');
    expect(await hasher.verify('clave-de-prueba-larga', hash)).toBe(true);
    expect(await hasher.verify('clave-de-prueba-large', hash)).toBe(false);
    expect(await hasher.verify('', hash)).toBe(false);
  });

  it('uses a fresh salt for every hash', async () => {
    const hasher = new ScryptPasswordHasher();
    expect(await hasher.hash('clave-de-prueba-larga')).not.toBe(await hasher.hash('clave-de-prueba-larga'));
  });

  it('answers false for malformed or out-of-range stored hashes', async () => {
    const hasher = new ScryptPasswordHasher();
    for (const hash of ['', 'md5$x', 'scrypt$3$8$1$AAAA$AAAA', 'scrypt$32768$8$1$$', 'scrypt$1$1$1$AAAA$AAAA']) {
      expect(parseScryptHash(hash)).toBeNull();
      expect(await hasher.verify('clave-de-prueba-larga', hash)).toBe(false);
    }
  });

  it('flags hashes made with other parameters for rehash', async () => {
    const hasher = new ScryptPasswordHasher();
    const actual = await hasher.hash('clave-de-prueba-larga');
    expect(hasher.needsRehash(actual)).toBe(false);
    const antiguo = actual.replace(`$${SCRYPT_DEFAULTS.N}$`, '$16384$');
    expect(hasher.needsRehash(antiguo)).toBe(true);
    expect(hasher.needsRehash('no-es-un-hash')).toBe(true);
  });
});
