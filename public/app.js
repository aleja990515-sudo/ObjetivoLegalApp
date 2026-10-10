// Seguimiento de procesos - cliente
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
let usuario = null;
let procesos = [];

async function api(ruta, opciones = {}) {
  const res = await fetch('/api' + ruta, {
    ...opciones,
    headers: { 'Content-Type': 'application/json' },
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
  });
  const datos = await res.json().catch(() => ({}));
  if (res.status === 401 && ruta !== '/login') { usuario = null; render(); }
  if (!res.ok) throw new Error(datos.error || 'Error ' + res.status);
  return datos;
}

const fecha = (iso) => iso ? new Date(iso.length === 10 ? iso + 'T00:00:00Z' : iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—';
const fechaLarga = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const fechaHora = (iso) => iso ? new Date(iso).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' }) : 'nunca';
const fmtRadicado = (r) => r.replace(/^(\d{5})(\d{2})(\d{2})(\d{3})(\d{4})(\d{5})(\d{2})$/, '$1-$2-$3-$4-$5-$6-$7');
const hoy = () => new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10); // hora de Colombia
const sumarDias = (iso, n) => { const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const esProvidencia = (a) => /^\s*(auto|sentencia|fallo|providencia|decisi[oó]n)/i.test(a.actuacion || '');
function el(tag, attrs = {}, ...hijos) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k.startsWith('on')) e[k] = v; else e.setAttribute(k, v === true ? '' : v);
  }
  for (const h of hijos.flat()) if (h != null && h !== false) e.append(h);
  return e;
}
const tpl = (id) => $(id).content.cloneNode(true);
let toastT;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3500);
}
const guardarPref = (k, v) => { try { sessionStorage.setItem(k, v); } catch {} };
const leerPref = (k, d = '') => { try { return sessionStorage.getItem(k) ?? d; } catch { return d; } };

// ---------- Navegación ----------

function ruta() {
  const h = location.hash;
  if (/^#\/p\/\d+/.test(h)) return ['detalle', h.split('/')[2]];
  if (h.startsWith('#/novedades')) return ['novedades'];
  if (h.startsWith('#/agenda')) return ['agenda'];
  return ['procesos'];
}

function render() {
  $('#topActions').hidden = !usuario;
  $('#nav').hidden = !usuario;
  app.replaceChildren();
  if (!usuario) return vistaLogin();
  const [r, id] = ruta();
  for (const a of document.querySelectorAll('#nav a')) a.classList.toggle('activa', a.dataset.ruta === (r === 'detalle' ? 'procesos' : r));
  if (r === 'detalle') return vistaDetalle(id);
  if (r === 'novedades') return vistaNovedades();
  if (r === 'agenda') return vistaAgenda();
  return vistaLista();
}

function actualizarNav() {
  const nov = procesos.reduce((n, p) => n + p.noVistas + (p.nuevaInstancia ? 1 : 0), 0);
  const urg = procesos.reduce((n, p) => n + p.tareasVencidas + (p.proximaTarea?.fecha === hoy() ? 1 : 0), 0);
  const bn = $('#navNovedades'), ba = $('#navAgenda');
  bn.hidden = !nov; bn.textContent = nov;
  ba.hidden = !urg; ba.textContent = urg; ba.title = 'Vencidas o para hoy';
  const resp = [...new Set([usuario?.nombre, ...procesos.map((p) => p.responsable)].filter(Boolean))].sort();
  $('#listaResp').replaceChildren(...resp.map((r) => el('option', { value: r })));
}

async function cargarProcesos() {
  const r = await api('/procesos');
  procesos = r.procesos;
  actualizarNav();
  return r;
}

function vistaLogin() {
  app.append(tpl('#tplLogin'));
  $('#formLogin').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = new FormData(ev.target);
    try {
      usuario = await api('/login', { method: 'POST', body: { nombre: f.get('nombre'), clave: f.get('clave') } });
      render();
    } catch (e) { $('#loginError').textContent = e.message; }
  });
}

// ---------- Lista de procesos ----------

