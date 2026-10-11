# Mis Procesos · Interfaz web (Next.js)

Interfaz de la app de seguimiento de procesos judiciales, construida con Next.js 16 (App Router), React y TypeScript. Consume la API NestJS de `apps/api` sin cambios de contrato.

El navegador solo habla con Next. Las peticiones a `/api/*` se reenvían a la API mediante `rewrites()` en `next.config.ts`, así la cookie de sesión `sesion` es de primera parte y no hay CORS.

## Requisitos

- Node 26.11.1 (fijado en `.mise.toml`; con mise: `mise install`).
- Dependencias instaladas desde la raíz del repositorio: `npm install`.
- La base de datos PostgreSQL de la API (ver el README de la raíz).

## Cómo ejecutar

En dos terminales, desde la raíz del repositorio y en este orden:

```bash
npm run dev:api   # 1. API NestJS en http://localhost:3000
npm run dev:web   # 2. Interfaz Next.js en http://localhost:3001
```

Abre **http://localhost:3001**. Las peticiones a `/api` pasan por Next hacia la API. Durante el desarrollo, la API en el puerto 3000 sigue sirviendo la interfaz anterior en `public/`; esa interfaz se retirará cuando se decida el corte.

Para probar la compilación de producción: `npm run build:web` y luego `npm run start:web` (también en el puerto 3001).

## Variables de entorno

| Variable     | Por defecto             | Uso                                                              |
| ------------ | ----------------------- | ---------------------------------------------------------------- |
| `API_ORIGIN` | `http://localhost:3000` | Origen de la API al que Next reenvía `/api/*`. Solo servidor.    |

Apunta `API_ORIGIN` a otra dirección si la API corre en otra máquina o puerto. No se fija ninguna clave en este paquete: la contraseña de la oficina y las credenciales viven en la API.

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

## Vistas

- **Procesos** (`/`): lista con búsqueda, filtro por responsable, "Solo con novedades" y alta por radicado.
- **Detalle** (`/procesos/[id]`): datos de la Rama, alias, responsable y etiquetas, revisado, actualizar, notas, agenda del proceso, sujetos y actuaciones con documentos bajo demanda.
- **Novedades** (`/novedades`): actuaciones sin revisar y nuevas instancias.
- **Agenda** (`/agenda`): actividades de todos los procesos y enlaces de suscripción al calendario.
- **Ingreso** (`/login`) y **registro** (`/registro`): sin barra lateral. Las demás rutas comprueban la sesión con `/api/yo`.

## Iconos

Iconos [Phosphor](https://phosphoricons.com) de la familia regular, desde `@phosphor-icons/react`. Cada icono es decorativo (`aria-hidden`); el nombre accesible viene del texto visible o de `aria-label` en los botones sin texto.

## Pruebas

```bash
npm run test:web        # Vitest + Testing Library + axe-core + contraste de tokens
npm run typecheck:web
npm run lint:web
```

Las pruebas de accesibilidad recorren cada vista con axe-core (sin las reglas de página completa ni de contraste, que se miden aparte) y comprueban el contraste WCAG AA de los tokens de `globals.css` en modo claro y oscuro.

## Estructura

- `src/app/`: rutas. `(auth)/login` y `(auth)/registro` sin barra lateral; `(app)/` con el guard de sesión y el shell.
- `src/app/globals.css`: tokens de diseño (fuente única: colores, radios, tipografía) mapeados a Tailwind v4 (`@theme inline`) y a las variables de shadcn/ui. Modo oscuro según `prefers-color-scheme`.
- `src/components/`: shell (`app-shell`, `sidebar`), `page-header`, estados (`estado`), diálogo de confirmación (`dialogo`) y `ui/` (componentes de shadcn/ui, estilo `base-vega`; se añaden con `npx shadcn@latest add <componente>`).
- `src/features/`: una carpeta por área. `procesos/` (lista, filtros, formato, modelo de la API), `novedades/`, `detalle/` (cabecera, tareas, notas, actuaciones), `agenda/`, `login/`, `registro/`, `session/`, `shell/`.
- `src/lib/api.ts`: único punto de llamada a la API (`apiFetch`), con `ApiError` y el mensaje del servidor.
- `src/testing/`: pruebas transversales de accesibilidad y contraste.
- `src/fonts/`: fuentes Geist y Geist Mono en woff2 con licencia OFL.
- `public/`: favicon e icono de la app.
