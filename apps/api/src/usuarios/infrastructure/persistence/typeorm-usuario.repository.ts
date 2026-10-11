import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import type { DataSource, Repository } from 'typeorm';
import {
  CuentaDuplicadaError,
  type CuentaConClave,
  type NuevaCuenta,
  type Usuario,
} from '../../domain/usuario.js';
import { normalizarCorreo } from '../../domain/registro.js';
import type { UsuarioRepository } from '../../domain/usuario.repository.js';
import { DATA_PROTECTOR, type PersonalDataProtector } from './personal-data.protector.js';
import { UsuarioEntity } from './usuario.entity.js';

const PG_UNIQUE_VIOLATION = '23505';

const esViolacionDeUnicidad = (error: unknown): boolean => {
  const codigo = (error as { code?: string; driverError?: { code?: string } }).code;
  const driver = (error as { driverError?: { code?: string } }).driverError?.code;
  return codigo === PG_UNIQUE_VIOLATION || driver === PG_UNIQUE_VIOLATION;
};

const aUsuario = (e: UsuarioEntity): Usuario => ({ id: e.id, nombre: e.nombre, activo: e.activo });

@Injectable()
export class TypeOrmUsuarioRepository implements UsuarioRepository {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @Inject(DATA_PROTECTOR) private readonly protector: PersonalDataProtector,
  ) {}

  private get repo(): Repository<UsuarioEntity> {
    return this.dataSource.getRepository(UsuarioEntity);
  }

  async buscarPorCorreo(correo: string): Promise<CuentaConClave | null> {
    const entidad = await this.repo.findOne({
      where: { correoIndice: this.protector.indice(normalizarCorreo(correo)) },
    });
    return entidad ? { usuario: aUsuario(entidad), passwordHash: entidad.passwordHash } : null;
  }

  async existeCedulaOCorreo(cedula: string, correo: string): Promise<boolean> {
    const coincidencias = await this.repo.count({
      where: [
        { cedulaIndice: this.protector.indice(cedula) },
        { correoIndice: this.protector.indice(normalizarCorreo(correo)) },
      ],
    });
    return coincidencias > 0;
  }

  async crear(cuenta: NuevaCuenta): Promise<Usuario> {
    const entidad = Object.assign(new UsuarioEntity(), {
      id: randomUUID(),
      nombre: cuenta.nombre,
      nombreCompleto: cuenta.nombreCompleto,
      correoIndice: this.protector.indice(normalizarCorreo(cuenta.correo)),
      correoCifrado: this.protector.cifrar(normalizarCorreo(cuenta.correo)),
      cedulaIndice: this.protector.indice(cuenta.cedula),
      cedulaCifrada: this.protector.cifrar(cuenta.cedula),
      celularCifrado: this.protector.cifrar(cuenta.celular),
      passwordHash: cuenta.passwordHash,
      consentimientoAt: cuenta.consentimientoAt,
      activo: cuenta.activo,
    });
    try {
      await this.repo.insert(entidad);
    } catch (error) {
      if (esViolacionDeUnicidad(error)) throw new CuentaDuplicadaError();
      throw error;
    }
    return aUsuario(entidad);
  }

  async actualizarActivo(correo: string, activo: boolean): Promise<boolean> {
    const resultado = await this.repo.update(
      { correoIndice: this.protector.indice(normalizarCorreo(correo)) },
      { activo, actualizado: () => 'now()' },
    );
    return (resultado.affected ?? 0) > 0;
  }

  async actualizarClave(correo: string, passwordHash: string): Promise<boolean> {
    const resultado = await this.repo.update(
      { correoIndice: this.protector.indice(normalizarCorreo(correo)) },
      { passwordHash, actualizado: () => 'now()' },
    );
    return (resultado.affected ?? 0) > 0;
  }
}