async function vistaLista() {
  app.append(tpl('#tplLista'));
  const form = $('#formAgregar');
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const btn = form.querySelector('button');
    const f = new FormData(form);
    $('#addError').textContent = '';
    btn.disabled = true; btn.textContent = 'Consultando…';
    try {
      const r = await api('/procesos', { method: 'POST', body: { radicado: f.get('radicado'), alias: f.get('alias') } });
      const privados = r.agregados.filter((a) => a.privado).length;
      if (privados) $('#addError').textContent = `${privados} instancia(s) son privadas en la Rama Judicial y no se pueden seguir.`;
      const ok = r.agregados.length - privados;
      if (ok) toast(ok > 1 ? `Se agregaron ${ok} instancias del proceso.` : 'Proceso agregado.');
      form.reset();
      await cargarLista();
    } catch (e) { $('#addError').textContent = e.message; }
    finally { btn.disabled = false; btn.textContent = 'Agregar'; }
  });
  const filtro = $('#filtro'), solo = $('#soloNuevas'), resp = $('#filtroResp');
  filtro.value = leerPref('filtro'); solo.checked = leerPref('solo') === '1';
  filtro.addEventListener('input', () => { guardarPref('filtro', filtro.value); pintarLista(); });
  solo.addEventListener('change', () => { guardarPref('solo', solo.checked ? '1' : ''); pintarLista(); });
  resp.addEventListener('change', () => { guardarPref('resp', resp.value); pintarLista(); });
  await cargarLista();
}

async function cargarLista() {
  try {
    const r = await cargarProcesos();
    const estado = $('#estado');
    if (estado) estado.textContent = `${procesos.length} proceso(s) · última revisión automática: ${fechaHora(r.ultimaRevision)}`;
    const sel = $('#filtroResp');
    if (sel) {
      const val = leerPref('resp');
      const nombres = [...new Set(procesos.map((p) => p.responsable).filter(Boolean))].sort();
      sel.replaceChildren(el('option', { value: '' }, 'Todos los responsables'), ...nombres.map((n) => el('option', { value: n }, n)),
        el('option', { value: '__sin' }, 'Sin responsable'));
      sel.value = [...sel.options].some((o) => o.value === val) ? val : '';
    }
    pintarLista();
  } catch (e) { const s = $('#estado'); if (s) s.textContent = e.message; }
}

function pintarLista() {
  const ul = $('#lista');
  if (!ul) return;
  const q = $('#filtro').value.trim().toLowerCase();
  const solo = $('#soloNuevas').checked;
  const resp = $('#filtroResp').value;
  const visibles = procesos.filter((p) =>
    (!solo || p.noVistas || p.nuevaInstancia) &&
    (!resp || (resp === '__sin' ? !p.responsable : p.responsable === resp)) &&
    (!q || [p.radicado, p.alias, p.despacho, p.sujetos, p.claseProceso, p.responsable, ...(p.etiquetas || [])].join(' ').toLowerCase().includes(q)));
  if (!visibles.length) {
    ul.replaceChildren(el('li', { class: 'empty' }, procesos.length ? 'Ningún proceso coincide con el filtro.' : 'Aún no hay procesos. Agrega el primero con su número de radicado.'));
    return;
  }
  ul.replaceChildren(...visibles.map((p) => {
    const u = p.ultimaActuacion, t = p.proximaTarea;
    return el('li', {},
      el('a', { class: 'item' + (p.noVistas || p.nuevaInstancia ? ' nuevo' : ''), href: '#/p/' + p.idProceso },
        el('div', { class: 'r1' },
          el('span', { class: 'alias' }, p.alias || p.despacho || 'Proceso'),
          el('span', { class: 'chips' },
            p.nuevaInstancia ? el('span', { class: 'badge' }, 'Nueva instancia') : null,
            p.noVistas ? el('span', { class: 'badge' }, `${p.noVistas} nueva(s)`) : null,
            p.tareasVencidas ? el('span', { class: 'badge rojo' }, `${p.tareasVencidas} vencida(s)`) : null)),
        el('div', { class: 'radicado muted' }, fmtRadicado(p.radicado)),
        p.alias ? el('div', { class: 'small muted' }, p.despacho) : null,
        el('div', { class: 'ult' }, u ? `${fecha(u.fecha)} · ${u.actuacion}` : 'Sin actuaciones registradas'),
        p.ultimoAuto && p.ultimoAuto.id !== u?.id ? el('div', { class: 'small' }, el('strong', {}, 'Último auto: '), `${fecha(p.ultimoAuto.fecha)} · ${p.ultimoAuto.actuacion}`) : null,
        t ? el('div', { class: 'small proxima' + (t.fecha < hoy() ? ' vencida' : '') }, '📅 ', el('strong', {}, `${fecha(t.fecha)}${t.hora ? ' ' + t.hora : ''}: `), t.titulo) : null,
        p.responsable || (p.etiquetas || []).length ? el('div', { class: 'chips mt-s' },
          p.responsable ? el('span', { class: 'chip' }, '👤 ' + p.responsable) : null,
          ...(p.etiquetas || []).map((e) => el('span', { class: 'chip' }, e))) : null,
        p.sujetos ? el('div', { class: 'partes' }, p.sujetos) : null,
        p.error ? el('div', { class: 'error small' }, 'Última consulta falló: ' + p.error) : null));
  }));
}

