# Mis Procesos · Interfaz web (Next.js)

Interfaz de la app de seguimiento de procesos judiciales, construida con Next.js 16 (App Router), React y TypeScript. Consume la API NestJS de `apps/api` sin cambios de contrato.

El navegador solo habla con Next. Las peticiones a `/api/*` se reenvían a la API mediante `rewrites()` en `next.config.ts`, así la cookie de sesión `sesion` es de primera parte y no hay CORS.

## Requisitos

- Node 26.11.1 (fijado en `.mise.toml`; con mise: `mise install`).
- Dependencias instaladas desde la raíz del repositorio: `npm install`.

## Cómo ejecutar

En dos terminales, desde la raíz del repositorio:

```bash
npm run dev:api   # API NestJS en http://localhost:3000
npm run dev:web   # Interfaz Next.js en http://localhost:3001
```

Abre http://localhost:3001. Las peticiones a `/api` pasan por Next hacia la API.

## Variables de entorno

| Variable      | Por defecto               | Uso                                                        |
| ------------- | ------------------------- | ---------------------------------------------------------- |
| `API_ORIGIN`  | `http://localhost:3000`   | Origen de la API al que Next reenvía `/api/*`. Solo servidor. |

No se fija ninguna clave en este paquete. La contraseña de la oficina y las credenciales viven en la API.

## Scripts

Desde la raíz (`npm run <script>`):

| Script          | Qué hace                                      |
| --------------- | --------------------------------------------- |
| `dev:web`       | Servidor de desarrollo en el puerto 3001      |
| `build:web`     | Compilación de producción                     |
| `start:web`     | Sirve la compilación en el puerto 3001        |
| `lint:web`      | Lint con oxlint (`src/`)                      |
| `typecheck:web` | Comprobación de tipos con TypeScript          |
| `test:web`      | Pruebas con Vitest y Testing Library          |

## Estructura

- `src/app/layout.tsx`: raíz HTML, fuentes Geist y Geist Mono (`next/font/local`).
- `src/app/globals.css`: tokens de diseño (fuente única: colores, radios, tipografía) mapeados a Tailwind v4 (`@theme inline`) y a las variables de shadcn/ui. Modo oscuro según `prefers-color-scheme`.
- `src/components/ui/`: componentes de shadcn/ui (estilo `base-vega`, neutro, variables CSS). Se añaden con `npx shadcn@latest add <componente>`.
- `src/fonts/`: fuentes variables en formato woff2 y licencia OFL.
- `public/`: iconos Phosphor vendidos (`icons.svg`) y favicon.
