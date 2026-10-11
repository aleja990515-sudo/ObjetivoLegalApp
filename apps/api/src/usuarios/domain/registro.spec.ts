import { ErrorValidacion, validarDatosCuenta, validarRegistro } from './registro.js';

const valido = {
  nombreCompleto: '  Prueba   Smoke ',
  cedula: '1000000000',
  correo: ' Prueba@Example.COM ',
  celular: '3001234567',
  clave: 'clave-de-prueba-larga',
  consentimiento: true,
};

describe('validarRegistro', () => {
  it('normalizes the data: trimmed name, single spaces, lowercase correo', () => {
    expect(validarRegistro(valido)).toEqual({
      nombreCompleto: 'Prueba Smoke',
      cedula: '1000000000',
      correo: 'prueba@example.com',
      celular: '3001234567',
      clave: 'clave-de-prueba-larga',
      consentimiento: true,
    });
  });

  it('requires the consent checkbox', () => {
    expect(() => validarRegistro({ ...valido, consentimiento: false })).toThrow(ErrorValidacion);
    expect(() => validarRegistro({ ...valido, consentimiento: 'si' })).toThrow(/tratamiento de tus datos/);
  });

  it.each<[string, Record<string, unknown>, RegExp]>([
    ['nombreCompleto', { nombreCompleto: 'A' }, /nombre completo/],
    ['cedula with letters', { cedula: '10000abc00' }, /cédula/],
    ['cedula too short', { cedula: '12345' }, /cédula/],
    ['correo without domain', { correo: 'ana@localhost' }, /correo/],
    ['celular not starting with 3', { celular: '2001234567' }, /celular/],
    ['celular with 9 digits', { celular: '300123456' }, /celular/],
    ['clave under 12 characters', { clave: 'corta-clave' }, /al menos 12/],
  ])('rejects %s', (_case, cambio, _mensaje) => {
    expect(() => validarRegistro({ ...valido, ...cambio })).toThrow(ErrorValidacion);
  });

  it('reports every problem in one message', () => {
    expect(() => validarRegistro({ consentimiento: true })).toThrow(
      /nombre completo.*cédula.*correo.*celular.*clave/s,
    );
  });

  it('accepts a non-object input as all fields missing', () => {
    expect(() => validarRegistro(null)).toThrow(ErrorValidacion);
    expect(() => validarRegistro('texto')).toThrow(ErrorValidacion);
  });
});

describe('validarDatosCuenta', () => {
  it('does not require the consent (operator-created accounts)', () => {
    expect(validarDatosCuenta({ ...valido, consentimiento: undefined })).toMatchObject({ correo: 'prueba@example.com' });
  });
});
