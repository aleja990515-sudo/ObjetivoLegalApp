import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createTestApp } from './support/test-app.js';
import { truncateAll } from './support/test-database.js';

const NUEVO = {
  nombreCompleto: 'Prueba Smoke',
  cedula: '1000000000',
  correo: 'Prueba.Smoke@Example.com',
  celular: '3001234567',
  clave: 'clave-de-prueba-larga',
  consentimiento: true,
};

describe('Registro (e2e)', () => {
  let app: NestExpressApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    app = await createTestApp({ sleep: async () => undefined });
    dataSource = app.get(DataSource);
  });

  beforeEach(async () => {
    await truncateAll(dataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  const registro = (body: Record<string, unknown>) => request(app.getHttpServer()).post('/api/registro').send(body);

  it('creates an inactive account with the consent timestamp and a generic 201 message', async () => {
    const res = await registro(NUEVO).expect(201);
    expect(res.body).toEqual({ mensaje: 'Recibimos tu registro; la oficina lo activará.' });

    const [fila] = await dataSource.query('SELECT activo, consentimiento_at, password_hash FROM usuarios');
    expect(fila.activo).toBe(false);
    expect(fila.consentimiento_at).not.toBeNull();
    expect(fila.password_hash).toMatch(/^scrypt\$32768\$8\$1\$/);
    expect(fila.password_hash).not.toContain(NUEVO.clave);
  });

  it('does not let an inactive account log in', async () => {
    await registro(NUEVO).expect(201);
    const res = await request(app.getHttpServer())
      .post('/api/login')
      .send({ correo: 'prueba.smoke@example.com', clave: NUEVO.clave })
      .expect(401);
    expect(res.body).toEqual({ error: 'Correo o clave incorrectos.' });
  });

  it('answers 409 with a generic message when the cédula or the correo already exists', async () => {
    await registro(NUEVO).expect(201);
    const porCedula = await registro({ ...NUEVO, correo: 'otro@example.com' }).expect(409);
    const porCorreo = await registro({ ...NUEVO, cedula: '2000000000' }).expect(409);
    expect(porCedula.body).toEqual(porCorreo.body);
    expect(porCedula.body.error).not.toMatch(/cédula|correo ya/i);
  });

  it('requires the consent checkbox', async () => {
    const res = await registro({ ...NUEVO, consentimiento: false }).expect(400);
    expect(res.body.error).toMatch(/tratamiento de tus datos/);
  });

  it('answers 400 with the validation messages', async () => {
    const res = await registro({ ...NUEVO, celular: '2001234567', clave: 'corta' }).expect(400);
    expect(res.body.error).toMatch(/celular/);
    expect(res.body.error).toMatch(/al menos 12/);
  });
});
