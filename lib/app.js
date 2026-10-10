// Lógica de la API: sesión, consulta a la CPNU (Rama Judicial) y seguimiento.
// La usan tanto server.js (PC) como api/index.js (Vercel).
const crypto = require('crypto');
const almacen = require('./store');

const APP_PASSWORD = process.env.APP_PASSWORD || 'cambiar-esta-clave';
const SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('s:' + APP_PASSWORD).digest('hex');
const CPNU = 'https://consultaprocesos.ramajudicial.gov.co:448/api/v2';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- Cliente CPNU ----------

async function cpnu(p) {
  const res = await fetch(CPNU + p, {
    headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 SeguimientoProcesos' },
    signal: AbortSignal.timeout(25000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`La Rama Judicial respondió ${res.status}`);
  return res.json();
}

async function buscarRadicado(numero) {
  const r = await cpnu(`/Procesos/Consulta/NumeroRadicacion?numero=${numero}&SoloActivos=false&pagina=1`);
  return (r && r.procesos) || [];
}

async function todasLasActuaciones(id) {
  const out = [];
  for (let pagina = 1; pagina <= 20; pagina++) {
    const r = await cpnu(`/Proceso/Actuaciones/${id}?pagina=${pagina}`);
    const lote = (r && r.actuaciones) || [];
    out.push(...lote);
    const pag = r && r.paginacion;
    if (!lote.length || !pag || pagina >= pag.cantidadPaginas) break;
  }
  return out.map((a) => ({
    id: a.idRegActuacion,
    cons: a.consActuacion,
    fecha: a.fechaActuacion,
    actuacion: a.actuacion,
    anotacion: a.anotacion,
    fechaInicial: a.fechaInicial,
    fechaFinal: a.fechaFinal,
    fechaRegistro: a.fechaRegistro,
    conDocumentos: a.conDocumentos,
  }));
}

// La CPNU responde 500 cuando un proceso no tiene sujetos o actuaciones; en ese
// caso se conserva lo que ya se tenía (null) en vez de fallar todo el proceso.
async function cargarProceso(id) {
  const detalle = await cpnu(`/Proceso/Detalle/${id}`);
  const suj = await cpnu(`/Proceso/Sujetos/${id}?pagina=1`).catch(() => null);
  const actuaciones = await todasLasActuaciones(id).catch(() => null);
  return {
    detalle: detalle || {},
    sujetos: suj && (suj.sujetos || []).map((s) => ({ tipo: s.tipoSujeto, nombre: s.nombreRazonSocial })),
    actuaciones,
  };
}

// Actualiza un proceso y marca como nuevas las actuaciones no vistas.
async function refrescar(p) {
  const datos = await cargarProceso(p.idProceso);
  datos.sujetos = datos.sujetos || p.sujetos;
  datos.actuaciones = datos.actuaciones || p.actuaciones;
  const conocidas = new Set(p.actuaciones.map((a) => a.id));
  const nuevas = p.actuaciones.length ? datos.actuaciones.filter((a) => !conocidas.has(a.id)).map((a) => a.id) : [];
  p.detalle = datos.detalle;
  p.sujetos = datos.sujetos;
  p.actuaciones = datos.actuaciones;
  p.noVistas = [...new Set([...(p.noVistas || []), ...nuevas])].filter((id) => datos.actuaciones.some((a) => a.id === id));
  p.ultimaConsulta = new Date().toISOString();
  p.error = null;
  return nuevas.length;
}

// Campos que edita la oficina; una actualización desde la Rama nunca los pisa.
const CAMPOS_OFICINA = ['alias', 'notas', 'tareas', 'responsable', 'etiquetas', 'nuevaInstancia'];

// Guarda un proceso recién consultado sin perder cambios hechos mientras se
// consultaba (notas, tareas, renombrar, marcar como revisado, quitar de la lista).
async function guardarRefresco(store, p, antes) {
  const actual = await store.get(p.idProceso);
  if (!actual) return false;
  if (!(actual.noVistas || []).length) p.noVistas = (p.noVistas || []).filter((id) => !antes.has(id));
  for (const k of CAMPOS_OFICINA) p[k] = actual[k];
  await store.put(p);
  return true;
}

function nuevoProceso(e, numero, autor, extra = {}) {
  return { idProceso: String(e.idProceso), radicado: numero, alias: '', despacho: e.despacho,
    sujetosTexto: e.sujetosProcesales, detalle: {}, sujetos: [], actuaciones: [], noVistas: [],
    notas: [], tareas: [], responsable: '', etiquetas: [],
    agregadoPor: autor, agregado: new Date().toISOString(), ...extra };
}

// Busca de nuevo el radicado: si aparece una instancia que no se seguía
// (p. ej. el proceso subió al tribunal), se agrega a la lista marcada como nueva.
async function detectarInstancias(store, numero, base) {
  const conocidos = new Set((await store.list()).map((p) => p.idProceso));
  let nuevas = 0;
  for (const e of await buscarRadicado(numero)) {
    if (conocidos.has(String(e.idProceso)) || e.esPrivado) continue;
    const p = nuevoProceso(e, numero, 'Revisión automática', {
      alias: base?.alias ? `${base.alias} (nueva instancia)` : '', responsable: base?.responsable || '',
      etiquetas: base?.etiquetas || [], nuevaInstancia: true });
    try { await refrescar(p); } catch (err) { p.error = err.message; }
    await store.put(p);
    nuevas++;
  }
  return nuevas;
}

// Revisa todos los procesos (cron diario en Vercel / intervalo en el PC).
async function revisarTodos() {
  const store = almacen.store;
  let nuevas = 0, errores = 0, instancias = 0;
  const radicados = new Map();
  for (const { idProceso } of await store.list()) {
    const p = await store.get(idProceso); // leer justo antes, por si alguien lo editó
    if (!p) continue;
    if (!radicados.has(p.radicado)) radicados.set(p.radicado, p);
    const antes = new Set(p.noVistas || []);
    try { nuevas += await refrescar(p); } catch (e) { p.error = e.message; errores++; }
    await guardarRefresco(store, p, antes);
    await sleep(1000); // no saturar el servicio de la Rama
  }
  for (const [numero, base] of radicados) {
    try { instancias += await detectarInstancias(store, numero, base); } catch { errores++; }
    await sleep(500);
  }
  await store.setMeta('ultimaRevision', new Date().toISOString());
  console.log(`[revision] nuevas=${nuevas} instancias=${instancias} errores=${errores}`);
  return { nuevas, instancias, errores };
}

// ---------- Agenda (archivo .ics para Google Calendar / Outlook) ----------

const tokenAgenda = () => crypto.createHmac('sha256', SECRET).update('agenda-ics').digest('hex').slice(0, 32);
const icsTexto = (s) => String(s || '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\r?\n/g, '\\n');

function generarIcs(procesos) {
  const ahora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//MisProcesos//ES', 'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH', 'X-WR-CALNAME:Mis Procesos – términos', 'X-WR-TIMEZONE:America/Bogota'];
  for (const p of procesos) for (const t of p.tareas || []) {
    if (t.hecha || !/^\d{4}-\d{2}-\d{2}$/.test(t.fecha)) continue;
    const dia = t.fecha.replace(/-/g, '');
    lineas.push('BEGIN:VEVENT', `UID:${t.id}@misprocesos`, `DTSTAMP:${ahora}`);
    if (/^\d{2}:\d{2}$/.test(t.hora || '')) {
      // Colombia es UTC-5 todo el año.
      const inicio = new Date(`${t.fecha}T${t.hora}:00-05:00`);
      const f = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
      lineas.push(`DTSTART:${f(inicio)}`, `DTEND:${f(new Date(inicio.getTime() + 3600e3))}`);
    } else {
      const sig = new Date(`${t.fecha}T00:00:00Z`); sig.setUTCDate(sig.getUTCDate() + 1);
      lineas.push(`DTSTART;VALUE=DATE:${dia}`, `DTEND;VALUE=DATE:${sig.toISOString().slice(0, 10).replace(/-/g, '')}`);
    }
    lineas.push(`SUMMARY:${icsTexto(`${t.titulo} – ${p.alias || p.radicado}`)}`,
      `DESCRIPTION:${icsTexto(`Radicado ${p.radicado}\n${p.detalle?.despacho || p.despacho || ''}${t.responsable ? '\nResponsable: ' + t.responsable : ''}`)}`,
      'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:Recordatorio', 'TRIGGER:-P1D', 'END:VALARM', 'END:VEVENT');
  }
  lineas.push('END:VCALENDAR');
  return lineas.join('\r\n');
}

// ---------- Sesión (clave compartida de la oficina) ----------

const firmar = (valor) => valor + '.' + crypto.createHmac('sha256', SECRET).update(valor).digest('base64url');
function leerSesion(req) {
  const m = /(?:^|;\s*)sesion=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  try {
    const token = decodeURIComponent(m[1]);
    const valor = token.slice(0, token.lastIndexOf('.'));
    const a = Buffer.from(firmar(valor)), b = Buffer.from(token);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const [nombre, exp] = JSON.parse(Buffer.from(valor, 'base64url').toString());
    return Date.now() < exp ? { nombre } : null;
  } catch { return null; }
}
function cookieSesion(nombre) {
  const valor = Buffer.from(JSON.stringify([nombre, Date.now() + 30 * 864e5])).toString('base64url');
  const seguro = process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return `sesion=${encodeURIComponent(firmar(valor))}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${30 * 86400}${seguro}`;
}
const iguales = (x, y) => crypto.timingSafeEqual(
  crypto.createHash('sha256').update(String(x || '')).digest(), crypto.createHash('sha256').update(String(y)).digest());

// ---------- HTTP ----------

function json(res, code, obj, headers = {}) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(JSON.stringify(obj));
}
function leerCuerpo(req) {
  if (req.body !== undefined) { // Vercel ya leyó el cuerpo
    if (typeof req.body === 'string') return Promise.resolve(req.body ? JSON.parse(req.body) : {});
    return Promise.resolve(Buffer.isBuffer(req.body) ? JSON.parse(req.body.toString() || '{}') : req.body || {});
  }
  return new Promise((resolve, reject) => {
    let s = '';
    req.on('data', (c) => { s += c; if (s.length > 1e5) req.destroy(); });
    req.on('end', () => { try { resolve(s ? JSON.parse(s) : {}); } catch { reject(new Error('JSON inválido')); } });
  });
}

// Actuaciones que son providencias del juez (autos, sentencias, fallos).
const ES_PROVIDENCIA = /^\s*(auto|sentencia|fallo|providencia|decisi[oó]n)/i;

const hoyBogota = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10);
const pendientes = (p) => (p.tareas || []).filter((t) => !t.hecha).sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')));

const resumen = (p) => ({
  idProceso: p.idProceso,
  radicado: p.radicado,
  alias: p.alias,
  despacho: p.detalle.despacho || p.despacho,
  claseProceso: p.detalle.claseProceso,
  sujetos: p.sujetosTexto,
  ultimaActuacion: p.actuaciones[0] || null,
  ultimoAuto: p.actuaciones.find((a) => ES_PROVIDENCIA.test(a.actuacion || '')) || null,
  noVistas: (p.noVistas || []).length,
  nuevaInstancia: Boolean(p.nuevaInstancia),
  proximaTarea: pendientes(p)[0] || null,
  tareasVencidas: pendientes(p).filter((t) => t.fecha < hoyBogota()).length,
  responsable: p.responsable || '',
  etiquetas: p.etiquetas || [],
  ultimaConsulta: p.ultimaConsulta,
  agregadoPor: p.agregadoPor,
  error: p.error,
});

const id8 = () => crypto.randomBytes(6).toString('hex');
const texto = (v, max) => String(v ?? '').trim().slice(0, max);
const fechaValida = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v || '') && !isNaN(new Date(v + 'T00:00:00Z'));

