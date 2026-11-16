// Calculs : formats, 1RM estimé, records, progression, poids de corps, disques.
import * as store from './store.js';
import { t, tv, lang, locale, dn, registerNames } from './i18n.js';

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
  lang: 'auto',
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

// ---------- Formats (selon la langue de l'app) ----------
const fmtCache = new Map();
function nfmt(opts) {
  const key = `${locale()}|${JSON.stringify(opts)}`;
  if (!fmtCache.has(key)) fmtCache.set(key, opts.weekday || opts.month || opts.hour || opts.day ? new Intl.DateTimeFormat(locale(), opts) : new Intl.NumberFormat(locale(), opts));
  return fmtCache.get(key);
}

export const fmt = (n) => (n == null || Number.isNaN(n) ? '–' : nfmt({ maximumFractionDigits: 2 }).format(n));
export const fmt1 = (n) => (n == null || Number.isNaN(n) ? '–' : nfmt({ maximumFractionDigits: 1 }).format(n));
export const fmt0 = (n) => (n == null || Number.isNaN(n) ? '–' : nfmt({ maximumFractionDigits: 0 }).format(n));

export function fmtSigned(n, digits = 1) {
  if (n == null || Number.isNaN(n)) return '–';
  const s = nfmt({ maximumFractionDigits: digits, minimumFractionDigits: digits }).format(Math.abs(n));
  if (Math.abs(n) < 0.5 * 10 ** -digits) return s;
  return (n > 0 ? '+' : '−') + s;
}

export function fmtTonnage(kg) {
  if (kg == null) return '–';
  if (kg >= 10000) return `${fmt1(kg / 1000)} t`;
  return `${fmt0(kg)} kg`;
}

