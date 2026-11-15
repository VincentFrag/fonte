// Contrôle des données qui entrent dans l'app (fichier importé, serveur, stockage local).
// Chaque champ est ramené à son type attendu : un identifiant reste un identifiant,
// un nombre reste un nombre. Une donnée piégée ne peut donc pas injecter de code dans les écrans.

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const EQUIPMENT = ['barre', 'halteres', 'machine', 'poulie', 'pdc', 'autre', 'duree', 'cardio'];
const MODES = ['reps', 'duree', 'cardio'];
const MAX_ITEMS = 60;
const MAX_SETS = 60;

const id = (v) => (typeof v === 'string' && ID.test(v) ? v : null);
const str = (v, max) => (v == null ? '' : String(v).slice(0, max));
const bool = (v) => v === true;

function num(v, min, max, { int = false } = {}) {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return null;
  const c = Math.min(max, Math.max(min, n));
  return int ? Math.round(c) : c;
}

function iso(v) {
  if (v == null || v === '') return null;
  const t = Date.parse(v);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function https(v) {
  const s = typeof v === 'string' ? v.trim() : '';
  return /^https:\/\/[^\s"'<>`]+$/i.test(s) && s.length <= 500 ? s : null;
}

function base(b) {
  if (!b || typeof b !== 'object') return undefined;
  if (b.kind === 'bar') return { kind: 'bar', weight: num(b.weight, 0, 100) ?? 20 };
  if (b.kind === 'pdc' || b.kind === 'none') return { kind: b.kind };
  return undefined;
}

function set(s) {
  if (!s || typeof s !== 'object') return null;
  const out = {
    uid: id(s.uid),
    w: num(s.w, -500, 1000),
    r: num(s.r, 0, 1000, { int: true }),
    rir: num(s.rir, 0, 20, { int: true }),
    t: num(s.t, 0, 86400, { int: true }),
    d: num(s.d, 0, 1000),
    done: bool(s.done),
    warmup: bool(s.warmup),
    at: iso(s.at),
  };
  return out.uid ? out : null;
}

function workoutItem(it) {
  if (!it || typeof it !== 'object') return null;
  const out = {
    uid: id(it.uid),
    exercise_id: id(it.exercise_id),
    name: str(it.name, 80),
    rest_sec: num(it.rest_sec, 0, 3600, { int: true }),
    rep_min: num(it.rep_min, 0, 1000, { int: true }),
    rep_max: num(it.rep_max, 0, 1000, { int: true }),
    target_sets: num(it.target_sets, 0, MAX_SETS, { int: true }),
    target_t: num(it.target_t, 0, 86400, { int: true }),
    int_rest: num(it.int_rest, 0, 3600, { int: true }),
    progressed: num(it.progressed, 0, 100) || 0,
    circuit: bool(it.circuit),
    sets: Array.isArray(it.sets) ? it.sets.slice(0, MAX_SETS).map(set).filter(Boolean) : [],
  };
  if (MODES.includes(it.mode)) out.mode = it.mode;
  const b = base(it.base);
  if (b) out.base = b;
  return out.uid ? out : null;
}

function templateItem(it) {
  if (!it || typeof it !== 'object' || !id(it.exercise_id)) return null;
  return {
    exercise_id: it.exercise_id,
    sets: num(it.sets, 0, MAX_SETS, { int: true }),
    rep_min: num(it.rep_min, 0, 1000, { int: true }),
    rep_max: num(it.rep_max, 0, 1000, { int: true }),
    rest_sec: num(it.rest_sec, 0, 3600, { int: true }),
    target_t: num(it.target_t, 0, 86400, { int: true }),
    int_rest: num(it.int_rest, 0, 3600, { int: true }),
    circuit: bool(it.circuit),
  };
}

const items = (v, fn) => (Array.isArray(v) ? v.slice(0, MAX_ITEMS).map(fn).filter(Boolean) : []);

// Renvoie une copie propre de la ligne, ou null si elle est inutilisable.
export function cleanRow(table, r) {
  if (!r || typeof r !== 'object') return null;
  const common = { updated_at: iso(r.updated_at), deleted: bool(r.deleted) };
  if (r.user_id !== undefined) common.user_id = id(r.user_id);
  switch (table) {
    case 'exercises': {
      if (!id(r.id)) return null;
      return {
        ...common,
        id: r.id,
        name: str(r.name, 80) || '?',
        muscle: str(r.muscle, 40),
        equipment: EQUIPMENT.includes(r.equipment) ? r.equipment : 'autre',
        increment: num(r.increment, 0, 100),
        bar_weight: num(r.bar_weight, 0, 100),
        video_url: https(r.video_url),
        notes: str(r.notes, 500),
      };
    }
    case 'templates': {
      if (!id(r.id)) return null;
      return { ...common, id: r.id, name: str(r.name, 80) || '?', position: num(r.position, 0, 10000, { int: true }) ?? 0, notes: str(r.notes, 1000), items: items(r.items, templateItem) };
    }
    case 'workouts': {
      if (!id(r.id)) return null;
      const started = iso(r.started_at);
      if (!started) return null;
      return {
        ...common,
        id: r.id,
        template_id: id(r.template_id),
        name: str(r.name, 80),
        started_at: started,
        ended_at: iso(r.ended_at),
        notes: str(r.notes, 1000),
        items: items(r.items, workoutItem),
      };
    }
    case 'bodyweights': {
      if (typeof r.day !== 'string' || !DAY.test(r.day)) return null;
      const weight = num(r.weight, 0, 1000);
      if (weight == null && !common.deleted) return null;
      return { ...common, day: r.day, weight };
    }
    default:
      return null;
  }
}
