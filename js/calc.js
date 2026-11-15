// Calculs : formats, 1RM estimé, records, progression, poids de corps, disques.
import * as store from './store.js';

// ---------- Réglages (par appareil) ----------
const SETTINGS_KEY = 'fonte-settings';
export const DEFAULT_SETTINGS = {
  rest: 120,
  showRir: false,
  bar: 20,
  plates: [25, 20, 15, 10, 5, 2.5, 1.25],
  wakeLock: true,
  sound: true,
  theme: 'auto',
};

export function settings() {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(patch) {
  const s = { ...settings(), ...patch };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  return s;
}

// ---------- Formats ----------
const nf = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 });
const nf1 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 });

export const fmt = (n) => (n == null || Number.isNaN(n) ? '–' : nf.format(n));
export const fmt1 = (n) => (n == null || Number.isNaN(n) ? '–' : nf1.format(n));
export const fmt0 = (n) => (n == null || Number.isNaN(n) ? '–' : nf0.format(n));

export function fmtSigned(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return '–';
  const s = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(Math.abs(n));
  if (Math.abs(n) < 0.5 * 10 ** -digits) return s;
  return (n > 0 ? '+' : '−') + s;
}

export function fmtTonnage(kg) {
  if (kg == null) return '–';
  if (kg >= 10000) return `${nf1.format(kg / 1000)} t`;
  return `${nf0.format(kg)} kg`;
}

export function parseNum(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(',', '.').replace(/\s/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const dfDay = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const dfFull = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const dfShort = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const dfMonth = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });
const dfTime = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

export const fmtDay = (d) => dfDay.format(new Date(d));
const dfDate = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
export const fmtDate = (d) => dfDate.format(new Date(d));
export const fmtFull = (d) => dfFull.format(new Date(d));
export const fmtShort = (d) => dfShort.format(new Date(d));
export const fmtMonth = (d) => dfMonth.format(new Date(d));
export const fmtTime = (d) => dfTime.format(new Date(d));

export function fmtDuration(ms) {
  if (ms == null || ms < 0) return '–';
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, '0')}`;
}

export function fmtClock(sec) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtRest(sec) {
  if (!sec) return '–';
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return s ? `${m} min ${s}` : `${m} min`;
}

export function relDays(d) {
  const days = Math.floor((startOfDay(new Date()) - startOfDay(new Date(d))) / 86400000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} jours`;
  if (days < 14) return 'il y a une semaine';
  if (days < 31) return `il y a ${Math.floor(days / 7)} semaines`;
  return `le ${fmtShort(d)}`;
}

export function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function startOfWeek(d) {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7; // lundi = 0
  x.setDate(x.getDate() - dow);
  return x;
}