// ---------- Novedades ----------

async function vistaNovedades() {
  app.append(tpl('#tplNovedades'));
  const ul = $('#novedades');
  ul.replaceChildren(el('li', { class: 'empty' }, 'Cargando…'));
  try {
    const [items] = await Promise.all([api('/novedades'), cargarProcesos()]);
    if (!items.length) { ul.replaceChildren(el('li', { class: 'empty' }, 'No hay novedades pendientes. ✔')); return; }
    ul.replaceChildren(...items.map((n) => el('li', {},
      el('a', { class: 'item nuevo', href: '#/p/' + n.idProceso },
        el('div', { class: 'r1' }, el('span', { class: 'alias' }, n.alias || n.despacho || 'Proceso'),
          el('span', { class: 'badge' + (n.tipo === 'instancia' ? '' : ' azul') }, n.tipo === 'instancia' ? 'Nueva instancia' : esProvidencia(n.actuacion) ? 'Auto / providencia' : 'Actuación')),
        el('div', { class: 'radicado muted' }, fmtRadicado(n.radicado)),
        n.tipo === 'instancia'
          ? el('div', { class: 'ult' }, `El proceso apareció en un nuevo despacho: ${n.despacho || ''}`)
          : [el('div', { class: 'ult' }, `${fecha(n.actuacion.fecha)} · `, el('strong', {}, n.actuacion.actuacion)),
             n.actuacion.anotacion ? el('div', { class: 'small muted' }, n.actuacion.anotacion) : null],
        n.alias ? el('div', { class: 'small muted' }, n.despacho) : null))));
  } catch (e) { ul.replaceChildren(el('li', { class: 'error' }, e.message)); }
}

// ---------- Agenda ----------

async function vistaAgenda() {
  app.append(tpl('#tplAgenda'));
  const cont = $('#agenda');
  const ver = $('#verHechas');
  ver.checked = leerPref('verHechas') === '1';
  let datos;
  const pintar = () => {
    const h = datos.hoy, semana = sumarDias(h, 7);
    const todas = datos.tareas.filter((t) => ver.checked || !t.hecha);
    const grupos = [
      ['Vencidas', todas.filter((t) => !t.hecha && t.fecha < h), 'vencida'],
      ['Hoy', todas.filter((t) => !t.hecha && t.fecha === h), 'hoy'],
      ['Próximos 7 días', todas.filter((t) => !t.hecha && t.fecha > h && t.fecha <= semana), ''],
      ['Más adelante', todas.filter((t) => !t.hecha && t.fecha > semana), ''],
      ['Realizadas', todas.filter((t) => t.hecha).reverse(), 'hecha'],
    ].filter(([, l]) => l.length);
    if (!grupos.length) {
      cont.replaceChildren(el('p', { class: 'empty' }, 'No hay actividades pendientes. Agenda términos desde el detalle de cada proceso.'));
      return;
    }
    cont.replaceChildren(...grupos.map(([titulo, lista, clase]) => el('section', { class: 'card' },
      el('h2', {}, `${titulo} (${lista.length})`),
      el('ul', { class: 'tareas' }, ...lista.map((t) => itemTarea(t, clase, async (cambios) => {
        await api(`/procesos/${t.idProceso}/tareas/${t.id}`, { method: 'PATCH', body: cambios });
        Object.assign(t, cambios); pintar(); cargarProcesos();
      }, true))))));
  };
  ver.addEventListener('change', () => { guardarPref('verHechas', ver.checked ? '1' : ''); pintar(); });
  try {
    [datos] = await Promise.all([api('/agenda'), cargarProcesos()]);
    const webcal = datos.ics.replace(/^https?:/, 'webcal:');
    $('#icsGoogle').href = 'https://calendar.google.com/calendar/r?cid=' + encodeURIComponent(webcal);
    $('#icsWebcal').href = webcal;
    $('#icsCopiar').onclick = async () => {
      try { await navigator.clipboard.writeText(datos.ics); toast('Enlace copiado.'); }
      catch { prompt('Copia este enlace:', datos.ics); }
    };
    pintar();
  } catch (e) { cont.replaceChildren(el('p', { class: 'error' }, e.message)); }
}

