import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module.js';
import { DatabaseModule } from '../database/database.module.js';
import { UsuariosModule } from '../usuarios/usuarios.module.js';

/** Contexto mínimo para los comandos `users:*`: configuración, base de datos y cuentas. */
@Module({
  imports: [AppConfigModule, DatabaseModule, UsuariosModule],
})
export class CliModule {}