export function localDay(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

export function dayToDate(day) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// ---------- Listes de référence ----------
export const MUSCLES = [
  'Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Avant-bras',
  'Quadriceps', 'Ischios', 'Fessiers', 'Mollets', 'Abdos', 'Autre',
];

export const EQUIPMENT = {
  barre: 'Barre',
  halteres: 'Haltères',
  machine: 'Machine',
  poulie: 'Poulie',
  pdc: 'Poids du corps',
  autre: 'Autre',
};

export const BASE_EXERCISES = [
  ['Développé couché', 'Pectoraux', 'barre'],
  ['Développé incliné haltères', 'Pectoraux', 'halteres'],
  ['Écarté à la poulie', 'Pectoraux', 'poulie'],
  ['Dips', 'Pectoraux', 'pdc'],
  ['Tractions', 'Dos', 'pdc'],
  ['Rowing barre', 'Dos', 'barre'],
  ['Tirage vertical', 'Dos', 'poulie'],
  ['Tirage horizontal', 'Dos', 'poulie'],
  ['Soulevé de terre', 'Dos', 'barre'],
  ['Développé militaire', 'Épaules', 'barre'],
  ['Élévations latérales', 'Épaules', 'halteres'],
  ['Face pull', 'Épaules', 'poulie'],
  ['Curl barre', 'Biceps', 'barre'],
  ['Curl marteau', 'Biceps', 'halteres'],
  ['Extension triceps à la poulie', 'Triceps', 'poulie'],
  ['Barre au front', 'Triceps', 'barre'],
  ['Squat', 'Quadriceps', 'barre'],
  ['Presse à cuisses', 'Quadriceps', 'machine'],
  ['Fentes haltères', 'Quadriceps', 'halteres'],
  ['Soulevé de terre jambes tendues', 'Ischios', 'barre'],
  ['Leg curl', 'Ischios', 'machine'],
  ['Hip thrust', 'Fessiers', 'barre'],
  ['Mollets debout', 'Mollets', 'machine'],
  ['Crunch à la poulie', 'Abdos', 'poulie'],
];

export function defaultIncrement(equipment) {
  return { barre: 2.5, halteres: 2, machine: 5, poulie: 2.5, pdc: 2.5 }[equipment] ?? 2.5;
}

// ---------- 1RM estimé (formule d'Epley) ----------
export function e1rm(load, reps) {
  if (!load || !reps || reps <= 0 || load <= 0) return null;
  if (reps === 1) return load;
  return load * (1 + reps / 30);
}

// ---------- Index des données (recalculé quand les données changent) ----------
let cache = { v: -1 };

function index() {
  const v = store.getVersion();
  if (cache.v === v) return cache;
  const bw = store.all('bodyweights')
    .filter((b) => b.weight != null)
    .sort((a, b) => a.day.localeCompare(b.day));
  const workouts = store.all('workouts')
    .filter((w) => w.ended_at)
    .sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at));
  cache = { v, bw, workouts, byExercise: new Map() };
  for (const w of workouts) {
    const day = localDay(w.started_at);
    for (const item of w.items || []) {
      const ex = store.getAny('exercises', item.exercise_id);
      const sets = (item.sets || [])
        .filter((s) => s.done && !s.warmup && s.r > 0)
        .map((s) => {
          const load = effectiveLoad(ex, s.w, day, item.base);
          return { w: s.w, r: s.r, rir: s.rir, load, e1rm: e1rm(load, s.r), pdc: isPdc(ex, item.base) };
        });
      if (!sets.length) continue;
      const entry = {
        workoutId: w.id,
        date: w.started_at,
        base: item.base || null,
        sets,
        bestE1rm: Math.max(...sets.map((s) => s.e1rm || 0)) || null,
        maxLoad: Math.max(...sets.map((s) => s.load || 0)) || null,
        maxReps: Math.max(...sets.map((s) => s.r || 0)),
        tonnage: sets.reduce((n, s) => n + (s.load || 0) * s.r, 0),
      };
      if (!cache.byExercise.has(item.exercise_id)) cache.byExercise.set(item.exercise_id, []);
      cache.byExercise.get(item.exercise_id).push(entry);
    }
  }
  return cache;
}

export function finishedWorkouts() {
  return index().workouts;
}

export function bodyweightAt(day) {
  const list = index().bw;
  let found = null;
  for (const b of list) {
    if (b.day <= day) found = b.weight;
    else break;
  }
  return found ?? (list.length ? list[0].weight : null);
}

export function latestBodyweight() {
  const list = index().bw;
  return list.length ? list[list.length - 1] : null;
}

// Charge de départ d'un exercice dans une séance :
//   { kind: 'bar', weight } : barre (on saisit la charge totale, barre comprise)
//   { kind: 'pdc' }         : poids du corps (on saisit le lest)
//   { kind: 'none' }        : haltères, machine, poulie…
// Les séances antérieures à la v1.2 n'ont pas de base : on se réfère au matériel de l'exercice.
export function defaultBase(ex) {
  if (ex?.equipment === 'pdc') return { kind: 'pdc' };
  if (ex?.equipment === 'barre') return { kind: 'bar', weight: barWeightOf(ex) };
  return { kind: 'none' };
}

export function isPdc(ex, base) {
  return base ? base.kind === 'pdc' : ex?.equipment === 'pdc';
}

export function baseLabel(base) {
  if (!base || base.kind === 'none') return 'Sans barre';
  if (base.kind === 'pdc') return 'Poids du corps';
  const preset = BAR_PRESETS.find(([, w]) => w === base.weight);
  return preset ? `${preset[2]} ${fmt(base.weight)} kg` : `Barre ${fmt(base.weight)} kg`;
}