function itemTarea(t, clase, cambiar, conProceso) {
  const vencida = !t.hecha && t.fecha < hoy();
  const chk = el('input', { type: 'checkbox', 'aria-label': 'Marcar como realizada', checked: t.hecha });
  chk.onchange = () => cambiar({ hecha: chk.checked }).catch((e) => { chk.checked = !chk.checked; toast(e.message); });
  return el('li', { class: ['tarea', clase, vencida ? 'vencida' : '', t.hecha ? 'hecha' : ''].join(' ') },
    chk,
    el('div', { class: 'grow' },
      el('div', { class: 'f' }, fechaLarga(t.fecha), t.hora ? ` · ${t.hora}` : '', vencida ? ' · ' : '', vencida ? el('span', { class: 'badge rojo' }, 'Vencida') : null),
      el('div', { class: 'a' }, t.titulo),
      conProceso ? el('a', { href: '#/p/' + t.idProceso, class: 'small' }, `${t.alias || t.despacho || 'Proceso'} · ${fmtRadicado(t.radicado)}`) : null,
      el('div', { class: 'f' }, t.responsable ? '👤 ' + t.responsable : 'Sin responsable', t.hecha && t.hechaPor ? ` · realizada por ${t.hechaPor}` : '')),
    conProceso ? null : el('button', { class: 'btn ghost small-btn', title: 'Eliminar', onclick: () => cambiar(null) }, '✕'));
}

// ---------- Detalle de un proceso ----------

async function vistaDetalle(id) {
  app.append(tpl('#tplDetalle'));
  let p;
  try { p = await api('/procesos/' + id); }
  catch (e) { $('#cabecera').replaceChildren(el('p', { class: 'error' }, e.message)); return; }
  cargarProcesos().catch(() => {});
  pintarCabecera(p, id);
  pintarGestion(p, id);
  pintarTareas(p, id);
  pintarNotas(p, id);
  $('#sujetos').replaceChildren(...(p.sujetos.length ? p.sujetos : [{ tipo: '', nombre: 'Sin información' }])
    .map((s) => el('li', {}, s.tipo ? el('strong', {}, s.tipo + ': ') : null, s.nombre)));
  pintarActuaciones(p);
}

