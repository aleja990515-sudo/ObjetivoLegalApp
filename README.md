# Mis Procesos – seguimiento de procesos de la Rama Judicial

App web (PC y celular, instalable como app) para que la oficina siga sus procesos
en la **Consulta de Procesos Nacional Unificada (CPNU)** de la Rama Judicial.

## Qué hace

- Agregar procesos por número de radicado (23 dígitos). Si el radicado tiene varias
  instancias (p. ej. juzgado y tribunal), se agregan todas.
- Lista compartida por toda la oficina, con nombre interno ("Cliente Pérez – ejecutivo")
  y quién lo agregó.
- Revisión automática diaria (configurable) y botón **Revisar todos**.
- Marca en naranja los procesos con **actuaciones nuevas** hasta que alguien los marque
  como revisados.
- Detalle: despacho, clase, sujetos procesales y todas las actuaciones; notas internas,
  tareas y términos con su agenda y enlace de calendario (.ics).
- Acceso con el nombre de la persona + una clave compartida de la oficina.

## Requisitos

- [Node.js](https://nodejs.org) 20.19 o superior (versión LTS).
- [Docker](https://www.docker.com) con Docker Compose, para la base de datos PostgreSQL.

## Puesta en marcha (desarrollo)

1. Instalar dependencias:

   ```bash
   npm install
   ```

2. Levantar la base de datos (PostgreSQL 17 en `127.0.0.1:5432`):

   ```bash
   npm run db:up
   ```

3. Crear el archivo de configuración a partir de la plantilla y completarlo:

   ```bash
   cp .env.example .env
   ```

   Como mínimo, `APP_PASSWORD` y `DATABASE_URL`
   (`postgres://objetivo:objetivo@127.0.0.1:5432/objetivo` para la base local).

4. Aplicar las migraciones de la base de datos:

   ```bash
   npm run -w apps/api migration:run
   ```

5. Iniciar la API en modo desarrollo:

   ```bash
   npm run dev:api
   ```

   Abrir http://localhost:3000. Desde un celular en la misma red Wi-Fi:
   `http://<IP-del-PC>:3000`.

Para detener la base de datos: `npm run db:down`.

## Uso en el PC de la oficina

Doble clic en **Iniciar.bat** (necesita el archivo `.env` y la base de datos activa).
Compila la API si hace falta, abre http://localhost:3000 y deja la app corriendo
mientras la ventana esté abierta.

## Pruebas

```bash
npm test -w apps/api                    # pruebas unitarias
docker compose up -d db-test            # base de pruebas en 127.0.0.1:5434
npm run -w apps/api test:e2e            # pruebas de contrato contra PostgreSQL
```

## Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `APP_PASSWORD` | Sí | Clave compartida de la oficina. |
| `DATABASE_URL` | Sí | Conexión PostgreSQL (`postgres://…`). |
| `SESSION_SECRET` | No | Texto largo y aleatorio para firmar las sesiones. Si se omite, se deriva de `APP_PASSWORD`. |
| `CRON_SECRET` | No | Clave del endpoint `/api/cron` (cabecera `Authorization: Bearer …`). |
| `REVISION_CRON` | No | Horario de la revisión automática en UTC (por defecto `0 11 * * *`, 6:00 a. m. en Colombia). `off` la desactiva. |
| `DATABASE_CA_CERT` | No | Certificado de la base de datos (contenido PEM) para conexión TLS verificada. |
| `DATABASE_POOL_MAX` | No | Tamaño máximo del pool de conexiones (por defecto 5). |
| `DATABASE_MIGRATIONS_RUN` | No | `true` o `false`; aplica migraciones al iniciar (por defecto `true`). |
| `PORT` | No | Puerto HTTP (por defecto 3000). |
| `NODE_ENV` | No | `production` en el servidor. |

## Despliegue

- La API es NestJS sobre PostgreSQL. **No es compatible con Vercel**: la revisión
  automática de todos los procesos es un trabajo largo que una función sin estado no
  puede completar.
- **Plataforma de alojamiento: pendiente de decisión.** Cualquier servicio que ejecute
  Node.js y permita una base PostgreSQL sirve (VPS, Render, Railway, etc.).
- Antes de publicar, defina `APP_PASSWORD`, `DATABASE_URL` y `SESSION_SECRET`, y
  compruebe `GET /api/salud`, que indica si la Rama responde y si la base de datos está
  configurada.

> **Importante:** la API de la Rama Judicial a veces bloquea conexiones desde fuera de
> Colombia. Si falla con error de conexión, use un servidor con IP colombiana o ejecute
> la app en un PC de la oficina.

## Datos

Todo se guarda en PostgreSQL (volumen `pgdata` de Docker Compose en desarrollo). Para
respaldar la lista use `pg_dump` sobre la base `objetivo`. Los procesos marcados como
**privados** en la Rama no se pueden seguir.

La información proviene de la consulta pública de la Rama Judicial y es informativa;
verifique siempre en el expediente o en la consulta oficial.
