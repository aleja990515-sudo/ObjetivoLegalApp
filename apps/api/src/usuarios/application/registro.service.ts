import { Inject, Injectable } from '@nestjs/common';
import { ApiError } from '../../common/http/api-error.js';
import { PASSWORD_HASHER, type PasswordHasher } from '../../auth/application/ports/password-hasher.port.js';
import { CuentaDuplicadaError } from '../domain/usuario.js';
import { USUARIO_REPOSITORY, type UsuarioRepository } from '../domain/usuario.repository.js';
import { ErrorValidacion, validarRegistro } from '../domain/registro.js';

/** Mensaje genérico: no revela si la cédula o el correo ya están registrados. */
export const REGISTRO_DUPLICADO = 'No podemos completar el registro con esos datos. Escribe a la oficina si ya tienes cuenta.';
export const REGISTRO_RECIBIDO = 'Recibimos tu registro; la oficina lo activará.';

/** Autorregistro: crea la cuenta inactiva hasta que la oficina la active. */
@Injectable()
export class RegistroService {
  constructor(
    @Inject(USUARIO_REPOSITORY) private readonly usuarios: UsuarioRepository,
    @Inject(PASSWORD_HASHER) private readonly hasher: PasswordHasher,
  ) {}

  async registrar(entrada: unknown): Promise<string> {
    let datos;
    try {
      datos = validarRegistro(entrada);
    } catch (error) {
      if (error instanceof ErrorValidacion) throw new ApiError(400, error.message);
      throw error;
    }
    if (await this.usuarios.existeCedulaOCorreo(datos.cedula, datos.correo)) {
      throw new ApiError(409, REGISTRO_DUPLICADO);
    }
    const passwordHash = await this.hasher.hash(datos.clave);
    try {
      await this.usuarios.crear({
        nombre: datos.nombreCompleto.slice(0, 60),
        nombreCompleto: datos.nombreCompleto,
        correo: datos.correo,
        cedula: datos.cedula,
        celular: datos.celular,
        passwordHash,
        activo: false,
        consentimientoAt: new Date(),
      });
    } catch (error) {
      if (error instanceof CuentaDuplicadaError) throw new ApiError(409, REGISTRO_DUPLICADO);
      throw error;
    }
    return REGISTRO_RECIBIDO;
  }
}
