import type { DataSource } from 'typeorm';
import { CuentaDuplicadaError } from '../../src/usuarios/domain/usuario.js';
import { PersonalDataProtector } from '../../src/usuarios/infrastructure/persistence/personal-data.protector.js';
import { TypeOrmUsuarioRepository } from '../../src/usuarios/infrastructure/persistence/typeorm-usuario.repository.js';
import { createTestDataSource, truncateAll } from '../support/test-database.js';

// Invented key for tests only (32 bytes of 0x07).
const CLAVE_DATOS = Buffer.alloc(32, 7).toString('base64');
const HASH = 'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAA';

describe('TypeOrmUsuarioRepository (e2e)', () => {
  let dataSource: DataSource;
  let protector: PersonalDataProtector;
  let repo: TypeOrmUsuarioRepository;

  beforeAll(async () => {
    dataSource = await createTestDataSource();
    protector = new PersonalDataProtector(CLAVE_DATOS);
    repo = new TypeOrmUsuarioRepository(dataSource, protector);
  });

  beforeEach(async () => {
    await truncateAll(dataSource);
  });

  afterAll(async () => {
    await dataSource.destroy();
  });

  const cuenta = (overrides: Partial<Parameters<TypeOrmUsuarioRepository['crear']>[0]> = {}) => ({
    nombre: 'Prueba Smoke',
    nombreCompleto: 'Prueba Smoke',
    correo: 'prueba@example.com',
    cedula: '1000000000',
    celular: '3000000000',
    passwordHash: HASH,
    activo: false,
    consentimientoAt: new Date('2026-10-10T12:00:00Z'),
    ...overrides,
  });

  it('creates an account, finds it by normalized correo and never stores plaintext personal data', async () => {
    const creado = await repo.crear(cuenta({ correo: 'prueba@example.com' }));
    expect(creado).toEqual({ id: expect.any(String), nombre: 'Prueba Smoke', activo: false });

    const encontrada = await repo.buscarPorCorreo('  PRUEBA@Example.com ');
    expect(encontrada).toEqual({ usuario: creado, passwordHash: HASH });

    const [fila] = await dataSource.query('SELECT * FROM usuarios');
    const textoFila = JSON.stringify(fila);
    expect(textoFila).not.toContain('prueba@example.com');
    expect(textoFila).not.toContain('1000000000');
    expect(textoFila).not.toContain('3000000000');
    expect(protector.descifrar(fila.correo_cifrado)).toBe('prueba@example.com');
    expect(protector.descifrar(fila.cedula_cifrada)).toBe('1000000000');
    expect(protector.descifrar(fila.celular_cifrado)).toBe('3000000000');
    expect(fila.consentimiento_at).not.toBeNull();
  });

  it('returns null for an unknown correo', async () => {
    expect(await repo.buscarPorCorreo('nadie@example.com')).toBeNull();
  });

  it('detects an existing cédula or correo and rejects duplicates with CuentaDuplicadaError', async () => {
    await repo.crear(cuenta());
    expect(await repo.existeCedulaOCorreo('1000000000', 'otro@example.com')).toBe(true);
    expect(await repo.existeCedulaOCorreo('2000000000', 'PRUEBA@example.com')).toBe(true);
    expect(await repo.existeCedulaOCorreo('2000000000', 'otro@example.com')).toBe(false);

    await expect(repo.crear(cuenta({ correo: 'otro@example.com' }))).rejects.toBeInstanceOf(CuentaDuplicadaError);
    await expect(repo.crear(cuenta({ correo: 'nuevo@example.com' }))).rejects.toBeInstanceOf(CuentaDuplicadaError);
  });

  it('activates, deactivates and changes the password of an existing account', async () => {
    await repo.crear(cuenta({ activo: false }));
    expect(await repo.actualizarActivo('prueba@example.com', true)).toBe(true);
    expect((await repo.buscarPorCorreo('prueba@example.com'))?.usuario.activo).toBe(true);
    expect(await repo.actualizarActivo('prueba@example.com', false)).toBe(true);
    expect((await repo.buscarPorCorreo('prueba@example.com'))?.usuario.activo).toBe(false);

    expect(await repo.actualizarClave('prueba@example.com', 'scrypt$nuevo')).toBe(true);
    expect((await repo.buscarPorCorreo('prueba@example.com'))?.passwordHash).toBe('scrypt$nuevo');
  });

  it('answers false when updating an unknown account', async () => {
    expect(await repo.actualizarActivo('nadie@example.com', true)).toBe(false);
    expect(await repo.actualizarClave('nadie@example.com', HASH)).toBe(false);
  });

  it('refuses personal-data work when DATA_ENCRYPTION_KEY is missing', async () => {
    const sinClave = new TypeOrmUsuarioRepository(dataSource, new PersonalDataProtector(null));
    await expect(sinClave.crear(cuenta())).rejects.toThrow(/DATA_ENCRYPTION_KEY/);
  });
});
