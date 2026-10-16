export const META_REPOSITORY = Symbol('META_REPOSITORY');

/** Well-known meta keys. */
export const META_ULTIMA_REVISION = 'ultimaRevision';

/** ISO instant of the last estados sweep that advanced; the next window starts from it. */
export const META_ULTIMO_BARRIDO_ESTADOS = 'ultimoBarridoEstados';

/** Small key/value store for application metadata (e.g. last review time). */
export interface MetaRepository {
  get(clave: string): Promise<string | null>;
  set(clave: string, valor: string): Promise<void>;
}
