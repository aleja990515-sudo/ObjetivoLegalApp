# Alineación y consistencia visual del frontend (`apps/web`)

## Objective

Eliminate every concrete alignment, spacing, radius, touch-target and token-coherence defect across the 8 views and 6 UI primitives, by centralizing the patterns that already drifted instead of patching each call site.

## Problem

The app works, and its design system is sound (single emerald accent on cold zinc neutrals, Geist + Geist Mono via `next/font`, full dark-mode token set, global `prefers-reduced-motion` block, skip link, `:focus-visible`, `min-h-dvh`). The problem is not the aesthetic. The problem is that the patterns built on top of that system have drifted apart from it and from each other:

- `app-shell.tsx` hardcodes `h-[60px]`, `ml-[72px]`, `ml-[240px]`, `pb-[calc(4rem+…)]` that duplicate `--top-h`, `--rail-w`, `--sidebar-w`, `--tabbar-h`. Changing a token does not move the shell.
- 10 "repeated patterns" duplicate markup across ~40 sites, and two of them have already drifted (`p-4` vs `p-3.5` for the same list-row card; `rounded-4xl` vs `rounded-pill` for the same pill).
- 6 tokens are declared and never used (`--fs-xs/sm/lg/xl`, `--dur`, `--ease`, `--accent-hover`, `--placeholder`), so the declared type and motion scales are fiction.
- 10 layout breaks that visibly misrender (misaligned form rows, grid tracks blown out by unbroken radicado strings, 1px tabbar overflow, invisible group boundaries in the agenda).
- 7 touch targets under 44px.

## Why

This is a legal case tracker. A missed deadline is a professional failure. Every defect above either wastes the operator's scanning time, breaks on a real radicado string, or makes the app look unfinished in front of paying clients. The user explicitly asked for all of it: there are design errors throughout the app, things badly aligned.

**Explicitly rejected:** applying `high-end-visual-design` §3/§4 (bento grids, `py-24` sections, Double-Bezel on every card, rotated Z-Axis rows). That skill is a marketing/agency brief and applying it would *create* the misalignment this task exists to remove. Only its §2 anti-pattern rules are applied: tint the dark-mode shadow off pure black, standardize Phosphor to a lighter weight, add tactile `:active` feedback.

## Scope

In scope: `apps/web/src` only.

Out of scope: `apps/api` (frozen contract), visual redesign, new features, copy changes, Spanish UI strings, routing, form field names.

## Constraints

- Identifiers and UI copy stay Spanish; code identifiers stay English.
- No new dependencies. Tailwind v4 + shadcn/ui + Phosphor only.
- WCAG AA contrast preserved; the existing axe-core suite must keep passing.
- `prefers-reduced-motion` must keep working.
- Spanish copy must contain no em/en dashes.

## Tasks

### WU-1 — Foundation: tokens and primitives (no view changes)
- [x] T1.1 Map the 6 dead tokens in `@theme inline` so the declared scale is real, or delete them if unused after mapping.
- [x] T1.2 Dark-mode `--shadow` is `rgb(0 0 0 / …)` (pure black). Tint it to the surface hue, matching light mode's `rgb(24 24 27 / …)`.
- [x] T1.3 `ui/card.tsx` uses `rounded-xl` (16px), violating the documented "superficies 12px" rule. Every other surface is `rounded-lg`. Fix.
- [x] T1.4 `ui/badge.tsx` uses `rounded-4xl` to fake a pill. Use the real `rounded-pill` token.
- [x] T1.5 `ui/input.tsx` sets `placeholder:text-muted-foreground`, which wins on layer order, so the contrast-tested `--placeholder` token never renders. Fix, and bake `min-h-11 sm:h-9` so the 8 per-call mobile-height overrides disappear.
- [x] T1.6 Add the 5 shared components the audit proved are duplicated: `Tarjeta`, `Marca`, `TituloSeccion`, `Casilla`, `FilaEnlazada`.

Correcciones al plan tras verificar contra Tailwind 4.3.3:

