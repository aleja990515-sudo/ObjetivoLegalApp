// Almacenamiento de procesos.
// - En Vercel (o si hay credenciales de Upstash Redis): base de datos Redis vía REST.
// - En un PC: archivo data/db.json.
const fs = require('fs');
const path = require('path');

const REDIS_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const REDIS_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

function redisStore() {
  async function cmd(...args) {
    const res = await fetch(REDIS_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${REDIS_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    const r = await res.json().catch(() => ({}));
    if (!res.ok || r.error) throw new Error('Base de datos: ' + (r.error || res.status));
    return r.result;
  }
  return {
    async list() {
      const flat = (await cmd('HGETALL', 'procesos')) || [];
      const out = [];
      for (let i = 1; i < flat.length; i += 2) out.push(JSON.parse(flat[i]));
      return out;
    },
    async get(id) { const v = await cmd('HGET', 'procesos', id); return v ? JSON.parse(v) : null; },
    async put(p) { await cmd('HSET', 'procesos', p.idProceso, JSON.stringify(p)); },
    async del(id) { await cmd('HDEL', 'procesos', id); },
    async getMeta(k) { return cmd('GET', 'meta:' + k); },
    async setMeta(k, v) { await cmd('SET', 'meta:' + k, v); },
  };
}

function fileStore() {
  const dir = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
  const file = path.join(dir, 'db.json');
  fs.mkdirSync(dir, { recursive: true });
  let db = { procesos: {}, meta: {} };
  try { db = { meta: {}, ...JSON.parse(fs.readFileSync(file, 'utf8')) }; } catch {}
  const save = () => { fs.writeFileSync(file + '.tmp', JSON.stringify(db, null, 1)); fs.renameSync(file + '.tmp', file); };
  const copia = (p) => p && JSON.parse(JSON.stringify(p));
  return {
    async list() { return Object.values(db.procesos).map(copia); },
    async get(id) { return copia(db.procesos[id]); },
    async put(p) { db.procesos[p.idProceso] = copia(p); save(); },
    async del(id) { delete db.procesos[id]; save(); },
    async getMeta(k) { return db.meta[k] ?? null; },
    async setMeta(k, v) { db.meta[k] = v; save(); },
  };
}

const configurado = Boolean(REDIS_URL && REDIS_TOKEN) || !process.env.VERCEL;
let instancia;
module.exports = {
  configurado,
  tipo: REDIS_URL && REDIS_TOKEN ? 'redis' : 'archivo',
  get store() {
    if (!configurado) throw new Error('Falta conectar la base de datos (Upstash Redis) al proyecto en Vercel.');
    return (instancia ||= REDIS_URL && REDIS_TOKEN ? redisStore() : fileStore());
  },
};
