// Écran « Progrès » : vue d'ensemble et progression par exercice.
import * as store from '../store.js';
import * as calc from '../calc.js';
import { esc, icon } from '../ui.js';
import { lineChart, barList, columnChart } from '../charts.js';
import { setText } from './common.js';

const RANGES = [
  ['3m', '3 mois', 91],
  ['6m', '6 mois', 182],
  ['1a', '1 an', 365],
  ['tout', 'Tout', null],
];

const prefs = { metric: 'e1rm', range: '6m', bwRange: '3m' };
try {
  Object.assign(prefs, JSON.parse(localStorage.getItem('fonte-chart-prefs') || '{}'));
} catch {}
export function savePrefs() {
  try { localStorage.setItem('fonte-chart-prefs', JSON.stringify(prefs)); } catch {}
}
export { prefs, RANGES };

export function segmented(name, options, current) {
  return `<div class="seg" role="radiogroup" aria-label="${esc(name)}">${options
    .map(([v, label]) => `<button role="radio" aria-checked="${v === current}" data-seg="${esc(name)}" data-v="${v}">${esc(label)}</button>`)
    .join('')}</div>`;
}

export function renderProgress(view, ctx) {
  const week = calc.weekSummary();
  const muscles = calc.setsPerMuscle(7);
  const perWeek = calc.workoutsPerWeek(12);
  const exercises = store.all('exercises')
    .map((ex) => ({ ex, b: calc.bests(ex.id) }))
    .filter((x) => x.b)
    .sort((a, b) => Date.parse(b.b.last) - Date.parse(a.b.last));

  view.innerHTML = `
    ${ctx.pageHead('Progrès')}
    <div class="p-grid">
      <section class="block">
        <h2 class="block-title">Cette semaine</h2>
        <div class="figures">
          <div class="figure"><span class="fig-value">${week.count}</span><span class="fig-label">séance${week.count > 1 ? 's' : ''}</span></div>
          <div class="figure"><span class="fig-value">${week.sets}</span><span class="fig-label">séries</span></div>
          <div class="figure"><span class="fig-value">${esc(calc.fmtTonnage(week.tonnage))}</span><span class="fig-label">soulevés</span></div>
        </div>
      </section>
      <section class="block">
        <h2 class="block-title">Séances par semaine</h2>
        <p class="block-sub">12 dernières semaines, repérées par la date du lundi. Survole une colonne pour le détail.</p>
        <div data-weeks></div>
      </section>
      <section class="block">
        <h2 class="block-title">Séries par groupe musculaire</h2>
        <p class="block-sub">7 derniers jours, séries de travail cochées. Repère courant : 10 à 20 séries par semaine et par muscle pour progresser.</p>
        <div data-muscles></div>
      </section>
      <section class="block">
        <h2 class="block-title">Exercices</h2>
        ${exercises.length ? `<div class="list">${exercises.map(({ ex, b }) => `
          <a class="list-row" href="#/progres/${ex.id}">
            <span class="list-main">${esc(ex.name)}<small>${b.sessions} séance${b.sessions > 1 ? 's' : ''}, dernière ${esc(calc.relDays(b.last))}</small></span>
            <span class="list-value">${b.e1rm ? `${esc(calc.fmt0(b.e1rm.value))} kg` : '–'}<small>1RM estimé</small></span>
            ${icon('chevron', 'row-chevron')}
          </a>`).join('')}</div>` : '<p class="empty">Termine une séance pour voir ta progression ici.</p>'}
      </section>
    </div>`;

  columnChart(view.querySelector('[data-weeks]'), perWeek.map((p) => ({
    label: String(p.week.getDate()),
    value: p.count,
    title: `Semaine du ${calc.fmtShort(p.week)} : ${p.count} séance${p.count > 1 ? 's' : ''}`,
  })));
  barList(view.querySelector('[data-muscles]'), muscles.map(([m, n]) => ({ label: m, value: n })), {
    empty: 'Aucune série cochée ces 7 derniers jours.',
  });
}

const METRICS = [
  ['e1rm', '1RM estimé'],
  ['load', 'Charge max'],
  ['tonnage', 'Volume'],
  ['reps', 'Reps max'],
];

