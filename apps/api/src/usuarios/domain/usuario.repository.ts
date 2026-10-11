import type { CuentaConClave, NuevaCuenta, Usuario } from './usuario.js';

export const USUARIO_REPOSITORY = Symbol('USUARIO_REPOSITORY');

/** Persistencia de cuentas. Los datos personales se cifran en la implementación, nunca aquí. */
export interface UsuarioRepository {
  /** Busca por correo normalizado (minúsculas). */
  buscarPorCorreo(correo: string): Promise<CuentaConClave | null>;
  /** True si ya existe una cuenta con esa cédula o ese correo. */
  existeCedulaOCorreo(cedula: string, correo: string): Promise<boolean>;
  /** Lanza `CuentaDuplicadaError` ante una violación de unicidad. */
  crear(cuenta: NuevaCuenta): Promise<Usuario>;
  /** `false` si no existe la cuenta. */
  actualizarActivo(correo: string, activo: boolean): Promise<boolean>;
  /** `false` si no existe la cuenta. */
  actualizarClave(correo: string, passwordHash: string): Promise<boolean>;
}
