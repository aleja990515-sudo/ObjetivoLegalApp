import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { PasswordHasher } from '../../application/ports/password-hasher.port.js';

export interface ScryptParams {
  N: number;
  r: number;
  p: number;
}

/** Current cost. N=2^15, r=8, p=1 uses about 32 MiB per hash. */
export const SCRYPT_DEFAULTS: ScryptParams = { N: 32768, r: 8, p: 1 };
const SALT_BYTES = 16;
const KEY_BYTES = 64;
const PREFIX = 'scrypt';

/** Format `scrypt$N$r$p$salt$hash` with base64 salt and hash. */
export function formatScryptHash(params: ScryptParams, salt: Buffer, key: Buffer): string {
  return [PREFIX, params.N, params.r, params.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export interface ParsedScryptHash {
  params: ScryptParams;
  salt: Buffer;
  key: Buffer;
}

/** Parses a stored hash; `null` for anything malformed or with out-of-range cost. */
export function parseScryptHash(hash: string): ParsedScryptHash | null {
  const partes = hash.split('$');
  if (partes.length !== 6 || partes[0] !== PREFIX) return null;
  const [N, r, p] = [Number(partes[1]), Number(partes[2]), Number(partes[3])];
  const esEntero = (n: number) => Number.isInteger(n) && n > 0;
  if (!esEntero(N) || (N & (N - 1)) !== 0 || N < 2 ** 10 || N > 2 ** 20) return null;
  if (!esEntero(r) || r > 32 || !esEntero(p) || p > 16) return null;
  const salt = Buffer.from(partes[4], 'base64');
  const key = Buffer.from(partes[5], 'base64');
  if (salt.length === 0 || key.length === 0) return null;
  return { params: { N, r, p }, salt, key };
}

/** scrypt derivation through node:crypto (no dependency). */
export function derivarScrypt(clave: string, salt: Buffer, params: ScryptParams, keyLength = KEY_BYTES): Promise<Buffer> {
  const options: ScryptOptions = { ...params, maxmem: 128 * params.N * params.r * 2 };
  return new Promise((resolve, reject) =>
    scrypt(clave, salt, keyLength, options, (error, key) => (error ? reject(error) : resolve(key))),
  );
}

@Injectable()
export class ScryptPasswordHasher implements PasswordHasher {
  async hash(clave: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const key = await derivarScrypt(clave, salt, SCRYPT_DEFAULTS);
    return formatScryptHash(SCRYPT_DEFAULTS, salt, key);
  }

  async verify(clave: string, hash: string): Promise<boolean> {
    const parsed = parseScryptHash(hash);
    if (!parsed) return false;
    const calculada = await derivarScrypt(clave, parsed.salt, parsed.params, parsed.key.length);
    return calculada.length === parsed.key.length && timingSafeEqual(calculada, parsed.key);
  }

  needsRehash(hash: string): boolean {
    const parsed = parseScryptHash(hash);
    if (!parsed) return true;
    const { N, r, p } = parsed.params;
    return N !== SCRYPT_DEFAULTS.N || r !== SCRYPT_DEFAULTS.r || p !== SCRYPT_DEFAULTS.p;
  }
}