- Tailwind no resuelve el utilidad `duration-*` contra `--duration-*` sino contra `--transition-duration-*` (verificado compilando `globals.css` con `@tailwindcss/postcss`: `--duration-ui` no genera nada, `--transition-duration-ui` sí). El token quedó como `--transition-duration-ui` → `duration-ui`. `--ease-ui`, `--text-xs/sm/lg/xl` y `--color-accent-hover` compilan como se pidió.
- `text-xl` pasa a 1.375rem (`--fs-xl`). Afecta a los `<h1>` de `page-header`, `login/page` y `registro/page`: es el efecto buscado (hacer real la escala declarada), pero es un cambio visible en vistas.
- `Card` perdió `shadow-xs ring-1 ring-foreground/10`. Las dos tarjetas de login y registro quedan hoy sin borde (solo `shadow-[var(--shadow)]`); **T2.1 debe añadirles `border border-line`** para igualarlas al resto.
- `Input` lleva `min-h-11 sm:h-9`. En CSS `min-height` gana a `height`, así que hasta que T2.1 quite los `min-h-11` por llamada, los campos seguirán midiendo 44px en escritorio. Si se quiere el colapso a 36px, hace falta `sm:min-h-9`.
- `agenda.tsx:114` (título de grupo, `text-sm` muted, sin icono) no entra en `TituloSeccion`: es otro patrón, no una desviación del mismo.

### WU-2 — Migrate call sites and fix the layout breaks
- [x] T2.1 Migrate the call sites onto the WU-1 components; unify list-row padding to `p-4`.
- [x] T2.2 Fix the layout breaks (S1): misaligned `agregar-radicado` grid, `cabecera-proceso` grid tracks without `min-w-0`, agenda radicado overflow, `tareas.tsx` overflowing row, `vista-lista` 3-column grid activating at 640px while the 72px rail is also active, `actuaciones` 3px border shifting rows, `session-guard` stray `p-7`, double-counted `mt-*` gaps in `estado`/`confirmar-dialog`, agenda group boundaries, `items-start` badge baseline, `scrollIntoView` under the sticky header.
- [x] T2.3 Fix the touch targets under 44px (S4).
- [x] T2.4 Add elevation to the sticky mobile header and tabbar, which currently let content show through; correct the 1px tabbar overflow (`--tabbar-h` vs actual 65px).
- [x] T2.5 Standardize the breakpoint vocabulary on `min-[640px]` / `min-[960px]` only.
- [x] T2.6 Verify the low-confidence findings (S7) and fix what is real.
- [x] T2.7 Token discipline in the shell: `--top-h`, `--rail-w`, `--sidebar-w` and `--tabbar-h` replace the hardcoded 60/72/240px and 4rem/5rem.
- [x] T2.8 Standardize the Phosphor family on one explicit `weight`.

Correcciones al plan tras verificar contra el codigo:

