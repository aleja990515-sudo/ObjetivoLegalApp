import { InitialSchema1791590400000 } from './1791590400000-initial-schema.js';
import { AutosPublicados1791763200000 } from './1791763200000-autos-publicados.js';
import { ProcesosPrivados1791936000000 } from './1791936000000-procesos-privados.js';
import { EstadosProceso1792118400000 } from './1792118400000-estados-proceso.js';
import { Usuarios1791676800000 } from './1791676800000-usuarios.js';
import { ProcesosUsuario1792204800000 } from './1792204800000-procesos-usuario.js';
import { ProcesosIdSurrogado1792291200000 } from './1792291200000-procesos-id-surrogado.js';

// Ordered list of migrations. Classes are imported explicitly (no glob) so the
// same list works from TypeScript sources (tests) and compiled output (CLI).
export const MIGRATIONS: Function[] = [
  InitialSchema1791590400000,
  Usuarios1791676800000,
  AutosPublicados1791763200000,
  ProcesosPrivados1791936000000,
  EstadosProceso1792118400000,
  ProcesosUsuario1792204800000,
  ProcesosIdSurrogado1792291200000,
];
