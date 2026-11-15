// Écran « Séance » : démarrer une séance, saisir les séries, minuteur, fin de séance.
import * as store from '../store.js';
import * as calc from '../calc.js';
import * as sync from '../sync.js';
import { esc, icon, openSheet, confirmSheet, menuSheet, toast, debounce, formData } from '../ui.js';
import { pickExercise, platesHtml, workoutRowHtml, videoSheet } from './common.js';
import { runIntervals } from '../timer.js';

export function activeWorkout() {
  return store.all('workouts')
    .filter((w) => !w.ended_at)
    .sort((a, b) => Date.parse(b.started_at) - Date.parse(a.started_at))[0] || null;
}

export function renderSeance(view, ctx) {
  const w = activeWorkout();
  if (w) {
    ctx.wake.enable();
    return editor(view, ctx, w, { live: true });
  }
  ctx.wake.disable();
  renderStart(view, ctx);
}

export function renderWorkoutEdit(view, ctx, id) {
  const w = store.get('workouts', id);
  if (!w) {
    view.innerHTML = `${ctx.pageHead('Séance', { back: '/historique' })}<p class="empty">Cette séance n'existe plus.</p>`;
    return;
  }
  editor(view, ctx, w, { live: !w.ended_at });
}

export function startWorkout(ctx, templateId) {
  const t = templateId ? store.get('templates', templateId) : null;
  const items = t
    ? (t.items || [])
      .map((ti) => {
        const ex = store.get('exercises', ti.exercise_id);
        return ex ? calc.buildItem(ex, ti, store.uuid) : null;
      })
      .filter(Boolean)
    : [];
  store.save('workouts', {
    id: store.uuid(),
    template_id: t?.id || null,
    name: t ? t.name : 'Séance libre',
    started_at: new Date().toISOString(),
    ended_at: null,
    notes: '',
    items,
  });
  ctx.go('/seance');
}

