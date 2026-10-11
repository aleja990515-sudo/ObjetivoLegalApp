import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { ScryptPasswordHasher } from '../../src/auth/infrastructure/crypto/scrypt-password-hasher.js';
import { PersonalDataProtector } from '../../src/usuarios/infrastructure/persistence/personal-data.protector.js';
import { TypeOrmUsuarioRepository } from '../../src/usuarios/infrastructure/persistence/typeorm-usuario.repository.js';

// Invented credentials for the e2e database. The key is the same one vitest.config.e2e.ts sets.
export const CORREO_PRUEBA = 'ana@example.com';
export const CLAVE_PRUEBA = 'clave-de-prueba-larga';
const CLAVE_DATOS = Buffer.alloc(32, 7).toString('base64');

/** Creates the active test account when it is missing (tests truncate the tables between cases). */
export async function asegurarUsuarioActivo(app: NestExpressApplication, correo = CORREO_PRUEBA): Promise<void> {
  const repo = new TypeOrmUsuarioRepository(app.get(DataSource), new PersonalDataProtector(CLAVE_DATOS));
  if (await repo.buscarPorCorreo(correo)) return;
  await repo.crear({
    nombre: 'Ana',
    nombreCompleto: 'Ana María',
    correo,
    cedula: '1000000001',
    celular: '3000000001',
    passwordHash: await new ScryptPasswordHasher().hash(CLAVE_PRUEBA),
    activo: true,
    consentimientoAt: null,
  });
}

/** Logs in with the test account and returns the `sesion=...` cookie pair. */
export async function iniciarSesion(app: NestExpressApplication): Promise<string> {
  await asegurarUsuarioActivo(app);
  const res = await request(app.getHttpServer())
    .post('/api/login')
    .send({ correo: CORREO_PRUEBA, clave: CLAVE_PRUEBA })
    .expect(200);
  return String(res.headers['set-cookie'][0]).split(';')[0];
}