- `Tarjeta` renderiza un `<div>`. Los 13 `<div>` migrados quedaron en `Tarjeta`, pero quedan 6 superficies con las clases literales porque **no son `<div>`**: `<form>` (`agregar-radicado`, `cabecera-proceso` x2, `notas`, `tareas`), `<li>` (`novedades`, `notas`, `tareas`, `actuaciones`, `agenda`) y `AlertDialog.Popup` (`confirmar-dialog`). Sustituirlas por un `<div>` romperia el envio del formulario o la semantica de lista. La solucion real es hacer `Tarjeta` polimorfica, lo cual cae en carpeta congelada.
- `campoBase` **no se puede hacer compartido** con la superficie permitida: los tres consumidores (base de `Input`, `<select>` de `vista-lista`, `<textarea>` de `notas`) solo comparten hogar en `components/ui/input.tsx` (congelado en WU-1) o en `lib/utils.ts` (fuera de la superficie autorizada). Se corrigio localmente el defecto real: el `<select>` recibe `min-h-11 … text-base min-[640px]:min-h-9 min-[640px]:text-sm`, que es lo que evita el zoom de iOS.
- La aritmetica del hallazgo de "limites de grupo invisibles en la agenda" era incorrecta: `section.gap-2` + `ul.gap-2` bajo un padre `gap-4` da **16px** entre grupos frente a 8px entre tarjetas, no 4px. El diagnostico (2x no basta) se mantiene; se subio el padre a `gap-8` para que el limite de grupo sea 4x la separacion entre tarjetas y el ritmo tenga un solo valor.
- El ritmo de secciones quedo definido como **32px entre bloques hermanos y 24px bajo el encabezado de pagina** (el `mb-6` de `PageHeader`). Por eso `vista-detalle` paso de `gap-9` a `gap-8`, `vista-lista` de `mt-5`/`mt-4` a `mt-8`/`mt-8`, y `vista-novedades` no cambio: tiene un solo bloque, luego el margen del encabezado ya es la separacion.
- `TituloSeccion` no acepta `className`, asi que `scroll-mt-[var(--top-h)]` no pudo ir en `#titulo-tareas`. Se puso en un envoltorio `#seccion-tareas` (`tareas.tsx`) y `scrollIntoView` apunta ahi. Defecto real de `titulo-seccion/titulo.tsx` (carpeta congelada), reportado sin editar.
- El desbordamiento de 1px de la barra inferior se corrigio **sin tocar `--tabbar-h`**: el alto del `<aside>` sale del token (`h-[calc(var(--tabbar-h)+env(safe-area-inset-bottom))]`) y el relleno del navegador `flex-1` estira los enlaces, de modo que el relleno ya no participa en la suma. El `pb-[calc(0.375rem+…)]` disappears en favor de `pb-[env(safe-area-inset-bottom)]`, con `min-[640px]:h-auto` para que el riel siga estirandose.
- El ultimo hallazgo de T2.6/S7 ("micro-etiquetas `uppercase tracking` sobre los encabezados") **no existe**: `rg 'uppercase|tracking-wider'` sobre `apps/web/src` no devuelve nada. Hallazgo vacio.
- La premisa de T2.8 era falsa: la app **no** esta en tipografia ligera, usa `font-medium`. Se eligio `weight="regular"` explicito en los 12 archivos que importan Phosphor, porque es el peso optico de UI de la familia y el que acompana a `font-medium`/`text-sm`; `light` se apagaria en los iconos de 14px. No hay cambio visual, si una voz declarada. Nota: `titulo-seccion/titulo.tsx` (congelado) sigue sin pasar `weight`, asi que su icono resuelve a `regular` por defecto: no hay mezcla, pero la unica excepcion queda implicita.
- `PageHeader.accion` se **elimino**, no se uso. Ninguno de los cuatro llamadores tiene una accion de encabezado: la unica accion primaria (alta por radicado) es un bloque debajo del encabezado, no al lado del titulo. Mantener la prop era flexibilidad especulativa.
- El `<h1>` repetido 4 veces se unifico en `CLASE_TITULO`, exportada desde `components/page-header/page-header.tsx` (no crea archivos nuevos ni cruza capas). Los dos enlaces de retroceso se extrajeron a `features/detalle/enlace-volver.tsx`.
- `components/ui/input.tsx` (congelado) conserva `sm:min-h-9` y `md:text-sm`, es decir 640/768, fuera del vocabulario `min-[640px]`/`min-[960px]`. Es el unico resto ambiguo del remapeo y no se puede tocar desde WU-2.
- Objetivos tactiles aun bajo 44px, fuera de la lista de T2.3: los 3 botones de la tarjeta de suscripcion de la agenda (`h-9`, 36px), el conmutador de `tareas.tsx` y su boton "Quitar vinculo" (`size="sm"`, 32px). Son una clase cada uno; quedan fuera porque no estaban en el encargo.
- Defectos encontrados en carpetas congeladas (reportados, no editados): `titulo-seccion/titulo.tsx` sin `className`; `casilla/casilla.tsx` cuyo modo sin etiqueta no aporta objetivo tactil de 44px (el padre debe darlo, y en agenda/tareas el padre mide 36px); `ui/input.tsx` con el vocabulario de breakpoints viejo; `ui/card.tsx` sin borde desde WU-1, compensado hoy solo con `border-line` en login y registro.

## Authorized scope

Only the paths listed under "Allowed edit surfaces" in the WU delegation prompts. One writer at a time.

## Acceptance criteria

- `npm run lint:web`, `npm run typecheck:web`, `npm run test:web`, `npm run build:web` all pass.
- The axe-core accessibility suite still passes.
- Zero hardcoded duplicates of `--top-h`, `--rail-w`, `--sidebar-w`, `--tabbar-h` in any component.
- Every card surface is `rounded-lg`; every control is `rounded-md`; every pill is `rounded-pill`.
- No interactive element under 44px on the mobile touch range.

## Applicable checks

```
npm run lint:web
npm run typecheck:web
npm run test:web
npm run build:web
```

## Delivery

- Branch: `fix/alineacion-frontend` (branch off main before the first source write).
- Work-unit commits: one commit per WU, Conventional Commits, tests and docs alongside behavior.
- Estimated authored changed lines: 450-650 (over the ~400 review budget). Push, PR creation and merge remain the user's decisions under ordinary repository policy.
- RDD is `off` (global). No native review ceremony. Parent runs `gentle-ai review assess` over the final diff and applies the tier table.

## Route declaration

