import { CODIGO_ERROR, CODIGO_OK, CODIGO_USO, DependenciasCli, ejecutarComando, OperacionesUsuarios } from './users-cli.js';

const CLAVE = 'clave-de-prueba-larga';

/** Operaciones falsas que registran lo que se les pide (sin base de datos). */
function fakes(overrides: Partial<OperacionesUsuarios> = {}) {
  const llamadas: unknown[][] = [];
  const operaciones: OperacionesUsuarios = {
    crear: vi.fn(async (entrada) => {
      llamadas.push(['crear', entrada]);
      return {};
    }),
    activar: vi.fn(async (correo, activo) => {
      llamadas.push(['activar', correo, activo]);
    }),
    cambiarClave: vi.fn(async (correo, clave) => {
      llamadas.push(['cambiarClave', correo, clave]);
    }),
    ...overrides,
  };
  return { operaciones, llamadas };
}

/** Respuestas de teclado en orden; cada pregunta de clave consume una. */
function teclado(...respuestas: string[]) {
  const preguntas: string[] = [];
  return {
    preguntas,
    preguntarClave: vi.fn(async (etiqueta: string) => {
      preguntas.push(etiqueta);
      const siguiente = respuestas.shift();
      if (siguiente === undefined) throw new Error('No se recibió la clave por la entrada estándar.');
      return siguiente;
    }),
  };
}

function deps(
  operaciones: OperacionesUsuarios,
  claves: ReturnType<typeof teclado>,
): DependenciasCli & { salida: string[]; errores: string[] } {
  const salida: string[] = [];
  const errores: string[] = [];
  return {
    operaciones,
    preguntarClave: claves.preguntarClave,
    escribir: (linea) => salida.push(linea),
    error: (linea) => errores.push(linea),
    salida,
    errores,
  };
}

describe('users:* command core', () => {
  it('creates an active account from the arguments and asks the password twice', async () => {
    const { operaciones, llamadas } = fakes();
    const claves = teclado(CLAVE, CLAVE);
    const d = deps(operaciones, claves);

    const codigo = await ejecutarComando(
      ['create', 'Prueba.Smoke@example.com', 'Prueba Smoke', '1000000000', '3000000000'],
      d,
    );

    expect(codigo).toBe(CODIGO_OK);
    expect(claves.preguntas).toHaveLength(2);
    expect(llamadas).toEqual([
      [
        'crear',
        {
          nombreCompleto: 'Prueba Smoke',
          cedula: '1000000000',
          correo: 'Prueba.Smoke@example.com',
          celular: '3000000000',
          clave: CLAVE,
        },
      ],
    ]);
    expect(d.salida.join('\n')).not.toContain(CLAVE);
  });

  it('refuses a short password before asking to repeat it', async () => {
    const { operaciones, llamadas } = fakes();
    const claves = teclado('corta');
    const d = deps(operaciones, claves);
    expect(await ejecutarComando(['password', 'ana@example.com'], d)).toBe(CODIGO_ERROR);
    expect(claves.preguntas).toHaveLength(1);
    expect(d.errores[0]).toMatch(/al menos 12 caracteres/);
    expect(llamadas).toEqual([]);
  });

  it('refuses when the two passwords differ and writes nothing', async () => {
    const { operaciones, llamadas } = fakes();
    const d = deps(operaciones, teclado(CLAVE, 'otra-clave-larga'));
    expect(await ejecutarComando(['password', 'ana@example.com'], d)).toBe(CODIGO_ERROR);
    expect(d.errores).toEqual(['Las claves no coinciden. No se guardó nada.']);
    expect(llamadas).toEqual([]);
  });

  it('changes the password of an account after two matching entries', async () => {
    const { operaciones, llamadas } = fakes();
    const d = deps(operaciones, teclado(CLAVE, CLAVE));
    expect(await ejecutarComando(['password', 'ana@example.com'], d)).toBe(CODIGO_OK);
    expect(llamadas).toEqual([['cambiarClave', 'ana@example.com', CLAVE]]);
  });

  it('activates and deactivates by correo without asking any password', async () => {
    const { operaciones, llamadas } = fakes();
    const claves = teclado();
    const d = deps(operaciones, claves);
    expect(await ejecutarComando(['activate', 'ana@example.com'], d)).toBe(CODIGO_OK);
    expect(await ejecutarComando(['deactivate', 'ana@example.com'], d)).toBe(CODIGO_OK);
    expect(llamadas).toEqual([
      ['activar', 'ana@example.com', true],
      ['activar', 'ana@example.com', false],
    ]);
    expect(claves.preguntas).toEqual([]);
  });

  it('reports a missing account as an error from the operations', async () => {
    const { operaciones } = fakes({
      activar: async () => {
        throw new Error('No existe una cuenta con ese correo.');
      },
    });
    const d = deps(operaciones, teclado());
    expect(await ejecutarComando(['activate', 'nadie@example.com'], d)).toBe(CODIGO_ERROR);
    expect(d.errores).toEqual(['No existe una cuenta con ese correo.']);
  });

  it('answers the usage text, with exit code 2, for unknown or incomplete commands', async () => {
    const { operaciones } = fakes();
    const d = deps(operaciones, teclado());
    expect(await ejecutarComando(['borrar'], d)).toBe(CODIGO_USO);
    expect(await ejecutarComando(['create', 'solo@example.com'], d)).toBe(CODIGO_USO);
    expect(await ejecutarComando(['activate'], d)).toBe(CODIGO_USO);
    expect(d.errores[0]).toMatch(/Uso/);
    expect(d.errores[0]).toMatch(/nunca va como argumento/);
  });
});
