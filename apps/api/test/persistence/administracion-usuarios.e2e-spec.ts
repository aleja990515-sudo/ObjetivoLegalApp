import type { DataSource } from 'typeorm';
import { ScryptPasswordHasher } from '../../src/auth/infrastructure/crypto/scrypt-password-hasher.js';
import { AdministracionUsuarios, CUENTA_NO_ENCONTRADA, CUENTA_YA_EXISTE } from '../../src/usuarios/application/administracion-usuarios.service.js';
import { ErrorValidacion } from '../../src/usuarios/domain/registro.js';
import { PersonalDataProtector } from '../../src/usuarios/infrastructure/persistence/personal-data.protector.js';
import { TypeOrmUsuarioRepository } from '../../src/usuarios/infrastructure/persistence/typeorm-usuario.repository.js';
import { createTestDataSource, truncateAll } from '../support/test-database.js';

// Invented key and data for tests only.
const CLAVE_DATOS = Buffer.alloc(32, 7).toString('base64');
const CLAVE = 'clave-de-prueba-larga';
const NUEVA = {
  nombreCompleto: 'Prueba Smoke',
  cedula: '1000000000',
  correo: 'prueba.smoke@example.com',
  celular: '3000000000',
  clave: CLAVE,
};

describe('AdministracionUsuarios (e2e)', () => {
  let dataSource: DataSource;
  let admin: AdministracionUsuarios;
  let protector: PersonalDataProtector;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    protector = new PersonalDataProtector(CLAVE_DATOS);
    admin = new AdministracionUsuarios(new TypeOrmUsuarioRepository(dataSource, protector), new ScryptPasswordHasher());
  });

  beforeEach(async () => {
    await truncateAll(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  it('creates an active account without consent and stores only the hash of the clave', async () => {
    await admin.crear(NUEVA);
    const [fila] = await dataSource.query('SELECT * FROM usuarios');
    expect(fila.activo).toBe(true);
    expect(fila.consentimiento_at).toBeNull();
    expect(fila.password_hash).not.toContain(CLAVE);
    expect(JSON.stringify(fila)).not.toContain('prueba.smoke@example.com');
    expect(protector.descifrar(fila.cedula_cifrada)).toBe('1000000000');
    expect(protector.descifrar(fila.celular_cifrado)).toBe('3000000000');
  });

  it('rejects a second account with the same cédula or correo', async () => {
    await admin.crear(NUEVA);
    await expect(admin.crear({ ...NUEVA, correo: 'otro@example.com' })).rejects.toThrow(CUENTA_YA_EXISTE);
    await expect(admin.crear({ ...NUEVA, cedula: '2000000000' })).rejects.toThrow(CUENTA_YA_EXISTE);
  });

  it('validates the data and the clave before writing', async () => {
    await expect(admin.crear({ ...NUEVA, clave: 'corta' })).rejects.toThrow(ErrorValidacion);
    await expect(admin.crear({ ...NUEVA, celular: '2000000000' })).rejects.toThrow(/celular/);
    expect(await dataSource.query('SELECT count(*)::int AS n FROM usuarios')).toEqual([{ n: 0 }]);
  });

  it('activates and deactivates an account by correo, and reports unknown ones', async () => {
    await admin.crear(NUEVA);
    await admin.activar('Prueba.Smoke@example.com', false);
    const [inactiva] = await dataSource.query('SELECT activo FROM usuarios');
    expect(inactiva.activo).toBe(false);
    await admin.activar(NUEVA.correo, true);
    await expect(admin.activar('nadie@example.com', true)).rejects.toThrow(CUENTA_NO_ENCONTRADA);
  });

  it('changes the clave with a new hash and refuses short ones', async () => {
    await admin.crear(NUEVA);
    const [antes] = await dataSource.query('SELECT password_hash FROM usuarios');
    await admin.cambiarClave(NUEVA.correo, 'otra-clave-larga-123');
    const [despues] = await dataSource.query('SELECT password_hash FROM usuarios');
    expect(despues.password_hash).not.toBe(antes.password_hash);
    await expect(admin.cambiarClave(NUEVA.correo, 'corta')).rejects.toThrow(ErrorValidacion);
    await expect(admin.cambiarClave('nadie@example.com', CLAVE)).rejects.toThrow(CUENTA_NO_ENCONTRADA);
  });
});