async function rutasProtegidas(req, res, partes, usuario) {
  const store = almacen.store;
  const metodo = req.method;

  if (partes[0] === 'procesos' && partes.length === 1 && metodo === 'GET') {
    const lista = (await store.list()).map(resumen)
      .sort((a, b) => (b.noVistas + b.nuevaInstancia - a.noVistas - a.nuevaInstancia) || String(b.ultimaActuacion?.fecha).localeCompare(String(a.ultimaActuacion?.fecha)));
    return json(res, 200, { procesos: lista, ultimaRevision: await store.getMeta('ultimaRevision') });
  }

  if (partes[0] === 'procesos' && partes.length === 1 && metodo === 'POST') {
    const { radicado, alias } = await leerCuerpo(req);
    const numero = String(radicado || '').replace(/\D/g, '');
    if (numero.length !== 23) return json(res, 400, { error: 'El radicado debe tener 23 dígitos.' });
    const encontrados = await buscarRadicado(numero);
    if (!encontrados.length) return json(res, 404, { error: 'No se encontró ese radicado en la Consulta Nacional Unificada.' });
    const agregados = [];
    for (const e of encontrados) {
      const id = String(e.idProceso);
      if (await store.get(id)) continue;
      if (e.esPrivado) { agregados.push({ idProceso: id, privado: true }); continue; }
      const p = nuevoProceso(e, numero, usuario.nombre, { alias: texto(alias, 120) });
      try { await refrescar(p); } catch (err) { p.error = err.message; }
      await store.put(p);
      agregados.push(resumen(p));
    }
    if (!agregados.length) return json(res, 409, { error: 'Ese proceso ya está en la lista.' });
    return json(res, 201, { agregados });
  }

  // Novedades: actuaciones no revisadas y nuevas instancias de todos los procesos.
  if (partes[0] === 'novedades' && metodo === 'GET') {
    const items = [];
    for (const p of await store.list()) {
      const nuevas = new Set(p.noVistas || []);
      const base = { idProceso: p.idProceso, radicado: p.radicado, alias: p.alias, despacho: p.detalle.despacho || p.despacho };
      if (p.nuevaInstancia) items.push({ ...base, tipo: 'instancia', fecha: p.agregado });
      for (const a of p.actuaciones) if (nuevas.has(a.id)) items.push({ ...base, tipo: 'actuacion', fecha: a.fecha, actuacion: a });
    }
    items.sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    return json(res, 200, items);
  }

  // Agenda de toda la oficina.
  if (partes[0] === 'agenda' && metodo === 'GET') {
    const items = [];
    for (const p of await store.list()) for (const t of p.tareas || []) {
      items.push({ ...t, idProceso: p.idProceso, radicado: p.radicado, alias: p.alias, despacho: p.detalle.despacho || p.despacho });
    }
    items.sort((a, b) => (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')));
    const origen = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers['x-forwarded-host'] || req.headers.host}`;
    return json(res, 200, { tareas: items, hoy: hoyBogota(), ics: `${origen}/api/agenda.ics?t=${tokenAgenda()}` });
  }

  // Documentos (PDF) adjuntos a una actuación en la CPNU.
  if (partes[0] === 'actuaciones' && /^\d+$/.test(partes[1] || '') && partes[2] === 'documentos' && metodo === 'GET') {
    const docs = (await cpnu(`/Proceso/DocumentosActuacion/${partes[1]}`)) || [];
    return json(res, 200, docs.map((d) => ({
      id: d.idRegDocumento, tipo: d.tipo, fechaCarga: d.fechaCarga,
      nombre: (d.descripcion && !/^cargado el/i.test(d.descripcion) ? d.descripcion : d.nombre) || 'Documento',
      url: `${CPNU}/Descarga/Documento/${d.idRegDocumento}`,
    })));
  }

  const p = partes[0] === 'procesos' && partes[1] && await store.get(partes[1]);
  if (partes[0] === 'procesos' && !p) return json(res, 404, { error: 'Proceso no encontrado.' });
  if (p) { p.notas ||= []; p.tareas ||= []; p.etiquetas ||= []; }
  const detalleCompleto = (q) => ({ ...resumen(q), detalle: q.detalle, sujetos: q.sujetos, actuaciones: q.actuaciones,
    noVistasIds: q.noVistas || [], notas: q.notas || [], tareas: q.tareas || [] });

  if (p && partes.length === 2 && metodo === 'GET') return json(res, 200, detalleCompleto(p));
  if (p && partes.length === 2 && metodo === 'PATCH') {
    const b = await leerCuerpo(req);
    if ('alias' in b) p.alias = texto(b.alias, 120);
    if ('responsable' in b) p.responsable = texto(b.responsable, 60);
    if ('etiquetas' in b) p.etiquetas = [...new Set((Array.isArray(b.etiquetas) ? b.etiquetas : String(b.etiquetas).split(','))
      .map((e) => texto(e, 30)).filter(Boolean))].slice(0, 10);
    await store.put(p);
    return json(res, 200, detalleCompleto(p));
  }
  if (p && partes.length === 2 && metodo === 'DELETE') {
    await store.del(p.idProceso);
    return json(res, 200, { ok: true });
  }
  if (p && partes[2] === 'visto' && metodo === 'POST') {
    p.noVistas = [];
    p.nuevaInstancia = false;
    await store.put(p);
    return json(res, 200, resumen(p));
  }
  if (p && partes[2] === 'actualizar' && metodo === 'POST') {
    const antes = new Set(p.noVistas || []);
    try { await refrescar(p); } catch (e) { p.error = e.message; }
    await guardarRefresco(store, p, antes);
    let instancias = 0;
    try { instancias = await detectarInstancias(store, p.radicado, p); } catch {}
    return json(res, 200, { ...resumen(p), instanciasNuevas: instancias });
  }

  // Notas internas del proceso.
  if (p && partes[2] === 'notas' && partes.length === 3 && metodo === 'POST') {
    const t = texto((await leerCuerpo(req)).texto, 4000);
    if (!t) return json(res, 400, { error: 'La nota está vacía.' });
    p.notas.unshift({ id: id8(), texto: t, autor: usuario.nombre, fecha: new Date().toISOString() });
    await store.put(p);
    return json(res, 201, detalleCompleto(p));
  }
  if (p && partes[2] === 'notas' && partes[3] && metodo === 'DELETE') {
    p.notas = p.notas.filter((n) => n.id !== partes[3]);
    await store.put(p);
    return json(res, 200, detalleCompleto(p));
  }

  // Tareas y términos (agenda).
  if (p && partes[2] === 'tareas' && partes.length === 3 && metodo === 'POST') {
    const b = await leerCuerpo(req);
    const titulo = texto(b.titulo, 200);
    if (!titulo || !fechaValida(b.fecha)) return json(res, 400, { error: 'Escribe la actividad y una fecha válida.' });
    p.tareas.push({ id: id8(), titulo, fecha: b.fecha, hora: /^\d{2}:\d{2}$/.test(b.hora || '') ? b.hora : '',
      responsable: texto(b.responsable, 60) || p.responsable || '', idActuacion: b.idActuacion || null,
      hecha: false, autor: usuario.nombre, creada: new Date().toISOString() });
    await store.put(p);
    return json(res, 201, detalleCompleto(p));
  }
  const tarea = p && partes[2] === 'tareas' && p.tareas.find((t) => t.id === partes[3]);
  if (p && partes[2] === 'tareas' && !tarea) return json(res, 404, { error: 'Tarea no encontrada.' });
  if (tarea && metodo === 'PATCH') {
    const b = await leerCuerpo(req);
    if ('hecha' in b) { tarea.hecha = Boolean(b.hecha); tarea.hechaPor = tarea.hecha ? usuario.nombre : null; }
    if ('titulo' in b && texto(b.titulo, 200)) tarea.titulo = texto(b.titulo, 200);
    if ('fecha' in b && fechaValida(b.fecha)) tarea.fecha = b.fecha;
    if ('hora' in b) tarea.hora = /^\d{2}:\d{2}$/.test(b.hora || '') ? b.hora : '';
    if ('responsable' in b) tarea.responsable = texto(b.responsable, 60);
    await store.put(p);
    return json(res, 200, detalleCompleto(p));
  }
  if (tarea && metodo === 'DELETE') {
    p.tareas = p.tareas.filter((t) => t !== tarea);
    await store.put(p);
    return json(res, 200, detalleCompleto(p));
  }
  return json(res, 404, { error: 'Ruta no encontrada.' });
}

// Atiende cualquier ruta /api/...
async function handle(req, res) {
  const url = new URL(req.url, 'http://x');
  // En Vercel la ruta original puede llegar como ?ruta=... por la reescritura.
  const ruta = url.pathname.startsWith('/api/') && url.pathname !== '/api/index'
    ? url.pathname.slice(5) : (url.searchParams.get('ruta') || '');
  const partes = ruta.split('/').filter(Boolean);
  try {
    if (partes[0] === 'salud') {
      let rama = 'ok';
      try { await buscarRadicado('11001310300120190012300'); } catch (e) { rama = e.message || String(e); }
      return json(res, 200, { rama, baseDeDatos: almacen.configurado ? almacen.tipo : 'sin configurar',
        claveConfigurada: APP_PASSWORD !== 'cambiar-esta-clave', region: process.env.VERCEL_REGION || 'local' });
    }
    if (partes[0] === 'cron') {
      const secreto = process.env.CRON_SECRET;
      if (!secreto || req.headers.authorization !== `Bearer ${secreto}`) return json(res, 401, { error: 'No autorizado' });
      return json(res, 200, await revisarTodos());
    }
    // Suscripción de calendario: los calendarios no envían cookies, por eso usa un token.
    if (partes[0] === 'agenda.ics') {
      if (!iguales(url.searchParams.get('t'), tokenAgenda())) return json(res, 401, { error: 'Enlace de calendario inválido.' });
      res.writeHead(200, { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'no-store',
        'Content-Disposition': 'inline; filename="mis-procesos.ics"' });
      return res.end(generarIcs(await almacen.store.list()));
    }
    if (partes[0] === 'login' && req.method === 'POST') {
      const { nombre, clave } = await leerCuerpo(req);
      if (APP_PASSWORD === 'cambiar-esta-clave' && process.env.VERCEL) return json(res, 503, { error: 'Falta configurar APP_PASSWORD en Vercel.' });
      if (!iguales(clave, APP_PASSWORD) || !String(nombre || '').trim()) {
        await sleep(800);
        return json(res, 401, { error: 'Nombre o clave incorrectos.' });
      }
      const n = String(nombre).trim().slice(0, 60);
      return json(res, 200, { nombre: n }, { 'Set-Cookie': cookieSesion(n) });
    }
    if (partes[0] === 'logout') return json(res, 200, { ok: true }, { 'Set-Cookie': 'sesion=; Path=/; Max-Age=0' });
    const usuario = leerSesion(req);
    if (partes[0] === 'yo') return usuario ? json(res, 200, usuario) : json(res, 401, { error: 'Sin sesión' });
    if (!usuario) return json(res, 401, { error: 'Inicia sesión.' });
    return await rutasProtegidas(req, res, partes, usuario);
  } catch (e) {
    console.error(e);
    json(res, 502, { error: e.name === 'TimeoutError' ? 'La Rama Judicial no respondió a tiempo. Intenta de nuevo.' : e.message });
  }
}

module.exports = { handle, revisarTodos, APP_PASSWORD };
