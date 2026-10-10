import { fileURLToPath } from 'node:url';

// This file lives at `src/app.paths.ts` and compiles to `dist/app.paths.js`:
// both sit one level below `apps/api`, so the repository root is three levels up.
export const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

export const DEFAULT_PUBLIC_DIR = fileURLToPath(new URL('../../../public', import.meta.url));
