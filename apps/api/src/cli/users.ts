import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AdministracionUsuarios } from '../usuarios/application/administracion-usuarios.service.js';
import { crearLectorClave } from './lector-clave.js';
import { CODIGO_ERROR, ejecutarComando } from './users-cli.js';
import { CliModule } from './cli.module.js';

/** Entrada de `users:*`. El subcomando llega como primer argumento desde los scripts de package.json. */
async function main(): Promise<number> {
  const app = await NestFactory.createApplicationContext(CliModule, { logger: ['error', 'warn'] });
  const lector = crearLectorClave(process.stdin, process.stdout);
  try {
    return await ejecutarComando(process.argv.slice(2), {
      operaciones: app.get(AdministracionUsuarios),
      preguntarClave: (etiqueta) => lector.preguntar(etiqueta),
      escribir: (linea) => console.log(linea),
      error: (linea) => console.error(linea),
    });
  } finally {
    lector.cerrar();
    await app.close();
  }
}

main().then(
  (codigo) => {
    process.exitCode = codigo;
  },
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = CODIGO_ERROR;
  },
);
