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
- **Ver auto** en cada auto o sentencia: busca el PDF en los estados electrónicos de
  Publicaciones Procesales (ver más abajo).
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

   Como mínimo, `DATABASE_URL` (`postgres://objetivo:objetivo@127.0.0.1:5432/objetivo`
   para la base local), `SESSION_SECRET` y `DATA_ENCRYPTION_KEY` (ver la tabla de variables).

4. Aplicar las migraciones de la base de datos:

   ```bash
   npm run -w apps/api migration:run
   ```

5. Crear la primera cuenta de la oficina (ver [Cuentas de usuario](#cuentas-de-usuario)):

   ```bash
   npm run users:create -- ana@oficina.example "Ana Pérez" 1020304050 3001234567
   ```

6. Iniciar la API en modo desarrollo:

   ```bash
   npm run dev:api
   ```

   Abrir http://localhost:3000. Desde un celular en la misma red Wi-Fi:
   `http://<IP-del-PC>:3000`.

7. (Opcional) Interfaz Next.js en un segundo terminal:

   ```bash
   npm run dev:web
   ```

   Abrir http://localhost:3001. Next reenvía `/api/*` a la API del puerto 3000
   (variable `API_ORIGIN` si la API está en otro lugar). Detalles en
   [`apps/web/README.md`](apps/web/README.md).

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
npm run test:web                        # pruebas de la interfaz Next.js (apps/web)
```

## Variables de entorno

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `DATABASE_URL` | Sí | Conexión PostgreSQL (`postgres://…`). |
| `SESSION_SECRET` | Sí | Texto aleatorio de al menos 32 caracteres para firmar las sesiones y el enlace del calendario. Generar con `openssl rand -base64 48`. |
| `DATA_ENCRYPTION_KEY` | Sí para cuentas | 32 bytes en base64 para cifrar cédula, celular y correo. Generar con `openssl rand -base64 32`. **Haga copia de seguridad: sin esta clave los datos cifrados no se pueden leer.** |
| `CRON_SECRET` | No | Clave del endpoint `/api/cron` (cabecera `Authorization: Bearer …`). |
| `REVISION_CRON` | No | Horario de la revisión automática en UTC (por defecto `0 11 * * *`, 6:00 a. m. en Colombia). `off` la desactiva. |
| `DATABASE_CA_CERT` | No | Certificado de la base de datos (contenido PEM) para conexión TLS verificada. |
| `DATABASE_SSL_NO_VERIFY` | No | `true` conecta con TLS **sin verificar** el certificado. Inseguro: solo como medida temporal si no hay `DATABASE_CA_CERT`. La API avisa en el arranque. |
| `DATABASE_POOL_MAX` | No | Tamaño máximo del pool de conexiones (por defecto 5). |
| `DATABASE_MIGRATIONS_RUN` | No | `true` o `false`; aplica migraciones al iniciar (por defecto `true`). |
| `PORT` | No | Puerto HTTP (por defecto 3000). |
| `NODE_ENV` | No | `production` en el servidor. |

Plantilla `.env.example`: pendiente de crear por la oficina. Debe incluir `DATABASE_URL`,
`SESSION_SECRET` y `DATA_ENCRYPTION_KEY`, con la forma de generarlos indicada arriba.

## Despliegue

- La API es NestJS sobre PostgreSQL. **No es compatible con Vercel**: la revisión
  automática de todos los procesos es un trabajo largo que una función sin estado no
  puede completar.
- **Plataforma de alojamiento: pendiente de decisión.** Cualquier servicio que ejecute
  Node.js y permita una base PostgreSQL sirve (VPS, Render, Railway, etc.).
- Antes de publicar, defina `DATABASE_URL`, `SESSION_SECRET` y `DATA_ENCRYPTION_KEY`, y
  compruebe `GET /api/salud`, que indica si la Rama responde, si la base de datos está
  configurada y si el cifrado de datos personales está activo (`claveConfigurada`).

> **Importante:** la API de la Rama Judicial a veces bloquea conexiones desde fuera de
> Colombia. Si falla con error de conexión, use un servidor con IP colombiana o ejecute
> la app en un PC de la oficina.

## Cuentas de usuario

Cada persona de la oficina entra con su **correo** y su **clave**. La clave se guarda
solo como hash (scrypt); nadie, ni el operador, puede leerla.

- **Autorregistro:** en `/registro` la persona llena nombre completo, cédula, correo,
  celular (celular colombiano de 10 dígitos que empieza por 3) y clave (mínimo 12
  caracteres), y acepta el tratamiento de datos (Ley 1581 de 2012). La cuenta queda
  **inactiva**: no puede entrar hasta que la oficina la active.
- **Activación:** la oficina activa la cuenta con `npm run users:activate -- <correo>`.
- **Comandos del operador** (desde la raíz; ninguno acepta la clave como argumento):

  ```bash
  npm run users:create -- <correo> "<nombre completo>" <cédula> <celular>   # activa de inmediato
  npm run users:activate -- <correo>
  npm run users:deactivate -- <correo>
  npm run users:password -- <correo>
  ```

  Cada comando que pide clave la solicita dos veces, sin mostrarla, y exige al menos 12
  caracteres. Con entrada entubada (`echo … | npm run …`) lee una línea por pregunta.
- **Datos personales:** cédula, celular y correo se guardan cifrados (AES-256-GCM con
  `DATA_ENCRYPTION_KEY`). La unicidad y el inicio de sesión usan un índice HMAC-SHA256 con
  una clave derivada distinta.
- **Límite de intentos:** 5 fallos por IP y correo en 15 minutos, luego 429. El contador
  vive en memoria: vale para **una sola instancia** del servidor.
- **Calendario (`agenda.ics`):** el enlace ahora se deriva de `SESSION_SECRET`. El enlace
  anterior dejó de funcionar una vez: copie de nuevo el enlace que devuelve `GET /api/agenda`
  en su aplicación de calendario.

## Datos

Todo se guarda en PostgreSQL (volumen `pgdata` de Docker Compose en desarrollo). Para
respaldar la lista use `pg_dump` sobre la base `objetivo`. Los procesos marcados como
**privados** en la Rama no tienen expediente en la CPNU (responde 404): la app guarda los
datos de la búsqueda del radicado y los sigue por los **estados** publicados del juzgado,
que sí los incluyen. Cada 6 horas la app busca los estados de esos despachos, descarga y lee
el `LISTADO` del estado y, cuando el radicado aparece, lo registra como novedad del proceso:
se ve en el detalle y en Novedades hasta marcarlo como revisado.

La información proviene de la consulta pública de la Rama Judicial y es informativa;
verifique siempre en el expediente o en la consulta oficial.

## Autos (Publicaciones Procesales)

La CPNU casi nunca adjunta el documento de un auto. **Ver auto** lo busca en los estados
electrónicos del portal oficial [Publicaciones Procesales](https://publicacionesprocesales.ramajudicial.gov.co)
(`GET /api/procesos/:id/actuaciones/:actuacionId/auto`, solo para autos y sentencias):

- Despacho = los 12 primeros dígitos del radicado. Ventana de búsqueda: desde la fecha
  del auto hasta la "Fijación estado" de la CPNU más 2 días hábiles (sin festivos por ahora).
- Nivel de certeza visible: **PDF exacto** (el nombre del archivo lleva año y consecutivo
  del radicado), **PDF del día, revisar** (el despacho publica un solo `AUTOS<fecha>.pdf`
  con todos los autos del día), **Ver estado** (no se identificó el PDF) y **No encontrado**.
- Solo enlaces: el servidor lee la página de inicio, los resultados de búsqueda y el
  detalle de cada estado, y devuelve el enlace del PDF para que lo abra el navegador.
  Nunca descarga, guarda ni reenvía PDF: `robots.txt` del portal prohíbe `/c/document_library/`,
  `/documents/` y `/dtd/`, y el adaptador rechaza esas rutas. La única excepción es el
  `LISTADO` de un estado, que la app descarga y lee para saber si un caso privado fue
  publicado (ver **Datos**).
- Carga: una solicitud a la vez con al menos 2 s entre solicitudes, 60 s de espera, un
  reintento ante 5xx o tiempo agotado. Ante 403, 429 o captcha se detiene 30 minutos y la
  app responde "no disponible" sin afectar lo demás.
- Los resultados se guardan por actuación (tabla `autos_publicados`): un PDF exacto o del
  día no se vuelve a buscar; "Ver estado" y "No encontrado" se reintentan cada 3 días, hasta
  5 búsquedas.
- El portal no es una API documentada: si cambia su HTML, la función deja de encontrar
  autos y el resto de la app sigue igual. Es una consulta informativa; verifique el
  documento en el expediente.
