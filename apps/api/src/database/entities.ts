import { PROCESOS_ENTITIES } from '../procesos/infrastructure/persistence/entities/index.js';
import { UsuarioEntity } from '../usuarios/infrastructure/persistence/usuario.entity.js';

// Registry of TypeORM entities shared by the Nest app, the CLI data source and
// the tests. Entities live only in each module's infrastructure layer.
export const ENTITIES: Function[] = [...PROCESOS_ENTITIES, UsuarioEntity];
