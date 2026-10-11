/** Cuenta de la oficina tal como la usa la aplicación (sin datos personales cifrados ni hash). */
export interface Usuario {
  id: string;
  /** Nombre que muestra la app y que queda en `agregadoPor`, notas y tareas. */
  nombre: string;
  activo: boolean;
}

/** Datos necesarios para crear una cuenta; `passwordHash` ya viene calculado. */
export interface NuevaCuenta {
  nombre: string;
  nombreCompleto: string;
  /** Correo normalizado (minúsculas). Es el identificador de inicio de sesión. */
  correo: string;
  /** Solo dígitos. */
  cedula: string;
  celular: string;
  passwordHash: string;
  activo: boolean;
  /** Momento del consentimiento; `null` para cuentas creadas por la oficina. */
  consentimientoAt: Date | null;
}

/** Cuenta con su hash de clave, solo para verificar el inicio de sesión. */
export interface CuentaConClave {
  usuario: Usuario;
  passwordHash: string;
}

/** Violación de unicidad: ya existe una cuenta con esa cédula o ese correo. */
export class CuentaDuplicadaError extends Error {
  constructor() {
    super('Cuenta duplicada.');
    this.name = 'CuentaDuplicadaError';
  }
}