// ---------- Choix de la séance ----------
function renderStart(view, ctx) {
  const templates = store.all('templates')
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name, 'fr'));
  const exercises = store.all('exercises');
  const done = calc.finishedWorkouts();
  const week = calc.weekSummary();
  const last = done[done.length - 1];

  const lastFor = (tid) => {
    for (let i = done.length - 1; i >= 0; i--) if (done[i].template_id === tid) return done[i];
    return null;
  };

  const banner = sync.isConfigured() && !sync.isSignedIn()
    ? `<a class="banner" href="#/compte">Connecte-toi pour synchroniser ton iPhone, ta tablette et ton ordinateur.</a>`
    : '';

  view.innerHTML = `
    ${ctx.pageHead('Séance')}
    ${banner}
    <section class="block">
      <h2 class="block-title">Démarrer une séance</h2>
      <div class="tpl-grid">
        ${templates.map((t) => {
          const names = (t.items || []).map((it) => store.getAny('exercises', it.exercise_id)?.name).filter(Boolean);
          const lw = lastFor(t.id);
          return `<button class="tpl" data-start="${t.id}">
            <span class="tpl-name">${esc(t.name)}</span>
            <span class="tpl-list">${esc(names.slice(0, 4).join(', '))}${names.length > 4 ? `, +${names.length - 4}` : ''}</span>
            <span class="tpl-last">${lw ? `Dernière fois ${esc(calc.relDays(lw.started_at))}` : 'Jamais faite'}</span>
          </button>`;
        }).join('')}
        <button class="tpl tpl-free" data-start="free">
          <span class="tpl-name">Séance libre</span>
          <span class="tpl-list">Tu ajoutes les exercices au fil de la séance.</span>
        </button>
      </div>
      ${!exercises.length ? `<p class="hint-text">Ta liste d'exercices est vide. <a href="#/exercices">Ajouter des exercices</a></p>` : ''}
      ${exercises.length && !templates.length ? `<p class="hint-text">Un programme prépare tes séances : exercices, nombre de séries, fourchette de répétitions et repos. <a href="#/programmes">Créer un programme</a></p>` : ''}
    </section>
    <section class="block">
      <h2 class="block-title">Cette semaine</h2>
      <div class="figures">
        <div class="figure"><span class="fig-value">${week.count}</span><span class="fig-label">séance${week.count > 1 ? 's' : ''}</span></div>
        <div class="figure"><span class="fig-value">${week.sets}</span><span class="fig-label">série${week.sets > 1 ? 's' : ''}</span></div>
        <div class="figure"><span class="fig-value">${esc(calc.fmtTonnage(week.tonnage))}</span><span class="fig-label">soulevés</span></div>
      </div>
    </section>
    ${last ? `<section class="block"><h2 class="block-title">Dernière séance</h2><div class="hist-list">${workoutRowHtml(last)}</div></section>` : ''}`;

  view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-start]');
    if (!b) return;
    startWorkout(ctx, b.dataset.start === 'free' ? null : b.dataset.start);
  });
}

// ---------- Saisie de la séance ----------
const numStr = (n) => (n == null ? '' : String(n).replace('.', ','));

function editor(view, ctx, original, { live }) {
  let w = JSON.parse(JSON.stringify(original));
  const s = calc.settings();
  let pending = false;
  const save = () => {
    pending = false;
    w = store.save('workouts', w, { silent: true });
  };
  const saveSoon = debounce(() => pending && save(), 400);

  const findItem = (el) => {
    const uid = el.closest('[data-item]')?.dataset.item;
    return w.items.find((it) => it.uid === uid);
  };
  const findSet = (el, item) => {
    const uid = el.closest('[data-set]')?.dataset.set;
    return item?.sets.find((x) => x.uid === uid);
  };

  const sub = () => live
    ? `Depuis ${esc(calc.fmtTime(w.started_at))}, <span data-elapsed>${esc(calc.fmtDuration(Date.now() - Date.parse(w.started_at)))}</span>`
    : esc(calc.fmtFull(w.started_at));

  const nextWeight = (item) => {
    const n = item.sets.find((x) => !x.done && !x.warmup) || item.sets.find((x) => !x.warmup) || item.sets[item.sets.length - 1];
    return n?.w ?? null;
  };

  function targetText(item, mode) {
    const n = item.target_sets || item.sets.length;
    if (mode === 'duree') {
      const t = item.target_t || item.sets[0]?.t;
      if (item.int_rest != null) {
        return item.circuit
          ? `Circuit : ${n} tours, ${calc.fmtSec(t)} d'effort, ${calc.fmtSec(item.int_rest)} de récup`
          : `${n} × ${calc.fmtSec(t)} d'effort, ${calc.fmtSec(item.int_rest)} de récup`;
      }
      return `${n} × ${calc.fmtSec(t)}, repos ${calc.fmtRest(item.rest_sec)}`;
    }
    if (mode === 'cardio') return 'Durée en minutes, distance en km';
    if (item.target_sets && (item.rep_min || item.rep_max)) {
      const lo = item.rep_min ?? item.rep_max;
      const hi = item.rep_max ?? item.rep_min;
      return `Objectif ${item.target_sets} × ${lo}${hi !== lo ? ` à ${hi}` : ''} reps, repos ${calc.fmtRest(item.rest_sec)}`;
    }
    return `Repos ${calc.fmtRest(item.rest_sec)}`;
  }

  function itemHtml(item, idx) {
    const ex = store.getAny('exercises', item.exercise_id);
    const name = ex?.name || item.name || 'Exercice supprimé';
    const mode = calc.itemMode(item, ex);
    const base = item.base || calc.defaultBase(ex);
    const pdc = mode === 'reps' && base.kind === 'pdc';
    const barbell = mode === 'reps' && base.kind === 'bar';
    const last = calc.lastSession(item.exercise_id, { excludeWorkout: w.id, before: w.started_at });
    const lastSame = last && last.mode === mode ? last : null;
    const records = calc.recordsIn(w);
    let k = 0;
    const rows = item.sets.map((st) => {
      const prev = !st.warmup && lastSame ? lastSame.sets[k] : null;
      const num = st.warmup ? 'É' : String(++k);
      let prevTxt = '–';
      let fields = '';
      if (mode === 'duree') {
        if (prev) prevTxt = calc.fmtSec(prev.t);
        fields = `<input class="num" data-field="t" inputmode="numeric" autocomplete="off" enterkeyhint="done" value="${numStr(st.t)}" aria-label="Durée en secondes, série ${esc(num)}">`;
      } else if (mode === 'cardio') {
        if (prev) prevTxt = [prev.d ? `${calc.fmt(prev.d)} km` : '', prev.t ? calc.fmtSec(prev.t) : ''].filter(Boolean).join(', ');
        fields = `<input class="num" data-field="tmin" inputmode="decimal" autocomplete="off" enterkeyhint="next" value="${st.t ? numStr(Math.round((st.t / 60) * 100) / 100) : ''}" aria-label="Durée en minutes, série ${esc(num)}">
          <input class="num" data-field="d" inputmode="decimal" autocomplete="off" enterkeyhint="done" value="${numStr(st.d)}" aria-label="Distance en km, série ${esc(num)}">`;
      } else {
        if (prev) prevTxt = `${prev.pdc ? (prev.w ? `+${calc.fmt(prev.w)}` : 'PDC') : calc.fmt(prev.w)} × ${prev.r}`;
        fields = `<input class="num" data-field="w" inputmode="decimal" autocomplete="off" enterkeyhint="next" value="${numStr(st.w)}" placeholder="${pdc ? '0' : ''}" aria-label="${pdc ? 'Lest' : 'Charge'} en kg, série ${esc(num)}">
          <input class="num" data-field="r" inputmode="numeric" autocomplete="off" enterkeyhint="done" value="${numStr(st.r)}" aria-label="Répétitions, série ${esc(num)}">
          ${s.showRir ? `<input class="num" data-field="rir" inputmode="numeric" autocomplete="off" value="${numStr(st.rir)}" aria-label="Répétitions en réserve, série ${esc(num)}">` : ''}`;
      }
      const isRec = records.has(`${item.uid}:${st.uid}`);
      return `<div class="set ${st.done ? 'is-done' : ''} ${st.warmup ? 'is-warmup' : ''} ${isRec ? 'is-record' : ''}" data-set="${st.uid}">
        <button class="set-num" data-set-menu aria-label="Options de la série ${esc(num)}">${num}</button>
        <span class="set-prev">${isRec ? '<span class="tag record">Record</span>' : esc(prevTxt)}</span>
        ${fields}
        <button class="set-check" data-check aria-pressed="${st.done ? 'true' : 'false'}" aria-label="Série ${esc(num)} faite">${icon('check')}</button>
      </div>`;
    }).join('');

    let head = '';
    let setsCls = '';
    if (mode === 'duree') {
      head = '<span>Série</span><span>Précédent</span><span>Durée (s)</span><span></span>';
      setsCls = 'mode-duree';
    } else if (mode === 'cardio') {
      head = '<span>Série</span><span>Précédent</span><span>Min</span><span>Km</span><span></span>';
      setsCls = 'mode-cardio';
    } else {
      head = `<span>Série</span><span>Précédent</span><span>${pdc ? 'Lest' : 'kg'}</span><span>Reps</span>${s.showRir ? '<span>RIR</span>' : ''}<span></span>`;
      setsCls = s.showRir ? 'with-rir' : '';
    }

    let extra = '';
    if (mode === 'cardio') {
      const done = item.sets.filter((x) => x.done);
      const t = done.reduce((n, x) => n + (x.t || 0), 0);
      const d = done.reduce((n, x) => n + (x.d || 0), 0);
      if (t > 0 && d > 0) extra = `<p class="ex-pace">Allure : ${esc(calc.fmtPace(t / d))}, vitesse : ${esc(calc.fmt1(d / (t / 3600)))} km/h</p>`;
    }
    const prevItem = idx > 0 ? w.items[idx - 1] : null;
    const insideCircuit = item.circuit && prevItem?.circuit && calc.itemMode(prevItem, store.getAny('exercises', prevItem.exercise_id)) === 'duree';
    const canTime = mode === 'duree' && live && !insideCircuit && item.sets.some((x) => !x.done && x.t > 0);

    return `<section class="ex" data-item="${item.uid}">
      <header class="ex-head">
        <div class="ex-titles">
          ${mode === 'reps'
            ? `<h2 class="ex-name"><button class="ex-name-btn" data-base aria-label="${esc(name)} : changer la charge de départ (actuellement ${esc(calc.baseLabel(base))})">${esc(name)}</button></h2>
               <button class="base-chip" data-base aria-hidden="true" tabindex="-1">${esc(calc.baseLabel(base))}${icon('down')}</button>`
            : `<h2 class="ex-name">${esc(name)}</h2>${item.circuit ? '<span class="tag">Circuit</span>' : ''}`}
          <p class="ex-meta">${esc(targetText(item, mode))}</p>
          <a class="tech-link" href="${esc(calc.techniqueUrl(ex, name))}" target="_blank" rel="noopener noreferrer">${icon('play')}<span>${calc.validVideoUrl(ex?.video_url) ? 'Voir ma vidéo de référence' : 'Voir la technique'}</span></a>
        </div>
        <button class="icon-btn" data-item-menu aria-label="Options de l'exercice ${esc(name)}">${icon('more')}</button>
      </header>
      ${item.progressed && !item.sets.some((x) => x.done) ? `<p class="ex-hint">Toutes tes séries ont atteint ${item.rep_max} reps la dernière fois : charge augmentée de ${esc(calc.fmt(item.progressed))} kg.</p>` : ''}
      ${ex?.notes ? `<p class="ex-notes">${esc(ex.notes)}</p>` : ''}
      ${barbell ? `<div class="plates" data-plates>${platesHtml(nextWeight(item), ex, base)}</div>` : ''}
      ${canTime ? `<button class="btn timer-btn" data-timer>${icon('play')}<span>Lancer le minuteur${item.circuit ? ' du circuit' : ''}</span></button>` : ''}
      <div class="sets ${setsCls}">
        <div class="set-head" aria-hidden="true">${head}</div>
        ${rows}
      </div>
      ${extra}
      <button class="add-set" data-add-set>${icon('add')}<span>Ajouter une série</span></button>
    </section>`;
  }

  function draw() {
    const st = calc.workoutStats(w);
    view.innerHTML = `
      ${ctx.pageHead(w.name || 'Séance', {
        back: live ? null : `/historique/${w.id}`,
        sub: sub(),
        actions: `<button class="icon-btn" data-wmenu aria-label="Options de la séance">${icon('more')}</button>
          ${live ? '<button class="btn primary small" data-finish>Terminer</button>' : `<a class="btn small" href="#/historique/${w.id}">Fermer</a>`}`,
      })}
      ${w.items.length ? w.items.map(itemHtml).join('') : `<p class="empty">Ajoute un premier exercice pour commencer.</p>`}
      <button class="btn ghost block add-ex" data-add-ex>${icon('add')}<span>Ajouter un exercice</span></button>
      ${w.notes ? `<p class="w-notes">${esc(w.notes)}</p>` : ''}
      ${live && w.items.length ? `<div class="finish-zone">
          <p>${st.sets} série${st.sets > 1 ? 's' : ''} faite${st.sets > 1 ? 's' : ''}${st.tonnage ? `, ${esc(calc.fmtTonnage(st.tonnage))} soulevés` : ''}${st.time ? `, ${esc(calc.fmtSec(st.time))} d'effort` : ''}</p>
          <button class="btn primary block" data-finish>Terminer la séance</button>
        </div>` : ''}`;
  }

  const rerender = () => {
    save();
    draw();
  };

  // --- Saisie ---
  view.addEventListener('input', (e) => {
    const inp = e.target.closest('[data-field]');
    if (!inp) return;
    const item = findItem(inp);
    const set = findSet(inp, item);
    if (!set) return;
    const v = calc.parseNum(inp.value);
    const f = inp.dataset.field;
    if (f === 'w') set.w = v;
    else if (f === 'd') set.d = v == null ? null : Math.max(0, Math.round(v * 100) / 100);
    else if (f === 'tmin') set.t = v == null ? null : Math.max(0, Math.round(v * 60));
    else set[f] = v == null ? null : Math.max(0, Math.round(v));
    if (inp.dataset.field === 'w') {
      const p = inp.closest('[data-item]').querySelector('[data-plates]');
      if (p) p.innerHTML = platesHtml(nextWeight(item), store.getAny('exercises', item.exercise_id), item.base);
    }
    pending = true;
    saveSoon();
  });
  view.addEventListener('focusin', (e) => {
    if (e.target.matches('input.num')) setTimeout(() => e.target.select(), 0);
  });
  view.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || !e.target.matches('input.num')) return;
    e.preventDefault();
    const inputs = [...view.querySelectorAll('input.num')];
    const i = inputs.indexOf(e.target);
    if (['r', 't', 'd'].includes(e.target.dataset.field)) e.target.closest('[data-set]').querySelector('[data-check]').focus();
    else if (inputs[i + 1]) inputs[i + 1].focus();
  });

  view.addEventListener('click', async (e) => {
    const t = e.target;

    if (t.closest('[data-check]')) {
      const item = findItem(t);
      const set = findSet(t, item);
      if (!set) return;
      if (!set.done) {
        const mode = calc.itemMode(item, store.getAny('exercises', item.exercise_id));
        if (!calc.setCounts({ ...set, done: true, warmup: false }, mode)) {
          const row = t.closest('[data-set]');
          row.classList.remove('shake');
          void row.offsetWidth;
          row.classList.add('shake');
          row.querySelector({ duree: '[data-field=t]', cardio: '[data-field=tmin]' }[mode] || '[data-field=r]').focus();
          return;
        }
        set.done = true;
        set.at = new Date().toISOString();
        const i = item.sets.indexOf(set);
        const nxt = item.sets[i + 1];
        if (nxt && !nxt.done) {
          for (const f of ['w', 'r', 't']) if (nxt[f] == null && set[f] != null && mode !== 'cardio') nxt[f] = set[f];
        }
        if (navigator.vibrate) navigator.vibrate(12);
        const restFor = mode === 'duree' && item.int_rest != null && nxt ? item.int_rest : item.rest_sec || s.rest;
        if (live && !set.warmup && mode !== 'cardio') ctx.rest.start(restFor);
        rerender();
        if (calc.recordsIn(w).has(`${item.uid}:${set.uid}`)) toast('Nouveau record sur cet exercice.', { kind: 'record' });
      } else {
        set.done = false;
        set.at = null;
        rerender();
      }
      return;
    }

    if (t.closest('[data-timer]')) {
      const item = findItem(t);
      save();
      ctx.rest.stop();
      runIntervals(ctx, w, item.uid, {
        onStep: () => save(),
        onEnd: () => rerender(),
      });
      return;
    }

    if (t.closest('[data-base]')) {
      const item = findItem(t);
      const ex = store.getAny('exercises', item.exercise_id);
      const v = await baseSheet(ex?.name || item.name, item.base || calc.defaultBase(ex));
      if (!v) return;
      item.base = v;
      // La barre choisie devient la barre par défaut de l'exercice pour les prochaines fois
      if (v.kind === 'bar' && ex && !ex.deleted && ex.bar_weight !== v.weight) {
        store.save('exercises', { ...ex, bar_weight: v.weight }, { silent: true });
      }
      rerender();
      return;
    }

    if (t.closest('[data-add-set]')) {
      const item = findItem(t);
      const lastSet = item.sets[item.sets.length - 1];
      const mode = calc.itemMode(item, store.getAny('exercises', item.exercise_id));
      if (mode === 'duree') item.sets.push({ uid: store.uuid(), t: lastSet?.t ?? 30, done: false, warmup: false });
      else if (mode === 'cardio') item.sets.push({ uid: store.uuid(), t: null, d: null, done: false, warmup: false });
      else item.sets.push({ uid: store.uuid(), w: lastSet?.w ?? null, r: lastSet?.r ?? null, rir: null, done: false, warmup: false });
      rerender();
      return;
    }

    if (t.closest('[data-set-menu]')) {
      const item = findItem(t);
      const set = findSet(t, item);
      const choice = await menuSheet('Série', [
        { label: set.warmup ? 'Compter comme série de travail' : 'Marquer comme échauffement', value: 'warm' },
        { label: 'Supprimer la série', value: 'del', danger: true, icon: 'trash' },
      ]);
      if (choice === 'warm') set.warmup = !set.warmup;
      if (choice === 'del') item.sets.splice(item.sets.indexOf(set), 1);
      if (choice) rerender();
      return;
    }

    if (t.closest('[data-item-menu]')) {
      const item = findItem(t);
      const idx = w.items.indexOf(item);
      const items = [];
      if (idx > 0) items.push({ label: 'Monter', value: 'up', icon: 'up' });
      if (idx < w.items.length - 1) items.push({ label: 'Descendre', value: 'down', icon: 'down' });
      items.push({ label: 'Temps de repos', value: 'rest' });
      if (calc.itemMode(item, store.getAny('exercises', item.exercise_id)) === 'duree') {
        items.push({ label: item.circuit ? 'Retirer du circuit' : 'Enchaîner en circuit avec les voisins', value: 'circuit' });
      }
      items.push({ label: 'Voir la progression', value: 'progress' });
      const exo = store.get('exercises', item.exercise_id);
      if (exo) items.push({ label: calc.validVideoUrl(exo.video_url) ? 'Changer ma vidéo de référence' : 'Ajouter ma vidéo de référence', value: 'video', icon: 'play' });
      items.push({ label: 'Retirer de la séance', value: 'remove', danger: true, icon: 'trash' });
      const name = store.getAny('exercises', item.exercise_id)?.name || item.name;
      const c = await menuSheet(name, items);
      if (c === 'up' || c === 'down') {
        const j = c === 'up' ? idx - 1 : idx + 1;
        [w.items[idx], w.items[j]] = [w.items[j], w.items[idx]];
        rerender();
      } else if (c === 'rest') {
        const v = await restSheet(item.rest_sec || s.rest);
        if (v) {
          item.rest_sec = v;
          rerender();
        }
      } else if (c === 'video') {
        const saved = await videoSheet(store.get('exercises', item.exercise_id));
        if (saved) {
          toast(saved.video_url ? 'Vidéo de référence enregistrée.' : 'Vidéo de référence retirée.');
          rerender();
        }
      } else if (c === 'circuit') {
        item.circuit = !item.circuit;
        if (item.circuit && item.int_rest == null) item.int_rest = 15;
        rerender();
      } else if (c === 'progress') {
        save();
        ctx.go(`/progres/${item.exercise_id}`);
      } else if (c === 'remove') {
        const hasDone = item.sets.some((x) => x.done);
        if (hasDone && !(await confirmSheet('Retirer l’exercice', 'Les séries déjà faites sur cet exercice seront perdues.', { ok: 'Retirer', danger: true }))) return;
        w.items.splice(idx, 1);
        rerender();
      }
      return;
    }

    if (t.closest('[data-add-ex]')) {
      const id = await pickExercise();
      const ex = id && store.get('exercises', id);
      if (!ex) return;
      const item = calc.buildItem(ex, null, store.uuid);
      w.items.push(item);
      rerender();
      view.querySelector(`[data-item="${item.uid}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (t.closest('[data-wmenu]')) {
      const c = await menuSheet(w.name || 'Séance', [
        { label: 'Renommer', value: 'rename', icon: 'edit' },
        { label: w.notes ? 'Modifier la note' : 'Ajouter une note', value: 'notes' },
        { label: 'Date et durée', value: 'date' },
        { label: live ? 'Abandonner la séance' : 'Supprimer la séance', value: 'delete', danger: true, icon: 'trash' },
      ]);
      if (c === 'rename' || c === 'notes') {
        const field = c === 'rename' ? 'name' : 'notes';
        const v = await textSheet(c === 'rename' ? 'Nom de la séance' : 'Note de séance', w[field] || '', field === 'notes');
        if (v !== null) {
          w[field] = v.trim() || (field === 'name' ? 'Séance' : '');
          rerender();
        }
      } else if (c === 'date') {
        const r = await dateSheet(w, live);
        if (r) {
          Object.assign(w, r);
          rerender();
        }
      } else if (c === 'delete') {
        const ok = await confirmSheet(live ? 'Abandonner la séance' : 'Supprimer la séance', 'La séance et toutes ses séries seront supprimées.', { ok: live ? 'Abandonner' : 'Supprimer', danger: true });
        if (!ok) return;
        store.remove('workouts', w.id);
        if (live) {
          ctx.rest.stop();
          ctx.wake.disable();
        }
        ctx.go(live ? '/seance' : '/historique');
      }
      return;
    }

    if (t.closest('[data-finish]')) finish();
  });

  view.addEventListener('change', (e) => {
    if (e.target.matches('[data-field]') && pending) save();
  });

  async function finish() {
    save();
    const doneSets = w.items.reduce((n, it) => n + it.sets.filter((x) => x.done).length, 0);
    if (!doneSets) {
      const del = await confirmSheet('Aucune série cochée', 'Coche les séries réalisées avant de terminer. Tu peux aussi abandonner cette séance vide.', { ok: 'Abandonner la séance', danger: true });
      if (del) {
        store.remove('workouts', w.id);
        ctx.rest.stop();
        ctx.wake.disable();
        ctx.go('/seance');
      }
      return;
    }
    const undone = w.items.reduce((n, it) => n + it.sets.filter((x) => !x.done).length, 0);
    const st = calc.workoutStats(w);
    const rec = calc.recordsIn(w).size;
    const ok = await openSheet({
      title: 'Terminer la séance',
      body: `<div class="figures compact">
          <div class="figure"><span class="fig-value">${esc(calc.fmtDuration(st.duration))}</span><span class="fig-label">durée</span></div>
          <div class="figure"><span class="fig-value">${st.sets}</span><span class="fig-label">séries</span></div>
          ${st.tonnage || !st.time ? `<div class="figure"><span class="fig-value">${esc(calc.fmtTonnage(st.tonnage))}</span><span class="fig-label">soulevés</span></div>` : ''}
          ${st.time ? `<div class="figure"><span class="fig-value">${esc(calc.fmtSec(st.time))}</span><span class="fig-label">d'effort</span></div>` : ''}
          ${st.dist ? `<div class="figure"><span class="fig-value">${esc(calc.fmt1(st.dist))}<small>km</small></span><span class="fig-label">parcourus</span></div>` : ''}
          ${rec ? `<div class="figure is-record"><span class="fig-value">${rec}</span><span class="fig-label">record${rec > 1 ? 's' : ''}</span></div>` : ''}
        </div>
        ${undone ? `<p class="sheet-text">${undone} série${undone > 1 ? 's' : ''} non cochée${undone > 1 ? 's' : ''} ${undone > 1 ? 'seront retirées' : 'sera retirée'}.</p>` : ''}`,
      actions: [
        { label: 'Continuer la séance', value: false },
        { label: 'Enregistrer', kind: 'primary', value: true },
      ],
    });
    if (!ok) return;
    for (const it of w.items) it.sets = it.sets.filter((x) => x.done);
    w.items = w.items.filter((it) => it.sets.length);
    w.ended_at = new Date().toISOString();
    save();
    ctx.rest.stop();
    ctx.wake.disable();
    toast(rec ? `Séance enregistrée, ${rec} record${rec > 1 ? 's' : ''} battu${rec > 1 ? 's' : ''}.` : 'Séance enregistrée.', { kind: rec ? 'record' : '' });
    ctx.go(`/historique/${w.id}`);
  }

  if (live) {
    const timer = setInterval(() => {
      const el = view.querySelector('[data-elapsed]');
      if (el) el.textContent = calc.fmtDuration(Date.now() - Date.parse(w.started_at));
    }, 15000);
    ctx.onCleanup(() => clearInterval(timer));
  }
  ctx.onCleanup(() => pending && save());

  draw();
}

// ---------- Petites feuilles de saisie ----------
function baseSheet(name, current) {
  const same = (a, b) => a.kind === b.kind && (a.kind !== 'bar' || a.weight === b.weight);
  const options = [
    ...calc.BAR_PRESETS.map(([, wt, long]) => ({ value: { kind: 'bar', weight: wt }, label: long, detail: `${calc.fmt(wt)} kg` })),
    { value: { kind: 'pdc' }, label: 'Poids du corps', detail: 'tu saisis le lest' },
    { value: { kind: 'none' }, label: 'Sans barre', detail: 'haltères, machine, poulie' },
  ];
  const customOn = current.kind === 'bar' && !calc.BAR_PRESETS.some(([, wt]) => wt === current.weight);
  return openSheet({
    title: name,
    body: `<p class="sheet-text first">Charge de départ pour cet exercice</p>
      <div class="menu-list">${options.map((o, i) => `<button class="menu-item ${same(o.value, current) ? 'is-on' : ''}" data-opt="${i}">
        <span class="mi-main">${esc(o.label)}</span><span class="mi-detail">${esc(o.detail)}</span>${same(o.value, current) ? icon('check') : ''}</button>`).join('')}</div>
      <form class="custom-bar" data-custom>
        <label class="field"><span>Autre barre (kg)</span>
          <span class="inline-input"><input name="bar" inputmode="decimal" value="${customOn ? numStr(current.weight) : ''}" placeholder="ex. 12,5"><button class="btn" type="submit">Utiliser</button></span></label>
      </form>`,
    onMount(el, api) {
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-opt]');
        if (b) api.close(options[Number(b.dataset.opt)].value);
      });
      el.querySelector('[data-custom]').addEventListener('submit', (e) => {
        e.preventDefault();
        const v = calc.parseNum(formData(el).bar);
        if (v != null && v >= 0) api.close({ kind: 'bar', weight: v });
      });
    },
  });
}

function restSheet(current) {
  const presets = [60, 90, 120, 150, 180, 240];
  return openSheet({
    title: 'Temps de repos',
    body: `<div class="chips">${presets.map((p) => `<button class="chip ${p === current ? 'is-on' : ''}" data-preset="${p}">${esc(calc.fmtRest(p))}</button>`).join('')}</div>
      <label class="field"><span>Ou en secondes</span><input name="sec" inputmode="numeric" value="${current}"></label>`,
    onMount(el, api) {
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-preset]');
        if (b) api.close(Number(b.dataset.preset));
      });
    },
    actions: [
      { label: 'Annuler', value: null },
      { label: 'Valider', kind: 'primary', handler: (el) => Math.max(5, Math.round(calc.parseNum(formData(el).sec) || current)) },
    ],
  });
}

export function textSheet(title, value, multiline = false) {
  return openSheet({
    title,
    body: multiline
      ? `<label class="field"><span class="sr-only">${esc(title)}</span><textarea name="v" rows="4" maxlength="1000" autofocus>${esc(value)}</textarea></label>`
      : `<form data-f><label class="field"><span class="sr-only">${esc(title)}</span><input name="v" maxlength="80" value="${esc(value)}" autofocus></label></form>`,
    onMount(el, api) {
      el.querySelector('[data-f]')?.addEventListener('submit', (e) => {
        e.preventDefault();
        api.close(formData(el).v);
      });
    },
    actions: [
      { label: 'Annuler', value: null },
      { label: 'Enregistrer', kind: 'primary', handler: (el) => formData(el).v },
    ],
  });
}

function toLocalInput(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function dateSheet(w, live) {
  const dur = w.ended_at ? Math.round((Date.parse(w.ended_at) - Date.parse(w.started_at)) / 60000) : null;
  return openSheet({
    title: 'Date et durée',
    body: `<label class="field"><span>Début</span><input type="datetime-local" name="start" value="${toLocalInput(w.started_at)}"></label>
      ${live ? '' : `<label class="field"><span>Durée (minutes)</span><input name="dur" inputmode="numeric" value="${dur ?? ''}"></label>`}`,
    actions: [
      { label: 'Annuler', value: null },
      {
        label: 'Enregistrer',
        kind: 'primary',
        handler(el) {
          const f = formData(el);
          const start = new Date(f.start);
          if (Number.isNaN(start.getTime())) return false;
          const out = { started_at: start.toISOString() };
          if (!live) {
            const m = calc.parseNum(f.dur);
            out.ended_at = new Date(start.getTime() + Math.max(1, m ?? dur ?? 60) * 60000).toISOString();
          }
          return out;
        },
      },
    ],
  });
}