function pintarCabecera(p, id) {
  const d = p.detalle || {};
  const dato = (k, v) => v ? el('div', {}, el('dt', {}, k), el('dd', {}, v)) : null;
  const btnAct = el('button', { class: 'btn' }, '↻ Actualizar');
  const btnVisto = el('button', { class: 'btn primary', hidden: !(p.noVistas || p.nuevaInstancia) }, 'Marcar como revisado');
  btnAct.onclick = async () => {
    btnAct.disabled = true; btnAct.textContent = 'Consultando…';
    try {
      const r = await api(`/procesos/${id}/actualizar`, { method: 'POST' });
      if (r.instanciasNuevas) toast(`¡El proceso tiene ${r.instanciasNuevas} instancia(s) nueva(s)! Ya se agregaron a la lista.`);
    } finally { render(); }
  };
  btnVisto.onclick = async () => { await api(`/procesos/${id}/visto`, { method: 'POST' }); render(); };
  const btnAlias = el('button', { class: 'btn', onclick: async () => {
    const alias = prompt('Nombre interno del proceso:', p.alias || '');
    if (alias !== null) { await api('/procesos/' + id, { method: 'PATCH', body: { alias } }); render(); }
  } }, 'Renombrar');
  const btnQuitar = el('button', { class: 'btn danger', onclick: async () => {
    if (confirm('¿Quitar este proceso de la lista de la oficina? Se perderán sus notas y su agenda.')) {
      await api('/procesos/' + id, { method: 'DELETE' }); location.hash = '#/';
    }
  } }, 'Quitar de la lista');
  $('#cabecera').replaceChildren(...[
    el('div', { class: 'row-between' }, el('h1', {}, p.alias || d.despacho || 'Proceso'),
      el('span', { class: 'chips' },
        p.nuevaInstancia ? el('span', { class: 'badge' }, 'Nueva instancia') : null,
        p.noVistas ? el('span', { class: 'badge' }, `${p.noVistas} nueva(s)`) : null)),
    el('div', { class: 'radicado' }, fmtRadicado(p.radicado)),
    p.alias && d.despacho ? el('div', { class: 'small muted' }, d.despacho) : null,
    p.error ? el('p', { class: 'error' }, 'Última consulta falló: ' + p.error) : null,
    el('details', { class: 'mas-datos', open: matchMedia('(min-width: 700px)').matches },
      el('summary', { class: 'small' }, 'Datos del proceso'),
      el('dl', { class: 'datos' },
        dato('Despacho', d.despacho), dato('Ponente', d.ponente), dato('Tipo', d.tipoProceso),
        dato('Clase', d.claseProceso), dato('Subclase', d.subclaseProceso), dato('Recurso', d.recurso),
        dato('Ubicación', d.ubicacion), dato('Fecha de radicación', d.fechaProceso && fecha(d.fechaProceso)),
        dato('Agregado por', p.agregadoPor), dato('Consultado en la Rama', fechaHora(p.ultimaConsulta)))),
    el('div', { class: 'acciones' }, btnVisto, btnAct, btnAlias, btnQuitar),
    el('p', {}, el('a', { href: 'https://consultaprocesos.ramajudicial.gov.co/Procesos/NumeroRadicacion', target: '_blank', rel: 'noopener', class: 'small' }, 'Abrir la consulta oficial de la Rama Judicial ↗'))].filter(Boolean));
}

function pintarGestion(p, id) {
  const f = $('#formGestion');
  f.responsable.value = p.responsable || '';
  f.etiquetas.value = (p.etiquetas || []).join(', ');
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    try {
      const r = await api('/procesos/' + id, { method: 'PATCH', body: { responsable: f.responsable.value, etiquetas: f.etiquetas.value } });
      f.etiquetas.value = r.etiquetas.join(', ');
      toast('Gestión guardada.');
      cargarProcesos();
    } catch (e) { toast(e.message); }
  };
}

function pintarNotas(p, id) {
  const f = $('#formNota');
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    try { const r = await api(`/procesos/${id}/notas`, { method: 'POST', body: { texto: f.texto.value } }); f.reset(); pintarListaNotas(r, id); }
    catch (e) { toast(e.message); }
  };
  pintarListaNotas(p, id);
}
function pintarListaNotas(p, id) {
  $('#notas').replaceChildren(...p.notas.map((n) => el('li', {},
    el('div', { class: 'f' }, `${n.autor} · ${fechaHora(n.fecha)}`,
      el('button', { class: 'link', title: 'Eliminar nota', onclick: async () => {
        if (!confirm('¿Eliminar esta nota?')) return;
        pintarListaNotas(await api(`/procesos/${id}/notas/${n.id}`, { method: 'DELETE' }), id);
      } }, 'Eliminar')),
    el('div', { class: 'n' }, n.texto))));
}

function pintarTareas(p, id) {
  const f = $('#formTarea');
  f.responsable.value = p.responsable || '';
  $('#btnCalcular').onclick = () => {
    const desde = f.desde.value, n = Number(f.dias.value);
    if (!desde || !n) { $('#calcInfo').textContent = 'Indica la fecha de inicio y el número de días hábiles.'; return; }
    f.fecha.value = Festivos.sumarHabiles(desde, n);
    $('#calcInfo').textContent = `${n} días hábiles contados desde el día siguiente al ${fecha(desde)}: vence el ${fechaLarga(f.fecha.value)}. Verifica suspensiones de términos o cierres del despacho.`;
  };
  f.onsubmit = async (ev) => {
    ev.preventDefault();
    $('#tareaError').textContent = '';
    try {
      const r = await api(`/procesos/${id}/tareas`, { method: 'POST', body: {
        titulo: f.titulo.value, fecha: f.fecha.value, hora: f.hora.value, responsable: f.responsable.value, idActuacion: f.idActuacion.value || null } });
      f.reset(); f.responsable.value = p.responsable || '';
      $('#nuevaTarea').open = false;
      p.tareas = r.tareas; pintarListaTareas(p, id);
      toast('Agendado.');
      cargarProcesos();
    } catch (e) { $('#tareaError').textContent = e.message; }
  };
  pintarListaTareas(p, id);
}
function pintarListaTareas(p, id) {
  const orden = [...p.tareas].sort((a, b) => (a.hecha - b.hecha) || (a.fecha + (a.hora || '')).localeCompare(b.fecha + (b.hora || '')));
  $('#tareas').replaceChildren(...(orden.length ? orden.map((t) => itemTarea(t, '', async (cambios) => {
    const r = cambios === null
      ? (confirm('¿Eliminar esta actividad de la agenda?') ? await api(`/procesos/${id}/tareas/${t.id}`, { method: 'DELETE' }) : null)
      : await api(`/procesos/${id}/tareas/${t.id}`, { method: 'PATCH', body: cambios });
    if (r) { p.tareas = r.tareas; pintarListaTareas(p, id); cargarProcesos(); }
  }, false)) : [el('li', { class: 'empty small' }, 'Sin actividades agendadas.')]));
}

