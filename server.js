// Seguimiento de procesos - Rama Judicial de Colombia
// Servidor para ejecutar en un PC (Node 18+, sin dependencias). En Vercel se usa api/index.js.

const http = require('http');
const fs = require('fs');
const path = require('path');
const { handle, revisarTodos, APP_PASSWORD } = require('./lib/app');

const PORT = process.env.PORT || 3000;
const REFRESH_HOURS = Number(process.env.REFRESH_HOURS || 6);
const PUBLIC_DIR = path.join(__dirname, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname.startsWith('/api/')) return handle(req, res);
  let file = path.normalize(path.join(PUBLIC_DIR, url.pathname === '/' ? 'index.html' : url.pathname));
  if (!file.startsWith(PUBLIC_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC_DIR, 'index.html');
  res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, () => {
  console.log(`Seguimiento de procesos en http://localhost:${PORT}`);
  if (APP_PASSWORD === 'cambiar-esta-clave') console.warn('AVISO: define la variable APP_PASSWORD con la clave de la oficina.');
});

let revisando = false;
if (REFRESH_HOURS > 0) setInterval(async () => {
  if (revisando) return;
  revisando = true;
  try { await revisarTodos(); } catch (e) { console.error(e); } finally { revisando = false; }
}, REFRESH_HOURS * 3600e3);