| Task | Route | Trigger evidence |
|---|---|---|
| Audit | delegated read-only explorer | 20+ files to read; exceeds the inline 3-call / 10k-token evidence budget |
| WU-1 | delegated writer | 9 files, 6 of them non-trivial new components — writer trigger |
| WU-2 | delegated writer | 20+ files to migrate and fix — writer trigger |

## Progress

- [x] Audit completed. 60 findings, 10 repeated patterns.
- [x] WU-1 complete (foundation only; no view file touched). Verified: `lint:web`, `typecheck:web`, `test:web` green (12 files, 36 tests, same as before the change). New Tailwind utilities confirmed by compiling `globals.css` with `@tailwindcss/postcss`.
- [x] WU-2 complete (T2.0 a T2.8). Verified: `lint:web`, `typecheck:web`, `test:web` (12 files, 36 tests), `build:web` green. Los 13 `<div>` de tarjeta migrados a `Tarjeta`, 5 a `Tarjeta variante="vacio"`, 4 listas con `p-4`, 4 lockups a `Marca`, 5 encabezados a `TituloSeccion`, 5 casillas a `Casilla`, 2 filas estiradas a `FilaEnlazada`. Las utilidades nuevas se confirmaron en el CSS de produccion (`scroll-mt-[var(--top-h)]`, `shadow-[inset_3px_0_0_var(--accent)]`, `min-[640px]:min-h-11`, `active:scale-[0.98]`, `line-clamp-2`, `h-[calc(var(--tabbar-h)+…)]`).

## WU-3 — Defectos hallados por la verificación independiente

Una verificación de solo lectura revisó el diff completo tras WU-2. Siete defectos reales, ninguno visto por el autor:

1. **Objetivos táctiles bajo 44px, no reportados.** `cabecera-proceso.tsx:124-140` (cuatro acciones primarias en `h-9`), `confirmar-dialog.tsx:36,40` (Cancelar / confirmar en 36px), `tareas.tsx:100,141`, `notas.tsx:64`, `enlace-volver.tsx:17`. Corrección: `min-h-11 min-[640px]:min-h-9` en cada uno.
2. **La variante sin etiqueta de `<Casilla>` no tiene objetivo de 44px.** `casilla.tsx:16` devuelve solo la caja `size-5` cuando no recibe children, y `tareas.tsx:167` / `vista-agenda.tsx:148` la renderizan dentro de un `<li>` que no es `<label>` ni es pulsable. La suposición del autor de que el padre daba el objetivo es falsa.
3. **`Tarjeta` olvidada.** `vista-lista.tsx:108` es un `<div>` plano con exactamente las clases de `Tarjeta variante="vacio"` y quedó sin migrar.
4. **Token muerto nuevo.** `globals.css:112-113` mapea `duration-ui` / `ease-ui`, pero nada los consume: `sidebar.tsx:85` y `confirmar-dialog.tsx:31-32` siguen escribiendo `duration-150` literal. T1.1 mapeó los tokens y WU-2 nunca los usó, recreando el defecto que T1.1 existía para eliminar.
5. **`notas.tsx:61`** el `<textarea>` sigue con `placeholder:text-muted-foreground`, contradiciendo T1.5.
6. **Fuga del vocabulario de breakpoints.** `sidebar.tsx:58,89,121,129` usan `max-[959px]`, que T2.5 prohíbe.
7. **Altura inconsistente en escritorio.** `login-form.tsx:61` y `registro-form.tsx:162` mantienen botones de 44px mientras cualquier input vecino colapsa a 36px desde 640px.

## Correcciones a la auditoría original

Quedan registradas porque la auditoría es el artefacto reutilizable y dos afirmaciones suyas eran falsas:

- **El hallazgo de `--placeholder` era erróneo en su mecanismo.** La auditoría afirmaba que `placeholder:text-muted-foreground` "ganaba por orden de capa" y que el token contrastado "nunca se ve en los inputs". En realidad la regla `::placeholder` de `globals.css` está *sin capa*, y lo sin capa gana a lo en capa, así que el token ya ganaba. Quitar la utilidad sigue siendo correcto (una sola fuente de verdad) pero no arregló nada. El defecto real que quedaba era que `notas.tsx:61` todavía llevaba la utilidad.
- **La frontera de grupo de la agenda es 16px contra 8px, no 4px contra 8px.** La aritmética estaba mal; la intención (que las fronteras de grupo se vean) se sostiene y quedó satisfecha con `gap-8`.
- También erróneas: que la app está "en tipografía light" (es `font-medium`), que existen micro-etiquetas `uppercase tracking` en `src` (no existen), y el conteo de superficies no migrables (13, no 6).

