import { createInterface, type Interface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';

export interface LectorClave {
  preguntar(etiqueta: string): Promise<string>;
  cerrar(): void;
}

/**
 * Lee claves sin mostrarlas. En una terminal el eco queda apagado; con entrada
 * entubada (`echo ... | npm run ...`) lee una línea por pregunta, sin eco.
 */
export function crearLectorClave(input: Readable & { isTTY?: boolean }, output: Writable): LectorClave {
  if (input.isTTY) return lectorDeTerminal(input, output);
  return lectorDeTuberia(input);
}

function lectorDeTerminal(input: Readable, output: Writable): LectorClave {
  let rl: Interface | null = null;
  return {
    preguntar(etiqueta: string): Promise<string> {
      return new Promise((resolve) => {
        output.write(etiqueta);
        rl = createInterface({ input, output, terminal: true });
        // readline echoes typed characters through this internal method; muting it hides the clave.
        const interno = rl as unknown as { _writeToOutput(texto: string): void };
        const escribir = interno._writeToOutput.bind(rl);
        interno._writeToOutput = () => undefined;
        rl.question('', (respuesta) => {
          interno._writeToOutput = escribir;
          output.write('\n');
          rl?.close();
          rl = null;
          resolve(respuesta);
        });
      });
    },
    cerrar(): void {
      rl?.close();
      rl = null;
    },
  };
}

function lectorDeTuberia(input: Readable): LectorClave {
  let rl: Interface | null = null;
  let lineas: AsyncIterableIterator<string> | null = null;
  return {
    async preguntar(): Promise<string> {
      rl ??= createInterface({ input, terminal: false });
      lineas ??= rl[Symbol.asyncIterator]();
      const { value, done } = await lineas.next();
      if (done) throw new Error('No se recibió la clave por la entrada estándar.');
      return value.replace(/\r$/, '');
    },
    cerrar(): void {
      rl?.close();
      rl = null;
    },
  };
}