// Abre el formulario de agenda con los datos de una actuación.
function agendarDesde(a) {
  const f = $('#formTarea'); const det = $('#nuevaTarea');
  det.open = true;
  f.titulo.value = `Término: ${a.actuacion}`;
  f.idActuacion.value = a.id;
  if (a.fechaFinal) {
    f.fecha.value = a.fechaFinal.slice(0, 10);
    $('#calcInfo').textContent = `La Rama registra este término del ${fecha(a.fechaInicial)} al ${fecha(a.fechaFinal)}.`;
  } else {
    f.desde.value = (a.fecha || '').slice(0, 10);
    $('#calcInfo').textContent = 'Indica cuántos días hábiles tiene el término y pulsa Calcular.';
  }
  det.scrollIntoView({ behavior: 'smooth', block: 'start' });
  f.titulo.focus();
}

function pintarActuaciones(p) {
  const nuevas = new Set(p.noVistasIds);
  const autos = p.actuaciones.filter(esProvidencia);
  const conDocs = p.actuaciones.filter((a) => a.conDocumentos);
  const filtros = [
    ['todas', `Todas (${p.actuaciones.length})`, p.actuaciones],
    ['autos', `Autos y sentencias (${autos.length})`, autos],
    ['docs', `Con documentos (${conDocs.length})`, conDocs],
  ];
  let actual = leerPref('filtroAct', 'todas');
  const tabs = $('#tabsAct');
  const pintar = () => {
    const [, , lista] = filtros.find(([k]) => k === actual) || filtros[0];
    tabs.replaceChildren(...filtros.map(([k, txt]) => el('button', { class: 'tab', role: 'tab', 'aria-selected': String(k === actual),
      onclick: () => { actual = k; guardarPref('filtroAct', k); pintar(); } }, txt)));
    $('#actuaciones').replaceChildren(...(lista.length ? lista.map((a) => itemActuacion(a, nuevas, p)) :
      [el('li', { class: 'empty' }, actual === 'autos' ? 'No hay autos ni sentencias registrados.' : 'No hay actuaciones con documentos.')]));
  };
  pintar();
}

function textoCompartir(a, p) {
  return [`*${p.alias || p.detalle?.despacho || 'Proceso'}*`, `Radicado ${fmtRadicado(p.radicado)}`, p.detalle?.despacho || '',
    `${fecha(a.fecha)} – ${a.actuacion}`, a.anotacion || '',
    a.fechaFinal ? `Término: ${fecha(a.fechaInicial)} a ${fecha(a.fechaFinal)}` : ''].filter(Boolean).join('\n');
}