export function renderExerciseProgress(view, ctx, id) {
  const ex = store.getAny('exercises', id);
  if (!ex) {
    view.innerHTML = `${ctx.pageHead('Exercice', { back: '/progres' })}<p class="empty">Exercice introuvable.</p>`;
    return;
  }
  const hist = calc.exerciseHistory(id);
  const b = calc.bests(id);
  const pdc = ex.equipment === 'pdc';

  const draw = () => {
    const range = RANGES.find((r) => r[0] === prefs.range) || RANGES[1];
    const since = range[2] ? Date.now() - range[2] * 86400000 : 0;
    const pts = hist.filter((h) => Date.parse(h.date) >= since);
    const val = (h) => ({ e1rm: h.bestE1rm, load: h.maxLoad, tonnage: h.tonnage, reps: h.maxReps }[prefs.metric]);
    const metricName = METRICS.find((m) => m[0] === prefs.metric)[1];
    const yf = prefs.metric === 'reps' ? (v) => calc.fmt0(v) : prefs.metric === 'tonnage' ? (v) => calc.fmtTonnage(v) : (v) => `${calc.fmt1(v)}`;

    view.innerHTML = `
      ${ctx.pageHead(ex.name, { back: '/progres', sub: esc([ex.muscle, calc.EQUIPMENT[ex.equipment]].filter(Boolean).join(', ')) })}
      ${b ? `<div class="figures">
        <div class="figure"><span class="fig-value">${b.e1rm ? esc(calc.fmt1(b.e1rm.value)) : '–'}<small>kg</small></span><span class="fig-label">meilleur 1RM estimé${b.e1rm ? `, ${esc(calc.fmtShort(b.e1rm.date))}` : ''}</span></div>
        <div class="figure"><span class="fig-value">${b.load ? esc(calc.fmt(b.load.value)) : '–'}<small>kg</small></span><span class="fig-label">charge max${b.load?.set ? `, ${b.load.set.r} rep${b.load.set.r > 1 ? 's' : ''}` : ''}</span></div>
        <div class="figure"><span class="fig-value">${esc(calc.fmtTonnage(b.tonnage.value))}</span><span class="fig-label">meilleur volume en une séance</span></div>
        <div class="figure"><span class="fig-value">${b.sessions}</span><span class="fig-label">séance${b.sessions > 1 ? 's' : ''} depuis le ${esc(calc.fmtShort(b.first))}</span></div>
      </div>` : ''}
      <section class="block">
        <div class="chart-controls">
          ${segmented('Mesure', METRICS, prefs.metric)}
          ${segmented('Période', RANGES.map((r) => [r[0], r[1]]), prefs.range)}
        </div>
        <h2 class="block-title">${esc(metricName)}${prefs.metric === 'tonnage' || prefs.metric === 'reps' ? '' : ' (kg)'}</h2>
        <p class="block-sub">${prefs.metric === 'e1rm' ? 'Estimation de la charge maximale sur 1 répétition (formule d’Epley), à partir de ta meilleure série de chaque séance.' : prefs.metric === 'tonnage' ? 'Charge × répétitions, additionnées sur les séries de travail.' : prefs.metric === 'load' ? 'Charge la plus lourde de chaque séance.' : 'Plus grand nombre de répétitions en une série.'}${pdc ? ' Poids du corps inclus.' : ''}</p>
        <div class="chart-box" data-chart></div>
      </section>
      <section class="block">
        <h2 class="block-title">Séances</h2>
        ${hist.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th scope="col">Date</th><th scope="col">Séries</th><th scope="col" class="num">1RM est.</th><th scope="col" class="num">Volume</th></tr></thead>
          <tbody>${[...hist].reverse().map((h) => `<tr>
            <td><a href="#/historique/${h.workoutId}">${esc(calc.fmtDay(h.date))}</a></td>
            <td>${h.sets.map((s) => esc(setText(ex, s.w, s.r).replace(' kg', ''))).join('<br>')}</td>
            <td class="num">${h.bestE1rm ? esc(calc.fmt1(h.bestE1rm)) : '–'}</td>
            <td class="num">${esc(calc.fmtTonnage(h.tonnage))}</td></tr>`).join('')}</tbody>
        </table></div>` : '<p class="empty">Aucune séance terminée avec cet exercice.</p>'}
      </section>`;

    lineChart(view.querySelector('[data-chart]'), {
      series: [{
        name: metricName,
        style: 'line+dots',
        cls: 's1',
        points: pts.filter((h) => val(h) != null).map((h) => ({ t: Date.parse(h.date), y: val(h) })),
      }],
      yFormat: yf,
      empty: hist.length ? 'Aucune séance sur cette période.' : 'Pas encore de séance terminée avec cet exercice.',
    });
  };

  view.addEventListener('click', (e) => {
    const s = e.target.closest('[data-seg]');
    if (!s) return;
    if (s.dataset.seg === 'Mesure') prefs.metric = s.dataset.v;
    else prefs.range = s.dataset.v;
    savePrefs();
    draw();
  });
  draw();
}
