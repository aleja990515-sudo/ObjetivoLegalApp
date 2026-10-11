import { Inject, Injectable } from '@nestjs/common';
import { PASSWORD_HASHER, type PasswordHasher } from '../../auth/application/ports/password-hasher.port.js';
import { ErrorValidacion, normalizarCorreo, problemaDeClave, validarDatosCuenta } from '../domain/registro.js';
import { CuentaDuplicadaError, type Usuario } from '../domain/usuario.js';
import { USUARIO_REPOSITORY, type UsuarioRepository } from '../domain/usuario.repository.js';

export const CUENTA_NO_ENCONTRADA = 'No existe una cuenta con ese correo.';
export const CUENTA_YA_EXISTE = 'Ya existe una cuenta con esa cédula o ese correo.';

/**
 * Operaciones de la oficina sobre las cuentas (comandos `users:*`). No recibe
 * claves por argumentos: quien llama pasa la clave ya leída de forma segura.
 */
@Injectable()
export class AdministracionUsuarios {
  constructor(
    @Inject(USUARIO_REPOSITORY) private readonly usuarios: UsuarioRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  /** Cuenta activa desde el primer momento (cuentas de prueba o internas). */
  async crear(entrada: unknown): Promise<Usuario> {
    const datos = validarDatosCuenta(entrada);
    if (await this.usuarios.existeCedulaOCorreo(datos.cedula, datos.correo)) throw new Error(CUENTA_YA_EXISTE);
    const passwordHash = await this.hasher.hash(datos.clave);
    try {
      return await this.usuarios.crear({
        nombre: datos.nombreCompleto.slice(0, 60),
        nombreCompleto: datos.nombreCompleto,
        correo: datos.correo,
        cedula: datos.cedula,
        celular: datos.celular,
        passwordHash,
        activo: true,
        consentimientoAt: null,
      });
    } catch (error) {
      if (error instanceof CuentaDuplicadaError) throw new Error(CUENTA_YA_EXISTE);
      throw error;
    }
  }

  async activar(correo: string, activo: boolean): Promise<void> {
    if (!(await this.usuarios.actualizarActivo(normalizarCorreo(correo), activo))) {
      throw new Error(CUENTA_NO_ENCONTRADA);
    }
  }

  async cambiarClave(correo: string, clave: string): Promise<void> {
    const problema = problemaDeClave(clave);
    if (problema) throw new ErrorValidacion(problema);
    const passwordHash = await this.hasher.hash(clave);
    if (!(await this.usuarios.actualizarClave(normalizarCorreo(correo), passwordHash))) {
      throw new Error(CUENTA_NO_ENCONTRADA);
    }
  }
}