function itemActuacion(a, nuevas, p) {
  const terminos = a.fechaInicial ? `Término: ${fecha(a.fechaInicial)} a ${fecha(a.fechaFinal)}` : null;
  const esNueva = nuevas.has(a.id);
  const cajaDocs = el('div', { class: 'docs' });
  const cajaCompartir = el('div', { class: 'compartir', hidden: true },
    el('a', { class: 'btn small-btn', target: '_blank', rel: 'noopener', href: 'https://wa.me/?text=' + encodeURIComponent(textoCompartir(a, p)) }, 'WhatsApp'),
    el('a', { class: 'btn small-btn', href: `mailto:?subject=${encodeURIComponent(`${a.actuacion} – ${fmtRadicado(p.radicado)}`)}&body=${encodeURIComponent(textoCompartir(a, p).replace(/\*/g, ''))}` }, 'Correo'),
    el('button', { class: 'btn small-btn', onclick: async () => {
      try { await navigator.clipboard.writeText(textoCompartir(a, p).replace(/\*/g, '')); toast('Copiado.'); } catch { toast('No se pudo copiar.'); }
    } }, 'Copiar'));
  const acciones = el('div', { class: 'acciones-act' },
    a.conDocumentos ? el('button', { class: 'btn small-btn', onclick: (ev) => verDocumentos(ev.currentTarget, a, cajaDocs) }, '📄 Ver documentos') : null,
    el('button', { class: 'btn small-btn', onclick: () => agendarDesde(a) }, '📅 Agendar'),
    el('button', { class: 'btn small-btn', onclick: async () => {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        try { await navigator.share({ title: a.actuacion, text: textoCompartir(a, p).replace(/\*/g, '') }); return; } catch (e) { if (e.name === 'AbortError') return; }
      }
      cajaCompartir.hidden = !cajaCompartir.hidden;
    } }, '↗ Compartir'));
  return el('li', { class: [esNueva ? 'nueva' : '', esProvidencia(a) ? 'auto' : ''].join(' ').trim() },
    el('div', { class: 'f' }, `${fecha(a.fecha)} · registrada ${fecha(a.fechaRegistro)}`, esNueva ? ' · ' : null, esNueva ? el('span', { class: 'badge' }, 'Nueva') : null),
    el('div', { class: 'a' }, a.actuacion),
    a.anotacion ? el('div', { class: 'n' }, a.anotacion) : null,
    terminos ? el('div', { class: 'f' }, terminos) : null,
    !a.conDocumentos && esProvidencia(a) ? el('div', { class: 'f' }, 'El despacho no adjuntó el documento en la Consulta Nacional.') : null,
    acciones, cajaCompartir, cajaDocs);
}

async function verDocumentos(b, a, caja) {
  b.disabled = true; b.textContent = 'Cargando…';
  try {
    const docs = await api(`/actuaciones/${a.id}/documentos`);
    b.remove();
    caja.replaceChildren(docs.length
      ? el('ul', { class: 'doclist' }, ...docs.map((d) => el('li', {},
          el('a', { href: d.url, target: '_blank', rel: 'noopener' }, `${d.nombre} (${(d.tipo || 'archivo').toUpperCase()})`),
          d.fechaCarga ? el('span', { class: 'f' }, ' · cargado ' + fecha(d.fechaCarga)) : null)))
      : el('div', { class: 'f' }, 'La Rama no devolvió documentos para esta actuación.'));
  } catch (e) { b.disabled = false; b.textContent = '📄 Ver documentos'; caja.replaceChildren(el('div', { class: 'error small' }, e.message)); }
}

// ---------- Arranque ----------

$('#btnSalir').onclick = async () => { await api('/logout').catch(() => {}); usuario = null; location.hash = '#/'; render(); };
$('#btnRevisar').onclick = async () => {
  const b = $('#btnRevisar'); b.disabled = true;
  if (ruta()[0] !== 'procesos') location.hash = '#/';
  let instancias = 0;
  try {
    const { procesos: todos } = await api('/procesos');
    // Uno por uno, para no exceder el tiempo de una sola petición.
    for (let i = 0; i < todos.length; i++) {
      const s = $('#estado'); if (s) s.textContent = `Revisando en la Rama Judicial… ${i + 1} de ${todos.length}`;
      const r = await api(`/procesos/${todos[i].idProceso}/actualizar`, { method: 'POST' }).catch(() => ({}));
      instancias += r.instanciasNuevas || 0;
    }
  } catch {}
  b.disabled = false;
  await cargarLista();
  const nov = procesos.reduce((n, p) => n + p.noVistas, 0);
  toast(`Revisión terminada: ${nov} actuación(es) sin revisar${instancias ? `, ${instancias} instancia(s) nueva(s)` : ''}.`);
};
window.addEventListener('hashchange', render);
window.addEventListener('focus', () => { if (usuario && ruta()[0] === 'procesos') cargarLista(); });

(async () => {
  try { usuario = await api('/yo'); } catch { usuario = null; }
  render();
})();

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