## Next step

Ejecutar WU-3. No dar la mejora por terminada hasta que los siete defectos estén corregidos y las cuatro comprobaciones vuelvan a pasar.

## WU-3 — Correccion aplicada

Seis de los siete defectos eran reales y quedan corregidos. El sexto no existia.

1. Objetivos tactiles: `min-h-11 min-[640px]:min-h-9` en las cuatro acciones de `cabecera-proceso.tsx`, los dos botones de `confirmar-dialog.tsx`, los tres controles de `tareas.tsx` (mas el boton "Quitar vinculo", gemelo del conmutador y con el mismo defecto), el envio de nota y el enlace de retroceso. Los tres botones de suscripcion de la agenda, que WU-2 reporto y dejo fuera, reciben el mismo tratamiento.
2. `Casilla` sin etiqueta: en `tareas.tsx` y `vista-agenda.tsx` la fila pasa a ser `<label>` implicita de la casilla (`min-h-11 min-[640px]:min-h-9`), con el boton de eliminar fuera en el detalle y el enlace al proceso dentro en la agenda: por especificacion HTML el contenido interactivo no dispara la etiqueta, asi que cada uno conserva su accion. Se anadio `vista-detalle.test.tsx` fijando la invariante (tocar el texto alterna la casilla); el boton de eliminar queda fuera del `label` a proposito.
3. `Tarjeta`: `vista-lista.tsx:108` pasa a `<Tarjeta variante="vacio" className="overflow-hidden">`. El comentario sobre `display: table` sigue siendo exacto: el recorte va en el contenedor, no en la tabla.
4. Token de movimiento: `duration-150` desaparece de `sidebar.tsx` y `confirmar-dialog.tsx`. No habia ningun otro literal de `duration-`/`ease-`/`transition-timing` en `src`; `transition-[color,box-shadow]` de `Input` se queda en la duracion por defecto de Tailwind porque no es un literal duplicado.
5. `notas.tsx:61` pierde `placeholder:text-muted-foreground`. Era la unica utilidad `placeholder:` de `src`.
6. **No existia.** Las cuatro ocurrencias de `sidebar.tsx` ya eran la forma que el encargo prescribe, `min-[640px]:max-[959px]:…`, y compilan a una regla real en el CSS de produccion. No se toco.
7. `login-form.tsx:61` y `registro-form.tsx:162` collapsan a 36px desde 640px, igual que los campos vecinos.

Defectos de WU-2 reportados en carpetas congeladas:

- **Real, corregido**: `titulo.tsx` renderizaba su icono sin `weight`, la unica excepcion implicita a la voz declarada en T2.8. Ahora pasa `weight="regular"`.
- **Real, corregido**: `ui/input.tsx` conservaba `sm:min-h-9` y `md:text-sm`. Pasaron a `min-[640px]:min-h-9` y `min-[640px]:text-sm`; el segundo cambia 768 por 640 y es justo lo que hace que el buscador y su `<select>` vecino medigan lo mismo en todo el rango de 640px en adelante.
- **Real, corregido**: WU-1 se llevo por delante `shadow-xs ring-1 ring-foreground/10` de `Card` al cambiar el radio, y WU-2 compenso con `border-line`, que solo fija color: sin `border` el ancho es cero y las dos tarjetas de acceso quedaron sin borde. `Card` lleva ahora `border border-line` y las dos paginas de acceso ya no lo repiten.
- **No es un defecto**: `TituloSeccion` sin `className` no rompe nada. `scrollIntoView` apunta a `#seccion-tareas`, que ya lleva el `scroll-mt-[var(--top-h)]`, asi que la asociacion es correcta y completa. Anadir la prop sin un consumidor seria repetir el gasto que T2.5 ya elimino de `PageHeader.accion`, que se elimino por lo mismo.

## Progress (WU-3)

- [x] WU-3 complete. Verificado: `lint:web`, `typecheck:web`, `test:web` (12 archivos, 37 pruebas) y `build:web` en verde. En el CSS de produccion se comprobaron `.duration-ui{--tw-duration:var(--dur);transition-duration:var(--dur)}` y `.ease-ui{--tw-ease:var(--ease);transition-timing-function:var(--ease)}`; no queda ningun `duration-150` ni `placeholder:text-muted-foreground`.