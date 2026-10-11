import {
  cifrarCampo,
  derivePersonalDataKeys,
  descifrarCampo,
  indiceCiego,
  type PersonalDataKeys,
} from '../../../common/security/personal-data-crypto.js';

export const DATA_PROTECTOR = Symbol('DATA_PROTECTOR');

export class DataEncryptionKeyMissingError extends Error {
  constructor() {
    super('DATA_ENCRYPTION_KEY no está configurada.');
    this.name = 'DataEncryptionKeyMissingError';
  }
}

/**
 * Cifrado de datos personales con las claves derivadas de DATA_ENCRYPTION_KEY.
 * Sin clave, cualquier uso lanza `DataEncryptionKeyMissingError` (registro,
 * inicio de sesión y comandos `users:*` la necesitan).
 */
export class PersonalDataProtector {
  private readonly keys: PersonalDataKeys | null;

  constructor(claveBase64: string | null) {
    this.keys = claveBase64 ? derivePersonalDataKeys(claveBase64) : null;
  }

  get disponible(): boolean {
    return this.keys !== null;
  }

  cifrar(texto: string): string {
    return cifrarCampo(this.requireKeys().cifrado, texto);
  }

  descifrar(valor: string): string {
    return descifrarCampo(this.requireKeys().cifrado, valor);
  }

  /** Índice determinista para unicidad y búsquedas; el valor debe venir normalizado. */
  indice(valor: string): string {
    return indiceCiego(this.requireKeys().indice, valor);
  }

  private requireKeys(): PersonalDataKeys {
    if (!this.keys) throw new DataEncryptionKeyMissingError();
    return this.keys;
  }
}
