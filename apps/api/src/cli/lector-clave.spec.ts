import { PassThrough } from 'node:stream';
import { crearLectorClave } from './lector-clave.js';

describe('crearLectorClave (entrada entubada)', () => {
  it('reads one line per question, without echo, and strips the carriage return', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    let eco = '';
    output.on('data', (trozo: Buffer) => (eco += trozo.toString()));
    const lector = crearLectorClave(Object.assign(input, { isTTY: false }), output);

    input.end('primera-clave-larga\r\nsegunda-clave-larga\n');
    expect(await lector.preguntar('Clave: ')).toBe('primera-clave-larga');
    expect(await lector.preguntar('Repite: ')).toBe('segunda-clave-larga');
    lector.cerrar();
    expect(eco).toBe('');
  });

  it('fails clearly when the pipe ends before the password', async () => {
    const input = new PassThrough();
    const lector = crearLectorClave(Object.assign(input, { isTTY: false }), new PassThrough());
    input.end('');
    await expect(lector.preguntar('Clave: ')).rejects.toThrow(/No se recibió la clave/);
    lector.cerrar();
  });
});
