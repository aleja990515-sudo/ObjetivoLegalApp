import { InitialSchema1791590400000 } from './1791590400000-initial-schema.js';
import { Usuarios1791676800000 } from './1791676800000-usuarios.js';

// Ordered list of migrations. Classes are imported explicitly (no glob) so the
// same list works from TypeScript sources (tests) and compiled output (CLI).
export const MIGRATIONS: Function[] = [InitialSchema1791590400000, Usuarios1791676800000];
