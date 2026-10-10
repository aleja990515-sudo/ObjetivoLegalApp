export const META_REPOSITORY = Symbol('META_REPOSITORY');

/** Well-known meta keys. */
export const META_ULTIMA_REVISION = 'ultimaRevision';

/** Small key/value store for application metadata (e.g. last review time). */
export interface MetaRepository {
  get(clave: string): Promise<string | null>;
  set(clave: string, valor: string): Promise<void>;
}