// Charge réelle : pour un exercice au poids du corps, poids du corps + lest.
export function effectiveLoad(ex, w, day, base = null) {
  if (isPdc(ex, base)) {
    const bw = bodyweightAt(day || localDay());
    if (bw == null) return w || null;
    return bw + (w || 0);
  }
  return w || null;
}

export function exerciseHistory(exerciseId, { excludeWorkout = null, before = null } = {}) {
  const list = index().byExercise.get(exerciseId) || [];
  return list.filter((e) => e.workoutId !== excludeWorkout && (!before || Date.parse(e.date) < Date.parse(before)));
}

export function lastSession(exerciseId, opts) {
  const h = exerciseHistory(exerciseId, opts);
  return h.length ? h[h.length - 1] : null;
}

export function bests(exerciseId, opts) {
  const h = exerciseHistory(exerciseId, opts);
  if (!h.length) return null;
  let e = null, load = null, ton = null, reps = null;
  for (const s of h) {
    if (s.bestE1rm && (!e || s.bestE1rm > e.value)) e = { value: s.bestE1rm, date: s.date, set: s.sets.find((x) => x.e1rm === s.bestE1rm) };
    if (s.maxLoad && (!load || s.maxLoad > load.value)) load = { value: s.maxLoad, date: s.date, set: s.sets.find((x) => x.load === s.maxLoad) };
    if (!ton || s.tonnage > ton.value) ton = { value: s.tonnage, date: s.date };
    if (!reps || s.maxReps > reps.value) reps = { value: s.maxReps, date: s.date };
  }
  return { e1rm: e, load, tonnage: ton, reps, sessions: h.length, first: h[0].date, last: h[h.length - 1].date };
}

// Marque les records battus dans une séance (comparaison avec l'historique antérieur).
// Renvoie un Set de "itemUid:setUid".
export function recordsIn(workout) {
  const out = new Set();
  const day = localDay(workout.started_at);
  for (const item of workout.items || []) {
    const prior = bests(item.exercise_id, { excludeWorkout: workout.id, before: workout.started_at });
    if (!prior || !prior.e1rm) continue;
    let best = prior.e1rm.value;
    const ex = store.getAny('exercises', item.exercise_id);
    for (const s of item.sets || []) {
      if (!s.done || s.warmup || !(s.r > 0)) continue;
      const v = e1rm(effectiveLoad(ex, s.w, day, item.base), s.r);
      if (v && v > best + 0.01) {
        out.add(`${item.uid}:${s.uid}`);
        best = v;
      }
    }
  }
  return out;
}

// ---------- Préparation d'un exercice dans une séance ----------
export function buildItem(exercise, tItem, uidFn) {
  const s = settings();
  const last = lastSession(exercise.id);
  const target = tItem?.sets || (last ? last.sets.length : 3);
  const repMin = tItem?.rep_min ?? null;
  const repMax = tItem?.rep_max ?? null;
  let progressed = false;
  const inc = exercise.increment || defaultIncrement(exercise.equipment);

  const sets = [];
  for (let i = 0; i < target; i++) {
    const prev = last ? last.sets[i] || last.sets[last.sets.length - 1] : null;
    sets.push({ uid: uidFn(), w: prev ? prev.w : null, r: prev ? prev.r : repMin ?? repMax ?? null, rir: null, done: false, warmup: false });
  }
  // Double progression : toutes les séries au haut de la fourchette → on monte la charge.
  if (last && repMax && last.sets.length >= (tItem?.sets || 1) && last.sets.every((x) => x.r >= repMax)) {
    progressed = true;
    for (const st of sets) {
      if (st.w != null) st.w = Math.round((st.w + inc) * 100) / 100;
      st.r = repMin ?? st.r;
    }
  }
  return {
    uid: uidFn(),
    exercise_id: exercise.id,
    name: exercise.name,
    rest_sec: tItem?.rest_sec ?? s.rest,
    rep_min: repMin,
    rep_max: repMax,
    target_sets: tItem?.sets ?? null,
    progressed: progressed ? inc : 0,
    base: last?.base || defaultBase(exercise),
    sets,
  };
}

