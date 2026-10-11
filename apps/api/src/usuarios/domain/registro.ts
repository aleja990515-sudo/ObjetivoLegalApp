// Reglas de los datos de una cuenta. Son puras: las usan el registro y los comandos `users:*`.

export const LONGITUD_CLAVE_MINIMA = 12;
const LONGITUD_CLAVE_MAXIMA = 256;
const CORREO_MAXIMO = 254;
const PATRON_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PATRON_CEDULA = /^\d{6,10}$/;
const PATRON_CELULAR = /^3\d{9}$/;

export class ErrorValidacion extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ErrorValidacion';
  }
}

/** Mensaje de la regla de clave, o `null` si la clave cumple. */
export function problemaDeClave(clave: string): string | null {
  return clave.length < LONGITUD_CLAVE_MINIMA || clave.length > LONGITUD_CLAVE_MAXIMA
    ? `La clave debe tener al menos ${LONGITUD_CLAVE_MINIMA} caracteres.`
    : null;
}

export interface DatosCuenta {
  nombreCompleto: string;
  cedula: string;
  /** Minúsculas, sin espacios. */
  correo: string;
  celular: string;
  clave: string;
}

export interface DatosRegistro extends DatosCuenta {
  consentimiento: true;
}

/** Forma canónica del correo: sin espacios y en minúsculas. */
export function normalizarCorreo(correo: string): string {
  return correo.trim().toLowerCase();
}

/**
 * Valida y normaliza los datos de una cuenta. Lanza `ErrorValidacion` con todos
 * los problemas encontrados, en español.
 */
export function validarDatosCuenta(entrada: unknown): DatosCuenta {
  const datos = (typeof entrada === 'object' && entrada !== null ? entrada : {}) as Record<string, unknown>;
  const errores: string[] = [];

  const nombreCompleto = textoLimpio(datos.nombreCompleto);
  if (nombreCompleto.length < 2 || nombreCompleto.length > 120) {
    errores.push('El nombre completo debe tener entre 2 y 120 caracteres.');
  }

  const cedula = textoLimpio(datos.cedula);
  if (!PATRON_CEDULA.test(cedula)) errores.push('La cédula debe tener entre 6 y 10 dígitos.');

  const correo = normalizarCorreo(typeof datos.correo === 'string' ? datos.correo : '');
  if (correo.length > CORREO_MAXIMO || !PATRON_CORREO.test(correo)) errores.push('El correo no es válido.');

  const celular = textoLimpio(datos.celular);
  if (!PATRON_CELULAR.test(celular)) {
    errores.push('El celular debe ser un número móvil colombiano de 10 dígitos que empiece por 3.');
  }

  const clave = typeof datos.clave === 'string' ? datos.clave : '';
  const problemaClave = problemaDeClave(clave);
  if (problemaClave) errores.push(problemaClave);

  if (errores.length > 0) throw new ErrorValidacion(errores.join(' '));
  return { nombreCompleto, cedula, correo, celular, clave };
}

/** Datos del formulario público: además de la cuenta, exige el consentimiento. */
export function validarRegistro(entrada: unknown): DatosRegistro {
  const datos = validarDatosCuenta(entrada);
  const consentimiento = (entrada as { consentimiento?: unknown } | null)?.consentimiento;
  if (consentimiento !== true) {
    throw new ErrorValidacion('Debes aceptar el tratamiento de tus datos para registrarte.');
  }
  return { ...datos, consentimiento: true };
}

/** Texto sin espacios de los extremos ni dobles espacios internos; vacío si no es texto. */
function textoLimpio(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim().replace(/\s+/g, ' ') : '';
}
