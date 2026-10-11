import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from 'node:crypto';

// AES-256-GCM for personal data at rest (cédula, celular, correo) plus a keyed
// HMAC-SHA256 index for uniqueness and login lookups. Two independent keys are
// derived from DATA_ENCRYPTION_KEY with HKDF-SHA256 so the index never reveals
// the encryption key and vice versa. Losing DATA_ENCRYPTION_KEY makes these
// fields unreadable: the operator must back it up.

/** Thrown when personal data must be read or written but DATA_ENCRYPTION_KEY is unset. */
export class DataEncryptionKeyMissingError extends Error {
  constructor() {
    super('DATA_ENCRYPTION_KEY no está configurada.');
    this.name = 'DataEncryptionKeyMissingError';
  }
}

const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const ALGORITHM = 'aes-256-gcm';

export interface PersonalDataKeys {
  /** AES-256-GCM key. */
  cifrado: Buffer;
  /** HMAC-SHA256 key for lookup indexes. */
  indice: Buffer;
}

/** Decodes DATA_ENCRYPTION_KEY (canonical base64 of 32 bytes) into the master key. */
export function parseDataKey(valor: string): Buffer {
  const bytes = Buffer.from(valor, 'base64');
  if (bytes.length !== KEY_BYTES || bytes.toString('base64') !== valor) {
    throw new Error('DATA_ENCRYPTION_KEY debe ser 32 bytes en base64.');
  }
  return bytes;
}

/** Derives the encryption and index keys from the master key (HKDF-SHA256, distinct info labels). */
export function derivePersonalDataKeys(valor: string): PersonalDataKeys {
  const maestra = parseDataKey(valor);
  const derivar = (info: string) =>
    Buffer.from(hkdfSync('sha256', maestra, Buffer.alloc(0), `mis-procesos:${info}:v1`, KEY_BYTES));
  return { cifrado: derivar('cifrado'), indice: derivar('indice') };
}

/** Encrypts `texto` with a random IV. Output: base64(iv || tag || ciphertext). */
export function cifrarCampo(clave: Buffer, texto: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, clave, iv, { authTagLength: TAG_BYTES });
  const cuerpo = Buffer.concat([cipher.update(texto, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), cuerpo]).toString('base64');
}

/** Reverses {@link cifrarCampo}; throws when the value was altered or the key is wrong. */
export function descifrarCampo(clave: Buffer, valor: string): string {
  const bytes = Buffer.from(valor, 'base64');
  if (bytes.length < IV_BYTES + TAG_BYTES) throw new Error('Campo cifrado inválido.');
  const decipher = createDecipheriv(ALGORITHM, clave, bytes.subarray(0, IV_BYTES), { authTagLength: TAG_BYTES });
  decipher.setAuthTag(bytes.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  const texto = Buffer.concat([decipher.update(bytes.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]);
  return texto.toString('utf8');
}

/** Deterministic keyed index of a normalized value (lowercase correo, digits-only cédula). */
export function indiceCiego(claveIndice: Buffer, valor: string): string {
  return createHmac('sha256', claveIndice).update(valor).digest('hex');
}
