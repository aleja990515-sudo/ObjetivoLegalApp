# Mis Procesos – seguimiento de procesos de la Rama Judicial

App web (PC y celular, instalable como app) para que la oficina siga sus procesos
en la **Consulta de Procesos Nacional Unificada (CPNU)** de la Rama Judicial.

## Qué hace

- Agregar procesos por número de radicado (23 dígitos). Si el radicado tiene varias
  instancias (p. ej. juzgado y tribunal), se agregan todas.
- Lista compartida por toda la oficina, con nombre interno ("Cliente Pérez – ejecutivo")
  y quién lo agregó.
- Revisión automática cada 6 horas (configurable) y botón **Revisar todos**.
- Marca en naranja los procesos con **actuaciones nuevas** hasta que alguien los marque
  como revisados.
- Detalle: despacho, ponente, clase, ubicación, sujetos procesales y todas las actuaciones.
- Acceso con el nombre de la persona + una clave compartida de la oficina.

## Probar en el PC

Requiere [Node.js](https://nodejs.org) 18 o superior (versión LTS).

Lo más fácil: doble clic en **Iniciar.bat**, escribir la clave de la oficina y listo.
Por consola:

```bash
set APP_PASSWORD=mi-clave-segura
npm start
```

Abrir http://localhost:3000. Desde un celular en la misma red Wi‑Fi:
`http://<IP-del-PC>:3000`.

## Publicada en Vercel

Proyecto `mis-procesos` (equipo objetivo legal): https://mis-procesos.vercel.app

- Los datos se guardan en **Upstash Redis** (Vercel → Storage), variables `KV_REST_API_URL`
  y `KV_REST_API_TOKEN`.
- Variables de entorno: `APP_PASSWORD` (clave de la oficina), `SESSION_SECRET`, `CRON_SECRET`
  (sin espacios).
- Revisión automática: una vez al día, alrededor de las 6:00 a. m. hora Colombia
  (`vercel.json → crons`). El botón **Revisar todos** revisa en cualquier momento.
- Diagnóstico: `/api/salud` indica si la Rama responde y si la base de datos y la clave están configuradas.
- Tras cambiar variables de entorno hay que volver a desplegar (Deployments → Redeploy).

## Publicar en otro servicio

Cualquier servicio que ejecute Node.js sirve (Render, Railway, un VPS, etc.).
Ejemplo con **Render**:

1. Subir esta carpeta a un repositorio de GitHub.
2. En Render: *New → Web Service* → elegir el repositorio.
   - Build command: *(vacío)* · Start command: `npm start`
3. Variables de entorno:
   - `APP_PASSWORD` – clave de la oficina (obligatoria).
   - `SESSION_SECRET` – texto largo aleatorio.
   - `NODE_ENV=production`
   - `DATA_DIR=/var/data`
   - `REFRESH_HOURS=6` (opcional)
4. Agregar un **disco persistente** montado en `/var/data`. Sin disco, la lista se
   borra cada vez que el servicio se reinicia (el plan gratuito no tiene disco).
5. Abrir la URL https que da Render. En el celular: menú del navegador →
   **"Agregar a la pantalla de inicio" / "Instalar app"**.

> **Importante:** la API de la Rama Judicial a veces bloquea conexiones desde fuera de
> Colombia. Después de publicar, agregue un radicado de prueba; si falla con error de
> conexión, use un servidor con IP colombiana o ejecute la app en un PC de la oficina.

## Datos

Todo se guarda en `data/db.json` (o en `DATA_DIR`). Haga copia de ese archivo para
respaldar la lista. Los procesos marcados como **privados** en la Rama no se pueden seguir.

La información proviene de la consulta pública de la Rama Judicial y es informativa;
verifique siempre en el expediente o en la consulta oficial.
