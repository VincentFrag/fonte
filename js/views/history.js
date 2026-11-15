// Écran « Historique » : liste des séances et détail.
import * as store from '../store.js';
import * as calc from '../calc.js';
import { esc, icon, menuSheet, confirmSheet, toast } from '../ui.js';
import { workoutRowHtml, setText } from './common.js';
import { textSheet } from './workout.js';

export function renderHistory(view, ctx) {
  const list = [...calc.finishedWorkouts()].reverse();
  const groups = new Map();
  for (const w of list) {
    const d = new Date(w.started_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!groups.has(key)) groups.set(key, { label: calc.fmtMonth(d), items: [] });
    groups.get(key).items.push(w);
  }
  view.innerHTML = `
    ${ctx.pageHead('Historique', { sub: list.length ? `${list.length} séance${list.length > 1 ? 's' : ''} enregistrée${list.length > 1 ? 's' : ''}` : '' })}
    ${list.length ? [...groups.values()].map((g) => `<section class="block">
        <h2 class="block-title month">${esc(g.label)}</h2>
        <div class="hist-list">${g.items.map(workoutRowHtml).join('')}</div>
      </section>`).join('') : `<p class="empty">Tes séances terminées apparaîtront ici. <a href="#/seance">Démarrer une séance</a></p>`}`;
}

