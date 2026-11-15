// Stockage local (IndexedDB) + état en mémoire.
// Toutes les données vivent d'abord sur l'appareil ; la synchro les envoie ensuite au cloud.

const DB_NAME = 'fonte';
const DB_VERSION = 1;

export const TABLES = {
  exercises: {
    key: 'id', conflict: 'id',
    columns: ['id', 'user_id', 'name', 'muscle', 'equipment', 'increment', 'bar_weight', 'video_url', 'notes', 'updated_at', 'deleted'],
  },
  templates: {
    key: 'id', conflict: 'id',
    columns: ['id', 'user_id', 'name', 'position', 'items', 'notes', 'updated_at', 'deleted'],
  },
  workouts: {
    key: 'id', conflict: 'id',
    columns: ['id', 'user_id', 'template_id', 'name', 'started_at', 'ended_at', 'notes', 'items', 'updated_at', 'deleted'],
  },
  bodyweights: {
    key: 'day', conflict: 'user_id,day',
    columns: ['user_id', 'day', 'weight', 'updated_at', 'deleted'],
  },
};

const STORES = [...Object.keys(TABLES), 'meta'];

let db = null;
const data = Object.fromEntries(Object.keys(TABLES).map((t) => [t, new Map()]));
const listeners = new Set();
let version = 0;

function req(r) {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function openDb() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, DB_VERSION);
    r.onupgradeneeded = () => {
      const d = r.result;
      for (const s of STORES) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function tx(store, mode = 'readonly') {
  return db.transaction(store, mode).objectStore(store);
}

function persist(table, row) {
  const key = row[TABLES[table].key];
  return req(tx(table, 'readwrite').put(row, key)).catch((e) => console.error('IndexedDB', e));
}

export async function load() {
  db = await openDb();
  for (const t of Object.keys(TABLES)) {
    const rows = await req(tx(t).getAll());
    for (const r of rows) data[t].set(r[TABLES[t].key], r);
  }
  version++;
}

export function uuid() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export function getVersion() {
  return version;
}

export function onChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(detail) {
  version++;
  for (const fn of listeners) {
    try { fn(detail); } catch (e) { console.error(e); }
  }
}

export function all(table) {
  return [...data[table].values()].filter((r) => !r.deleted);
}

export function get(table, key) {
  const r = data[table].get(key);
  return r && !r.deleted ? r : null;
}

// Enregistre une ligne (création ou modification). Marque la ligne « à synchroniser ».
export function save(table, row, { silent = false } = {}) {
  const r = { ...row, updated_at: new Date().toISOString(), _dirty: true };
  if (r.deleted === undefined) r.deleted = false;
  data[table].set(r[TABLES[table].key], r);
  persist(table, r);
  emit({ table, key: r[TABLES[table].key], local: true, silent });
  return r;
}

export function remove(table, key) {
  const r = data[table].get(key);
  if (!r) return;
  save(table, { ...r, deleted: true });
}

export function dirtyRows(table) {
  return [...data[table].values()].filter((r) => r._dirty);
}

export function pendingCount() {
  return Object.keys(TABLES).reduce((n, t) => n + dirtyRows(t).length, 0);
}

// Après un envoi réussi : la ligne n'est plus « à synchroniser »,
// sauf si elle a été modifiée pendant l'envoi.
export function markClean(table, sentRows, userId) {
  for (const s of sentRows) {
    const key = s[TABLES[table].key];
    const local = data[table].get(key);
    if (local && local.updated_at === s.updated_at) {
      const clean = { ...local, user_id: userId, _dirty: false };
      data[table].set(key, clean);
      persist(table, clean);
    }
  }
}

// Fusionne des lignes reçues du serveur. La version la plus récente gagne.
export function mergeRemote(table, rows) {
  let changed = false;
  for (const remote of rows) {
    const key = remote[TABLES[table].key];
    const local = data[table].get(key);
    if (local && local._dirty && Date.parse(local.updated_at) > Date.parse(remote.updated_at)) continue;
    if (local && !local._dirty && local.updated_at && Date.parse(local.updated_at) === Date.parse(remote.updated_at)) continue;
    const row = {};
    for (const c of TABLES[table].columns) row[c] = remote[c];
    if (typeof row.weight === 'string') row.weight = Number(row.weight);
    if (typeof row.increment === 'string') row.increment = Number(row.increment);
    if (typeof row.bar_weight === 'string') row.bar_weight = Number(row.bar_weight);
    row._dirty = false;
    data[table].set(key, row);
    persist(table, row);
    changed = true;
  }
  if (changed) emit({ table, remote: true });
  return changed;
}

// Import d'une sauvegarde : chaque ligne est réenregistrée et sera synchronisée.
export function importRows(table, rows) {
  let n = 0;
  for (const src of rows) {
    const row = {};
    for (const c of TABLES[table].columns) if (c !== 'user_id' && src[c] !== undefined) row[c] = src[c];
    if (!row[TABLES[table].key]) continue;
    const local = data[table].get(row[TABLES[table].key]);
    if (local && !local.deleted && Date.parse(local.updated_at) >= Date.parse(row.updated_at || 0)) continue;
    const r = { ...row, deleted: false, updated_at: new Date().toISOString(), _dirty: true };
    data[table].set(r[TABLES[table].key], r);
    persist(table, r);
    n++;
  }
  if (n) emit({ table, local: true });
  return n;
}

export function serverRow(table, row, userId) {
  const out = {};
  for (const c of TABLES[table].columns) out[c] = row[c] === undefined ? null : row[c];
  out.user_id = userId;
  if (out.deleted === null) out.deleted = false;
  return out;
}

export async function getMeta(key) {
  return req(tx('meta').get(key));
}

export async function setMeta(key, value) {
  return req(tx('meta', 'readwrite').put(value, key));
}

export async function wipe() {
  for (const s of STORES) await req(tx(s, 'readwrite').clear());
  for (const t of Object.keys(TABLES)) data[t].clear();
  emit({ wipe: true });
}

// Exercices supprimés : on garde l'accès au nom pour l'historique.
export function getAny(table, key) {
  return data[table].get(key) || null;
}
