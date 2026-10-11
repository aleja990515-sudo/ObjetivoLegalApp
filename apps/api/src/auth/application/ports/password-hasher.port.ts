export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');

/** Hashing of account passwords. The adapter stores its parameters inside the hash. */
export interface PasswordHasher {
  hash(clave: string): Promise<string>;
  /** Constant-time comparison; `false` for a malformed stored hash. */
  verify(clave: string, hash: string): Promise<boolean>;
  /** True when the stored hash uses parameters other than the current ones. */
  needsRehash(hash: string): boolean;
}
