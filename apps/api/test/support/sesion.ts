import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ScryptPasswordHasher } from '../../src/auth/infrastructure/crypto/scrypt-password-hasher.js';
import { PersonalDataProtector } from '../../src/usuarios/infrastructure/persistence/personal-data.protector.js';
import { TypeOrmUsuarioRepository } from '../../src/usuarios/infrastructure/persistence/typeorm-usuario.repository.js';

// Invented credentials for the e2e database. The key is the same one vitest.config.e2e.ts sets.
export const CLAVE_PRUEBA = 'clave-de-prueba-larga';
const CLAVE_DATOS = Buffer.alloc(32, 7).toString('base64');

/** Account a spec can seed fixtures for: `cedula` and `correo` are unique, so each user needs its own. */
export interface UsuarioPrueba {
  nombre: string;
  correo: string;
  cedula: string;
  celular: string;
}

/** Owner of the seeded procesos. */
export const ANA: UsuarioPrueba = {
  nombre: 'Ana',
  correo: 'ana@example.com',
  cedula: '1000000001',
  celular: '3000000001',
};

/** Second user of the ownership specs: what BETO owns must stay invisible to ANA. */
export const BETO: UsuarioPrueba = {
  nombre: 'Beto',
  correo: 'beto@example.com',
  cedula: '1000000002',
  celular: '3000000002',
};

export const CORREO_PRUEBA = ANA.correo;

export interface SesionPrueba {
  /** The `sesion=...` cookie pair to send in every request. */
  cookie: string;
  /** Id the specs must stamp on the `proceso` fixtures they seed for this session. */
  usuarioId: string;
}

/**
 * Creates the account when it is missing (tests truncate the tables between cases)
 * and returns its id. The id is a generated uuid, so fixtures that must be visible
 * to this session have to carry it instead of a hardcoded value.
 */
export async function asegurarUsuarioActivo(dataSource: DataSource, usuario: UsuarioPrueba = ANA): Promise<string> {
  const repo = new TypeOrmUsuarioRepository(dataSource, new PersonalDataProtector(CLAVE_DATOS));
  const existente = await repo.buscarPorCorreo(usuario.correo);
  if (existente) return existente.usuario.id;
  const creado = await repo.crear({
    nombre: usuario.nombre,
    nombreCompleto: usuario.nombre,
    correo: usuario.correo,
    cedula: usuario.cedula,
    celular: usuario.celular,
    passwordHash: await new ScryptPasswordHasher().hash(CLAVE_PRUEBA),
    activo: true,
    consentimientoAt: null,
  });
  return creado.id;
}

/** Logs in with a test account and returns the `sesion=...` cookie pair plus that user's id. */
export async function iniciarSesion(
  app: NestExpressApplication,
  usuario: UsuarioPrueba = ANA,
): Promise<SesionPrueba> {
  const usuarioId = await asegurarUsuarioActivo(app.get(DataSource), usuario);
  const res = await request(app.getHttpServer())
    .post('/api/login')
    .send({ correo: usuario.correo, clave: CLAVE_PRUEBA })
    .expect(200);
  return { cookie: String(res.headers['set-cookie'][0]).split(';')[0], usuarioId };
}