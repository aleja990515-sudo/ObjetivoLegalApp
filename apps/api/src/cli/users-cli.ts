import { problemaDeClave } from '../usuarios/domain/registro.js';

/** Operaciones que usa la CLI; el núcleo no conoce Nest ni la terminal. */
export interface OperacionesUsuarios {
  crear(entrada: {
    nombreCompleto: string;
    cedula: string;
    correo: string;
    celular: string;
    clave: string;
  }): Promise<unknown>;
  activar(correo: string, activo: boolean): Promise<void>;
  cambiarClave(correo: string, clave: string): Promise<void>;
}

export interface DependenciasCli {
  operaciones: OperacionesUsuarios;
  /** Lee una clave sin mostrarla. Se llama dos veces en los comandos que la piden. */
  preguntarClave(etiqueta: string): Promise<string>;
  escribir(linea: string): void;
  error(linea: string): void;
}

export const USO = `Uso (desde la raíz del repositorio):
  npm run users:create -- <correo> "<nombre completo>" <cédula> <celular>
  npm run users:activate -- <correo>
  npm run users:deactivate -- <correo>
  npm run users:password -- <correo>
La clave nunca va como argumento: se pide por teclado (dos veces, mínimo 12 caracteres).`;

export const CODIGO_OK = 0;
export const CODIGO_ERROR = 1;
export const CODIGO_USO = 2;

/** Ejecuta un comando `users:*` y devuelve el código de salida. */
export async function ejecutarComando(argv: string[], deps: DependenciasCli): Promise<number> {
  const [comando, ...args] = argv;
  try {
    switch (comando) {
      case 'create':
        return await crear(args, deps);
      case 'activate':
      case 'deactivate':
        return await activarCuenta(comando === 'activate', args, deps);
      case 'password':
        return await cambiarClave(args, deps);
      default:
        deps.error(USO);
        return CODIGO_USO;
    }
  } catch (error) {
    // Validation, duplicates and missing accounts all surface as Error with a Spanish message.
    if (error instanceof Error) {
      deps.error(error.message);
      return CODIGO_ERROR;
    }
    throw error;
  }
}

async function crear(args: string[], deps: DependenciasCli): Promise<number> {
  const [correo, nombreCompleto, cedula, celular] = args;
  if (args.length !== 4) {
    deps.error(USO);
    return CODIGO_USO;
  }
  const clave = await clavePedidaDosVeces(deps);
  if (clave === null) return CODIGO_ERROR;
  await deps.operaciones.crear({ nombreCompleto, cedula, correo, celular, clave });
  deps.escribir(`Cuenta creada y activa: ${correo}`);
  return CODIGO_OK;
}

async function activarCuenta(activo: boolean, args: string[], deps: DependenciasCli): Promise<number> {
  const [correo] = args;
  if (args.length !== 1) {
    deps.error(USO);
    return CODIGO_USO;
  }
  await deps.operaciones.activar(correo, activo);
  deps.escribir(`Cuenta ${activo ? 'activada' : 'desactivada'}: ${correo}`);
  return CODIGO_OK;
}

async function cambiarClave(args: string[], deps: DependenciasCli): Promise<number> {
  const [correo] = args;
  if (args.length !== 1) {
    deps.error(USO);
    return CODIGO_USO;
  }
  const clave = await clavePedidaDosVeces(deps);
  if (clave === null) return CODIGO_ERROR;
  await deps.operaciones.cambiarClave(correo, clave);
  deps.escribir(`Clave actualizada: ${correo}`);
  return CODIGO_OK;
}

/** Pide la clave dos veces; `null` (con mensaje) si no cumple la regla o no coincide. */
async function clavePedidaDosVeces(deps: DependenciasCli): Promise<string | null> {
  const clave = await deps.preguntarClave('Clave (mínimo 12 caracteres): ');
  const problema = problemaDeClave(clave);
  if (problema) {
    deps.error(problema);
    return null;
  }
  const repetida = await deps.preguntarClave('Repite la clave: ');
  if (repetida !== clave) {
    deps.error('Las claves no coinciden. No se guardó nada.');
    return null;
  }
  return clave;
}
