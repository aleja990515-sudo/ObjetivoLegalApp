import { InitialSchema1791590400000 } from './1791590400000-initial-schema.js';
import { AutosPublicados1791763200000 } from './1791763200000-autos-publicados.js';
import { Usuarios1791676800000 } from './1791676800000-usuarios.js';
import { ProcesosUsuario1791849600000 } from './1791849600000-procesos-usuario.js';
import { ProcesosIdSurrogado1791936000000 } from './1791936000000-procesos-id-surrogado.js';

// Ordered list of migrations. Classes are imported explicitly (no glob) so the
// same list works from TypeScript sources (tests) and compiled output (CLI).
export const MIGRATIONS: Function[] = [
  InitialSchema1791590400000,
  Usuarios1791676800000,
  AutosPublicados1791763200000,
  ProcesosUsuario1791849600000,
  ProcesosIdSurrogado1791936000000,
];