export function parseNum(v) {
  if (v == null) return null;
  const s = String(v).trim().replace(',', '.').replace(/\s/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

const date = (opts) => (d) => nfmt(opts).format(new Date(d));
export const fmtDay = date({ weekday: 'short', day: 'numeric', month: 'short' });
export const fmtDate = date({ day: 'numeric', month: 'short', year: 'numeric' });
export const fmtFull = date({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const fmtShort = date({ day: 'numeric', month: 'short' });
export const fmtMonth = date({ month: 'long', year: 'numeric' });
export const fmtTime = date({ hour: '2-digit', minute: '2-digit' });
export const fmtWeekday = date({ weekday: 'short' });

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
  if (days <= 0) return t("aujourd'hui");
  if (days === 1) return t('hier');
  if (days < 7) return t('il y a {n} jours', { n: days });
  if (days < 14) return t('il y a une semaine');
  if (days < 31) return t('il y a {n} semaines', { n: Math.floor(days / 7) });
  return t('le {date}', { date: fmtShort(d) });
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
// Les groupes musculaires sont enregistrés en français (clé stable entre appareils),
// et traduits à l'affichage avec muscleLabel().
export const MUSCLES = [
  'Pectoraux', 'Dos', 'Épaules', 'Biceps', 'Triceps', 'Avant-bras',
  'Quadriceps', 'Ischios', 'Fessiers', 'Mollets', 'Abdos', 'Corps entier', 'Cardio', 'Autre',
];
export const muscleLabel = (m) => tv(m);

export const EQUIPMENT = {
  barre: 'Barre',
  halteres: 'Haltères',
  machine: 'Machine',
  poulie: 'Poulie',
  pdc: 'Poids du corps',
  autre: 'Autre',
  duree: 'Durée (gainage, HIIT)',
  cardio: 'Cardio (durée et distance)',
};
export const equipLabel = (k) => (EQUIPMENT[k] ? t(EQUIPMENT[k]) : '');

// Catalogue des exercices, source unique pour les programmes tout faits et le choix d'un exercice.
// [nom français, groupe, type, nom anglais]
export const CATALOG = [
  ['Développé couché', 'Pectoraux', 'barre', 'Bench press'],
  ['Développé incliné haltères', 'Pectoraux', 'halteres', 'Incline dumbbell press'],
  ['Écarté à la poulie', 'Pectoraux', 'poulie', 'Cable fly'],
  ['Dips', 'Pectoraux', 'pdc', 'Dips'],
  ['Pompes', 'Pectoraux', 'pdc', 'Push-ups'],
  ['Tractions', 'Dos', 'pdc', 'Pull-ups'],
  ['Rowing barre', 'Dos', 'barre', 'Barbell row'],
  ['Rowing haltère', 'Dos', 'halteres', 'One-arm dumbbell row'],
  ['Rowing inversé', 'Dos', 'pdc', 'Inverted row'],
  ['Tirage vertical', 'Dos', 'poulie', 'Lat pulldown'],
  ['Tirage horizontal', 'Dos', 'poulie', 'Seated cable row'],
  ['Soulevé de terre', 'Dos', 'barre', 'Deadlift'],
  ['Développé militaire', 'Épaules', 'barre', 'Overhead press'],
  ['Développé militaire haltères', 'Épaules', 'halteres', 'Dumbbell shoulder press'],
  ['Élévations latérales', 'Épaules', 'halteres', 'Lateral raise'],
  ['Oiseau haltères', 'Épaules', 'halteres', 'Rear delt fly'],
  ['Face pull', 'Épaules', 'poulie', 'Face pull'],
  ['Curl barre', 'Biceps', 'barre', 'Barbell curl'],
  ['Curl marteau', 'Biceps', 'halteres', 'Hammer curl'],
  ['Extension triceps à la poulie', 'Triceps', 'poulie', 'Triceps pushdown'],
  ['Barre au front', 'Triceps', 'barre', 'Skull crusher'],
  ['Squat', 'Quadriceps', 'barre', 'Squat'],
  ['Presse à cuisses', 'Quadriceps', 'machine', 'Leg press'],
  ['Leg extension', 'Quadriceps', 'machine', 'Leg extension'],
  ['Fentes haltères', 'Quadriceps', 'halteres', 'Dumbbell lunge'],
  ['Squat bulgare', 'Quadriceps', 'pdc', 'Bulgarian split squat'],
  ['Fentes au poids du corps', 'Quadriceps', 'pdc', 'Bodyweight lunge'],
  ['Squats sautés', 'Quadriceps', 'duree', 'Jump squats'],
  ['Fentes sautées', 'Quadriceps', 'duree', 'Jump lunges'],
  ['Soulevé de terre jambes tendues', 'Ischios', 'barre', 'Romanian deadlift'],
  ['Leg curl', 'Ischios', 'machine', 'Leg curl'],
  ['Hip thrust', 'Fessiers', 'barre', 'Hip thrust'],
  ['Pont fessier', 'Fessiers', 'pdc', 'Glute bridge'],
  ['Mollets debout', 'Mollets', 'machine', 'Standing calf raise'],
  ['Crunch à la poulie', 'Abdos', 'poulie', 'Cable crunch'],
  ['Relevés de jambes', 'Abdos', 'pdc', 'Leg raises'],
  ['Planche', 'Abdos', 'duree', 'Plank'],
  ['Planche latérale', 'Abdos', 'duree', 'Side plank'],
  ['Hollow hold', 'Abdos', 'duree', 'Hollow hold'],
  ['Burpees', 'Corps entier', 'duree', 'Burpees'],
  ['Mountain climbers', 'Corps entier', 'duree', 'Mountain climbers'],
  ['Jumping jacks', 'Corps entier', 'duree', 'Jumping jacks'],
  ['Montées de genoux', 'Corps entier', 'duree', 'High knees'],
  ['Course à pied', 'Cardio', 'cardio', 'Running'],
  ['Vélo', 'Cardio', 'cardio', 'Cycling'],
  ['Rameur', 'Cardio', 'cardio', 'Rowing machine'],
  ['Elliptique', 'Cardio', 'cardio', 'Elliptical'],
];
export const BASE_EXERCISES = CATALOG;
export const baseName = (row) => (lang() === 'en' ? row[3] : row[0]);
registerNames(BASE_EXERCISES.map((r) => [r[0], r[3]]));

export function defaultIncrement(equipment) {
  return { barre: 2.5, halteres: 2, machine: 5, poulie: 2.5, pdc: 2.5 }[equipment] ?? 2.5;
}

// ---------- 1RM estimé (formule d'Epley) ----------
export function e1rm(load, reps) {
  if (!load || !reps || reps <= 0 || load <= 0) return null;
  if (reps === 1) return load;
  return load * (1 + reps / 30);
}

// ---------- Modes de mesure ----------
// reps   : charge × répétitions (musculation)
// duree  : secondes (gainage, HIIT)
// cardio : durée + distance (course, vélo, rameur…)
export function modeOf(ex) {
  if (ex?.equipment === 'duree') return 'duree';
  if (ex?.equipment === 'cardio') return 'cardio';
  return 'reps';
}

export function itemMode(item, ex) {
  return item?.mode || modeOf(ex);
}

// Une série « compte » si elle est cochée, hors échauffement, et renseignée.
export function setCounts(s, mode) {
  if (!s.done || s.warmup) return false;
  if (mode === 'duree') return s.t > 0;
  if (mode === 'cardio') return s.t > 0 || s.d > 0;
  return s.r > 0;
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
      const mode = itemMode(item, ex);
      const done = (item.sets || []).filter((s) => setCounts(s, mode));
      if (!done.length) continue;
      let entry;
      if (mode === 'duree') {
        const sets = done.map((s) => ({ t: s.t }));
        entry = { mode, sets, maxT: Math.max(...sets.map((x) => x.t)), totalT: sets.reduce((n, x) => n + x.t, 0) };
      } else if (mode === 'cardio') {
        const sets = done.map((s) => ({ t: s.t || 0, d: s.d || 0 }));
        const time = sets.reduce((n, x) => n + x.t, 0);
        const dist = sets.reduce((n, x) => n + x.d, 0);
        entry = { mode, sets, time, dist, pace: dist > 0 && time > 0 ? time / dist : null };
      } else {
        const sets = done.map((s) => {
          const load = effectiveLoad(ex, s.w, day, item.base);
          return { w: s.w, r: s.r, rir: s.rir, load, e1rm: e1rm(load, s.r), pdc: isPdc(ex, item.base) };
        });
        entry = {
          mode,
          sets,
          bestE1rm: Math.max(...sets.map((x) => x.e1rm || 0)) || null,
          maxLoad: Math.max(...sets.map((x) => x.load || 0)) || null,
          maxReps: Math.max(...sets.map((x) => x.r || 0)),
          tonnage: sets.reduce((n, x) => n + (x.load || 0) * x.r, 0),
        };
      }
      Object.assign(entry, { workoutId: w.id, date: w.started_at, base: item.base || null });
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
  if (!base || base.kind === 'none') return t('Sans barre');
  if (base.kind === 'pdc') return t('Poids du corps');
  const preset = BAR_PRESETS.find(([, w]) => w === base.weight);
  return preset ? `${t(preset[2])} ${fmt(base.weight)} kg` : t('Barre {w} kg', { w: fmt(base.weight) });
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
  const out = { sessions: h.length, first: h[0].date, last: h[h.length - 1].date, mode: h[h.length - 1].mode };
  const best = (key, cmp = (a, b) => a > b) => {
    let b = null;
    for (const s of h) if (s[key] != null && s[key] > 0 && (!b || cmp(s[key], b.value))) b = { value: s[key], date: s.date };
    return b;
  };
  out.maxT = best('maxT');
  out.totalT = best('totalT');
  out.dist = best('dist');
  out.time = best('time');
  out.pace = best('pace', (a, b) => a < b);
  let e = null, load = null, ton = null, reps = null;
  for (const s of h) {
    if (s.mode && s.mode !== 'reps') continue;
    if (s.bestE1rm && (!e || s.bestE1rm > e.value)) e = { value: s.bestE1rm, date: s.date, set: s.sets.find((x) => x.e1rm === s.bestE1rm) };
    if (s.maxLoad && (!load || s.maxLoad > load.value)) load = { value: s.maxLoad, date: s.date, set: s.sets.find((x) => x.load === s.maxLoad) };
    if (!ton || s.tonnage > ton.value) ton = { value: s.tonnage, date: s.date };
    if (!reps || s.maxReps > reps.value) reps = { value: s.maxReps, date: s.date };
  }
  Object.assign(out, { e1rm: e, load, tonnage: ton, reps });
  return out;
}

// Marque les records battus dans une séance (comparaison avec l'historique antérieur) :
// 1RM estimé pour la musculation, durée max pour les exercices en durée,
// distance pour le cardio. Renvoie un Set de "itemUid:setUid".
export function recordsIn(workout) {
  const out = new Set();
  const day = localDay(workout.started_at);
  for (const item of workout.items || []) {
    const prior = bests(item.exercise_id, { excludeWorkout: workout.id, before: workout.started_at });
    if (!prior) continue;
    const ex = store.getAny('exercises', item.exercise_id);
    const mode = itemMode(item, ex);
    let best;
    let val;
    if (mode === 'duree') {
      best = prior.maxT?.value;
      val = (s) => s.t;
    } else if (mode === 'cardio') {
      best = prior.dist?.value;
      val = (s) => s.d;
    } else {
      best = prior.e1rm?.value;
      val = (s) => e1rm(effectiveLoad(ex, s.w, day, item.base), s.r);
    }
    if (!best) continue;
    for (const s of item.sets || []) {
      if (!setCounts(s, mode)) continue;
      const v = val(s);
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
  const mode = modeOf(exercise);
  const last = lastSession(exercise.id);
  const lastSame = last && last.mode === mode ? last : null;
  const common = {
    uid: uidFn(),
    exercise_id: exercise.id,
    name: exercise.name,
    mode,
    rest_sec: tItem?.rest_sec ?? s.rest,
    target_sets: tItem?.sets ?? null,
  };

  if (mode === 'duree') {
    const n = tItem?.sets || lastSame?.sets.length || 3;
    const sets = [];
    for (let i = 0; i < n; i++) {
      const prev = lastSame ? lastSame.sets[i] || lastSame.sets[lastSame.sets.length - 1] : null;
      sets.push({ uid: uidFn(), t: tItem?.target_t ?? prev?.t ?? 30, done: false, warmup: false });
    }
    return { ...common, target_t: tItem?.target_t ?? null, int_rest: tItem?.int_rest ?? null, circuit: !!tItem?.circuit, base: { kind: 'none' }, sets };
  }

  if (mode === 'cardio') {
    const n = tItem?.sets || 1;
    const sets = [];
    for (let i = 0; i < n; i++) {
      const prev = lastSame ? lastSame.sets[i] || null : null;
      sets.push({ uid: uidFn(), t: prev?.t ?? null, d: prev?.d ?? null, done: false, warmup: false });
    }
    return { ...common, base: { kind: 'none' }, sets };
  }

  const lastReps = lastSame;
  const target = tItem?.sets || (lastReps ? lastReps.sets.length : 3);
  const repMin = tItem?.rep_min ?? null;
  const repMax = tItem?.rep_max ?? null;
  let progressed = false;
  const inc = exercise.increment || defaultIncrement(exercise.equipment);

  const sets = [];
  for (let i = 0; i < target; i++) {
    const prev = lastReps ? lastReps.sets[i] || lastReps.sets[lastReps.sets.length - 1] : null;
    sets.push({ uid: uidFn(), w: prev ? prev.w : null, r: prev ? prev.r : repMin ?? repMax ?? null, rir: null, done: false, warmup: false });
  }
  // Double progression : toutes les séries au haut de la fourchette → on monte la charge.
  if (lastReps && repMax && lastReps.sets.length >= (tItem?.sets || 1) && lastReps.sets.every((x) => x.r >= repMax)) {
    progressed = true;
    for (const st of sets) {
      if (st.w != null) st.w = Math.round((st.w + inc) * 100) / 100;
      st.r = repMin ?? st.r;
    }
  }
  return {
    ...common,
    rep_min: repMin,
    rep_max: repMax,
    progressed: progressed ? inc : 0,
    base: lastReps?.base || defaultBase(exercise),
    sets,
  };
}

// ---------- Statistiques de séance ----------
export function workoutStats(w) {
  const day = localDay(w.started_at);
  let sets = 0, tonnage = 0, time = 0, dist = 0;
  for (const item of w.items || []) {
    const ex = store.getAny('exercises', item.exercise_id);
    const mode = itemMode(item, ex);
    for (const s of item.sets || []) {
      if (!setCounts(s, mode)) continue;
      sets++;
      if (mode === 'reps') tonnage += (effectiveLoad(ex, s.w, day, item.base) || 0) * s.r;
      else {
        time += s.t || 0;
        dist += s.d || 0;
      }
    }
  }
  const end = w.ended_at ? Date.parse(w.ended_at) : Date.now();
  return { sets, tonnage, time, dist, duration: end - Date.parse(w.started_at), exercises: (w.items || []).length };
}

export function setsPerMuscle(days = 7) {
  const since = Date.now() - days * 86400000;
  const counts = new Map();
  for (const w of index().workouts) {
    if (Date.parse(w.started_at) < since) continue;
    for (const item of w.items || []) {
      const ex = store.getAny('exercises', item.exercise_id);
      const mode = itemMode(item, ex);
      if (mode === 'cardio') continue;
      const m = ex?.muscle || 'Autre';
      const n = (item.sets || []).filter((s) => setCounts(s, mode)).length;
      if (n) counts.set(m, (counts.get(m) || 0) + n);
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

// ---------- Durées et allure ----------
export function fmtSec(sec) {
  if (sec == null || Number.isNaN(sec)) return '–';
  const s = Math.round(sec);
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h) return `${h} h ${String(m).padStart(2, '0')}`;
  return r ? `${m} min ${String(r).padStart(2, '0')}` : `${m} min`;
}

export function fmtPace(secPerKm) {
  if (!secPerKm || !Number.isFinite(secPerKm)) return '–';
  const s = Math.round(secPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} /km`;
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

// Vidéo de technique : le lien choisi pour l'exercice, sinon une recherche YouTube sur son nom.
export function validVideoUrl(url) {
  const u = String(url || '').trim();
  return /^https:\/\/[^\s]+$/i.test(u) ? u : null;
}

export function extractUrl(text) {
  const m = String(text || '').match(/https:\/\/[^\s"'<>]+/i);
  return m ? m[0] : null;
}

export function techniqueUrl(ex, fallbackName = '') {
  const own = validVideoUrl(ex?.video_url);
  if (own) return own;
  const name = dn(ex?.name || fallbackName);
  const q = lang() === 'en' ? `${name} exercise technique` : `${name} technique exécution`;
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`;
}

export function barWeightOf(ex) {
  return ex?.bar_weight ?? settings().bar;
}

// [nom court, poids, nom complet] (traduits à l'affichage)
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
