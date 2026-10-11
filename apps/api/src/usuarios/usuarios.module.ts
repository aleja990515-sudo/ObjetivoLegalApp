import { Module } from '@nestjs/common';
import { PASSWORD_HASHER } from '../auth/application/ports/password-hasher.port.js';
import { ScryptPasswordHasher } from '../auth/infrastructure/crypto/scrypt-password-hasher.js';
import { APP_CONFIG } from '../config/app-config.provider.js';
import type { AppConfig } from '../config/app-config.js';
import { RegistroService } from './application/registro.service.js';
import { USUARIO_REPOSITORY } from './domain/usuario.repository.js';
import { RegistroController } from './infrastructure/http/registro.controller.js';
import { DATA_PROTECTOR, PersonalDataProtector } from './infrastructure/persistence/personal-data.protector.js';
import { TypeOrmUsuarioRepository } from './infrastructure/persistence/typeorm-usuario.repository.js';

@Module({
  controllers: [RegistroController],
  providers: [
    { provide: DATA_PROTECTOR, inject: [APP_CONFIG], useFactory: (config: AppConfig) => new PersonalDataProtector(config.dataEncryptionKey) },
    { provide: USUARIO_REPOSITORY, useClass: TypeOrmUsuarioRepository },
    { provide: PASSWORD_HASHER, useClass: ScryptPasswordHasher },
    RegistroService,
  ],
  exports: [USUARIO_REPOSITORY, PASSWORD_HASHER, DATA_PROTECTOR],
})
export class UsuariosModule {}