// ---------- Statistiques de séance ----------
export function workoutStats(w) {
  const day = localDay(w.started_at);
  let sets = 0, tonnage = 0;
  for (const item of w.items || []) {
    const ex = store.getAny('exercises', item.exercise_id);
    for (const s of item.sets || []) {
      if (!s.done || s.warmup || !(s.r > 0)) continue;
      sets++;
      tonnage += (effectiveLoad(ex, s.w, day, item.base) || 0) * s.r;
    }
  }
  const end = w.ended_at ? Date.parse(w.ended_at) : Date.now();
  return { sets, tonnage, duration: end - Date.parse(w.started_at), exercises: (w.items || []).length };
}

export function setsPerMuscle(days = 7) {
  const since = Date.now() - days * 86400000;
  const counts = new Map();
  for (const w of index().workouts) {
    if (Date.parse(w.started_at) < since) continue;
    for (const item of w.items || []) {
      const ex = store.getAny('exercises', item.exercise_id);
      const m = ex?.muscle || 'Autre';
      const n = (item.sets || []).filter((s) => s.done && !s.warmup && s.r > 0).length;
      if (n) counts.set(m, (counts.get(m) || 0) + n);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function weekSummary() {
  const start = startOfWeek(new Date()).getTime();
  const ws = index().workouts.filter((w) => Date.parse(w.started_at) >= start);
  let sets = 0, tonnage = 0;
  for (const w of ws) {
    const st = workoutStats(w);
    sets += st.sets;
    tonnage += st.tonnage;
  }
  return { count: ws.length, sets, tonnage };
}

export function workoutsPerWeek(weeks = 12) {
  const start = startOfWeek(new Date());
  const out = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(start);
    d.setDate(d.getDate() - i * 7);
    out.push({ week: d, count: 0 });
  }
  for (const w of index().workouts) {
    const t = Date.parse(w.started_at);
    for (let i = out.length - 1; i >= 0; i--) {
      if (t >= out[i].week.getTime()) {
        if (i < out.length) out[i].count++;
        break;
      }
    }
  }
  return out;
}

// ---------- Poids de corps ----------
export function bodyweightSeries() {
  const list = index().bw;
  return list.map((b, i) => {
    const t = dayToDate(b.day).getTime();
    let sum = 0, n = 0;
    for (let j = i; j >= 0; j--) {
      const tj = dayToDate(list[j].day).getTime();
      if (t - tj > 6 * 86400000) break;
      sum += list[j].weight;
      n++;
    }
    return { day: b.day, t, weight: b.weight, avg: sum / n };
  });
}

// Tendance (kg par semaine) : régression linéaire sur les 28 derniers jours.
export function bodyweightTrend(series, days = 28) {
  if (!series.length) return null;
  const end = series[series.length - 1].t;
  const pts = series.filter((p) => end - p.t <= days * 86400000);
  if (pts.length < 4) return null;
  const xs = pts.map((p) => (p.t - end) / (7 * 86400000));
  const ys = pts.map((p) => p.weight);
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let num = 0, den = 0;
  for (let i = 0; i < xs.length; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  return den ? num / den : null;
}

// ---------- Disques ----------
export const PLATE_COLORS = {
  25: '#D3262B', 20: '#1F5BB8', 15: '#EDBB12', 10: '#1F8A48', 5: '#F2F3F1',
  2.5: '#D3262B', 2: '#1F5BB8', 1.5: '#EDBB12', 1.25: '#AEB4BB', 1: '#1F8A48', 0.5: '#F2F3F1',
};

export function barWeightOf(ex) {
  return ex?.bar_weight ?? settings().bar;
}

// [nom court, poids, nom complet]
export const BAR_PRESETS = [
  ['Olympique', 20, 'Barre olympique'],
  ['Femme', 15, 'Barre femme'],
  ['EZ', 10, 'Barre EZ'],
  ['Trap bar', 25, 'Trap bar'],
  ['Courte', 7, 'Barre courte'],
];

export function platesFor(total, bar, available) {
  if (total == null || total < bar) return null;
  let side = (total - bar) / 2;
  const plates = [];
  const sizes = [...available].filter((x) => x > 0).sort((a, b) => b - a);
  for (const p of sizes) {
    while (side >= p - 1e-9) {
      plates.push(p);
      side = Math.round((side - p) * 1000) / 1000;
      if (plates.length > 20) break;
    }
  }
  return { plates, rest: side > 1e-6 ? side : 0 };
}