export function renderHistoryDetail(view, ctx, id) {
  const w = store.get('workouts', id);
  if (!w) {
    view.innerHTML = `${ctx.pageHead('Séance', { back: '/historique' })}<p class="empty">Cette séance a été supprimée.</p>`;
    return;
  }
  if (!w.ended_at) {
    ctx.go('/seance');
    return;
  }
  const st = calc.workoutStats(w);
  const records = calc.recordsIn(w);
  const day = calc.localDay(w.started_at);

  const items = (w.items || []).map((item) => {
    const ex = store.getAny('exercises', item.exercise_id);
    const name = ex?.name || item.name || 'Exercice supprimé';
    const mode = calc.itemMode(item, ex);
    let best = null;
    let k = 0;
    let tTot = 0;
    let dTot = 0;
    const rows = item.sets.map((s) => {
      let txt;
      if (mode === 'duree') {
        txt = calc.fmtSec(s.t);
        if (s.done && !s.warmup && s.t > (best || 0)) best = s.t;
      } else if (mode === 'cardio') {
        txt = [s.d ? `${calc.fmt(s.d)} km` : '', s.t ? calc.fmtSec(s.t) : ''].filter(Boolean).join(' en ');
        tTot += s.t || 0;
        dTot += s.d || 0;
      } else {
        const load = calc.effectiveLoad(ex, s.w, day, item.base);
        const e = !s.warmup && s.done ? calc.e1rm(load, s.r) : null;
        if (e && (!best || e > best)) best = e;
        txt = setText(ex, s.w, s.r, item.base);
      }
      const num = s.warmup ? 'É' : String(++k);
      const rec = records.has(`${item.uid}:${s.uid}`);
      return `<li class="${s.warmup ? 'is-warmup' : ''}"><span class="d-num">${num}</span>
        <span class="d-set">${esc(txt)}${s.rir != null && mode === 'reps' ? `<small>RIR ${s.rir}</small>` : ''}</span>
        ${rec ? '<span class="tag record">Record</span>' : ''}</li>`;
    }).join('');
    let summary = '';
    if (mode === 'reps' && best) summary = `1RM estimé ${calc.fmt1(best)} kg`;
    if (mode === 'duree' && best) summary = `Durée max ${calc.fmtSec(best)}`;
    if (mode === 'cardio' && tTot && dTot) summary = `Allure ${calc.fmtPace(tTot / dTot)}`;
    return `<section class="d-ex">
      <header class="d-ex-head"><h2><a href="#/progres/${item.exercise_id}">${esc(name)}</a></h2>
        ${summary ? `<span class="d-e1rm">${esc(summary)}</span>` : ''}</header>
      <ol class="d-sets">${rows}</ol>
    </section>`;
  }).join('');

  view.innerHTML = `
    ${ctx.pageHead(w.name || 'Séance', {
      back: '/historique',
      sub: `${esc(calc.fmtDate(w.started_at))}, ${esc(calc.fmtTime(w.started_at))}`,
      actions: `<button class="icon-btn" data-menu aria-label="Options de la séance">${icon('more')}</button>
        <a class="btn small" href="#/historique/${w.id}/modifier">Modifier</a>`,
    })}
    <div class="figures">
      <div class="figure"><span class="fig-value">${esc(calc.fmtDuration(st.duration))}</span><span class="fig-label">durée</span></div>
      <div class="figure"><span class="fig-value">${st.sets}</span><span class="fig-label">séries</span></div>
      ${st.tonnage || !st.time ? `<div class="figure"><span class="fig-value">${esc(calc.fmtTonnage(st.tonnage))}</span><span class="fig-label">soulevés</span></div>` : ''}
      ${st.time ? `<div class="figure"><span class="fig-value">${esc(calc.fmtSec(st.time))}</span><span class="fig-label">d'effort</span></div>` : ''}
      ${st.dist ? `<div class="figure"><span class="fig-value">${esc(calc.fmt1(st.dist))}<small>km</small></span><span class="fig-label">parcourus</span></div>` : ''}
      ${records.size ? `<div class="figure is-record"><span class="fig-value">${records.size}</span><span class="fig-label">record${records.size > 1 ? 's' : ''}</span></div>` : ''}
    </div>
    ${w.notes ? `<p class="w-notes">${esc(w.notes)}</p>` : ''}
    <div class="d-grid">${items || '<p class="empty">Aucune série enregistrée.</p>'}</div>`;

  view.addEventListener('click', async (e) => {
    if (!e.target.closest('[data-menu]')) return;
    const c = await menuSheet(w.name || 'Séance', [
      { label: 'Créer un programme à partir de cette séance', value: 'tpl' },
      { label: 'Supprimer la séance', value: 'del', danger: true, icon: 'trash' },
    ]);
    if (c === 'del') {
      if (await confirmSheet('Supprimer la séance', 'La séance et toutes ses séries seront supprimées.', { ok: 'Supprimer', danger: true })) {
        store.remove('workouts', w.id);
        toast('Séance supprimée.');
        ctx.go('/historique');
      }
    } else if (c === 'tpl') {
      const name = await textSheet('Nom du programme', w.name && w.name !== 'Séance libre' ? w.name : '');
      if (!name || !name.trim()) return;
      const t = store.save('templates', {
        id: store.uuid(),
        name: name.trim(),
        position: store.all('templates').length,
        notes: '',
        items: (w.items || []).map((it) => {
          const work = it.sets.filter((s) => !s.warmup);
          const mode = calc.itemMode(it, store.getAny('exercises', it.exercise_id));
          if (mode === 'duree') {
            return { exercise_id: it.exercise_id, sets: work.length || 3, target_t: work[0]?.t ?? 30, int_rest: it.int_rest ?? null, circuit: !!it.circuit, rest_sec: it.rest_sec || calc.settings().rest };
          }
          if (mode === 'cardio') return { exercise_id: it.exercise_id, sets: work.length || 1, rest_sec: it.rest_sec || calc.settings().rest };
          const reps = work.map((s) => s.r).filter(Boolean);
          return {
            exercise_id: it.exercise_id,
            sets: work.length || it.sets.length,
            rep_min: it.rep_min ?? (reps.length ? Math.min(...reps) : 8),
            rep_max: it.rep_max ?? (reps.length ? Math.max(...reps) : 12),
            rest_sec: it.rest_sec || calc.settings().rest,
          };
        }),
      });
      toast('Programme créé.');
      ctx.go(`/programmes/${t.id}`);
    }
  });
}
