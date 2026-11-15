// Écran « Progrès » : vue d'ensemble et progression par exercice.
import * as store from '../store.js';
import * as calc from '../calc.js';
import { esc, icon } from '../ui.js';
import { lineChart, barList, columnChart } from '../charts.js';
import { setText } from './common.js';
import { t, tp } from '../i18n.js';

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
  return `<div class="seg" role="radiogroup" aria-label="${esc(t(name))}">${options
    .map(([v, label]) => `<button role="radio" aria-checked="${v === current}" data-seg="${esc(name)}" data-v="${v}">${esc(t(label))}</button>`)
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
    ${ctx.pageHead(t('Progrès'))}
    <div class="p-grid">
      <section class="block">
        <h2 class="block-title">${t('Cette semaine')}</h2>
        <div class="figures">
          <div class="figure"><span class="fig-value">${week.count}</span><span class="fig-label">${tp(week.count, 'séance', 'séances')}</span></div>
          <div class="figure"><span class="fig-value">${week.sets}</span><span class="fig-label">${tp(week.sets, 'série', 'séries')}</span></div>
          <div class="figure"><span class="fig-value">${esc(calc.fmtTonnage(week.tonnage))}</span><span class="fig-label">${t('soulevés')}</span></div>
        </div>
      </section>
      <section class="block">
        <h2 class="block-title">${t('Séances par semaine')}</h2>
        <p class="block-sub">${t('12 dernières semaines, repérées par la date du lundi. Survole une colonne pour le détail.')}</p>
        <div data-weeks></div>
      </section>
      <section class="block">
        <h2 class="block-title">${t('Séries par groupe musculaire')}</h2>
        <p class="block-sub">${t('7 derniers jours, séries de travail cochées. Repère courant : 10 à 20 séries par semaine et par muscle pour progresser.')}</p>
        <div data-muscles></div>
      </section>
      <section class="block">
        <h2 class="block-title">${t('Exercices')}</h2>
        ${exercises.length ? `<div class="list">${exercises.map(({ ex, b }) => `
          <a class="list-row" href="#/progres/${ex.id}">
            <span class="list-main">${esc(ex.name)}<small>${esc(tp(b.sessions, '{n} séance, dernière {when}', '{n} séances, dernière {when}', { when: calc.relDays(b.last) }))}</small></span>
            <span class="list-value">${b.mode === 'duree'
              ? `${b.maxT ? esc(calc.fmtSec(b.maxT.value)) : '–'}<small>${t('durée max')}</small>`
              : b.mode === 'cardio'
                ? `${b.dist ? `${esc(calc.fmt1(b.dist.value))} km` : '–'}<small>${t('distance max')}</small>`
                : `${b.e1rm ? `${esc(calc.fmt0(b.e1rm.value))} kg` : '–'}<small>${t('1RM estimé')}</small>`}</span>
            ${icon('chevron', 'row-chevron')}
          </a>`).join('')}</div>` : `<p class="empty">${t('Termine une séance pour voir ta progression ici.')}</p>`}
      </section>
    </div>`;

  columnChart(view.querySelector('[data-weeks]'), perWeek.map((p) => ({
    label: String(p.week.getDate()),
    value: p.count,
    title: tp(p.count, 'Semaine du {date} : {n} séance', 'Semaine du {date} : {n} séances', { date: calc.fmtShort(p.week) }),
  })));
  barList(view.querySelector('[data-muscles]'), muscles.map(([m, n]) => ({ label: calc.muscleLabel(m), value: n })), {
    empty: t('Aucune série cochée ces 7 derniers jours.'),
  });
}

const METRICS = {
  reps: [
    ['e1rm', '1RM estimé', 'Estimation de la charge maximale sur 1 répétition (formule d’Epley), à partir de ta meilleure série de chaque séance.'],
    ['load', 'Charge max', 'Charge la plus lourde de chaque séance.'],
    ['tonnage', 'Volume', 'Charge × répétitions, additionnées sur les séries de travail.'],
    ['reps', 'Reps max', 'Plus grand nombre de répétitions en une série.'],
  ],
  duree: [
    ['maxT', 'Durée max', 'Effort le plus long de chaque séance.'],
    ['totalT', 'Durée totale', 'Temps d’effort additionné sur la séance.'],
  ],
  cardio: [
    ['dist', 'Distance', 'Distance parcourue à chaque séance.'],
    ['time', 'Durée', 'Durée totale de chaque séance.'],
    ['pace', 'Allure', 'Temps moyen pour 1 km : plus la courbe descend, plus tu vas vite.'],
  ],
};

function metricValue(h, metric) {
  return {
    e1rm: h.bestE1rm, load: h.maxLoad, tonnage: h.tonnage, reps: h.maxReps,
    maxT: h.maxT, totalT: h.totalT, dist: h.dist, time: h.time, pace: h.pace,
  }[metric];
}

function metricFormat(metric) {
  if (metric === 'reps') return (v) => calc.fmt0(v);
  if (metric === 'tonnage') return (v) => calc.fmtTonnage(v);
  if (metric === 'maxT' || metric === 'totalT' || metric === 'time') return (v) => calc.fmtSec(v);
  if (metric === 'pace') return (v) => calc.fmtPace(v).replace(' /km', '');
  if (metric === 'dist') return (v) => `${calc.fmt1(v)}`;
  return (v) => `${calc.fmt1(v)}`;
}

function metricUnit(metric) {
  return { e1rm: ' (kg)', load: ' (kg)', dist: ' (km)', pace: ' (min/km)' }[metric] || '';
}

function sessionText(ex, h) {
  if (h.mode === 'duree') return h.sets.map((x) => calc.fmtSec(x.t));
  if (h.mode === 'cardio') return h.sets.map((x) => [x.d ? `${calc.fmt(x.d)} km` : '', x.t ? calc.fmtSec(x.t) : ''].filter(Boolean).join(t(' en ')));
  return h.sets.map((x) => setText(ex, x.w, x.r, h.base).replace(' kg', ''));
}

export function renderExerciseProgress(view, ctx, id) {
  const ex = store.getAny('exercises', id);
  if (!ex) {
    view.innerHTML = `${ctx.pageHead(t('Exercice'), { back: '/progres' })}<p class="empty">${t('Exercice introuvable.')}</p>`;
    return;
  }
  const b = calc.bests(id);
  const mode = b?.mode || calc.modeOf(ex);
  const hist = calc.exerciseHistory(id).filter((h) => h.mode === mode);
  const metrics = METRICS[mode];
  const pdc = hist.some((h) => h.sets.some((x) => x.pdc));

  const figures = () => {
    if (!b) return '';
    const f = (value, unit, label) => `<div class="figure"><span class="fig-value">${value}${unit ? `<small>${unit}</small>` : ''}</span><span class="fig-label">${label}</span></div>`;
    const sessions = f(b.sessions, '', esc(tp(b.sessions, 'séance depuis le {date}', 'séances depuis le {date}', { date: calc.fmtShort(b.first) })));
    if (mode === 'duree') {
      return `<div class="figures">
        ${f(b.maxT ? esc(calc.fmtSec(b.maxT.value)) : '–', '', `${t('effort le plus long')}${b.maxT ? `, ${esc(calc.fmtShort(b.maxT.date))}` : ''}`)}
        ${f(b.totalT ? esc(calc.fmtSec(b.totalT.value)) : '–', '', t('meilleur total en une séance'))}
        ${sessions}</div>`;
    }
    if (mode === 'cardio') {
      return `<div class="figures">
        ${f(b.dist ? esc(calc.fmt1(b.dist.value)) : '–', 'km', `${t('plus longue distance')}${b.dist ? `, ${esc(calc.fmtShort(b.dist.date))}` : ''}`)}
        ${f(b.pace ? esc(calc.fmtPace(b.pace.value)) : '–', '', t('meilleure allure'))}
        ${sessions}</div>`;
    }
    return `<div class="figures">
      ${f(b.e1rm ? esc(calc.fmt1(b.e1rm.value)) : '–', 'kg', `${t('meilleur 1RM estimé')}${b.e1rm ? `, ${esc(calc.fmtShort(b.e1rm.date))}` : ''}`)}
      ${f(b.load ? esc(calc.fmt(b.load.value)) : '–', 'kg', `${t('charge max')}${b.load?.set ? `, ${tp(b.load.set.r, '{n} rep', '{n} reps')}` : ''}`)}
      ${f(b.tonnage ? esc(calc.fmtTonnage(b.tonnage.value)) : '–', '', t('meilleur volume en une séance'))}
      ${sessions}</div>`;
  };

  const draw = () => {
    const metric = metrics.find((m) => m[0] === prefs.metric) ? prefs.metric : metrics[0][0];
    const [, metricNameFr, metricHelpFr] = metrics.find((m) => m[0] === metric);
    const metricName = t(metricNameFr);
    const metricHelp = t(metricHelpFr);
    const range = RANGES.find((r) => r[0] === prefs.range) || RANGES[1];
    const since = range[2] ? Date.now() - range[2] * 86400000 : 0;
    const pts = hist.filter((h) => Date.parse(h.date) >= since);
    const yf = metricFormat(metric);
    const summaryHead = t({ reps: '1RM est.', duree: 'Max', cardio: 'Allure' }[mode]);
    const summaryVal = (h) => (mode === 'reps' ? (h.bestE1rm ? calc.fmt1(h.bestE1rm) : '–') : mode === 'duree' ? calc.fmtSec(h.maxT) : calc.fmtPace(h.pace));
    const totalHead = t({ reps: 'Volume', duree: 'Total', cardio: 'Distance' }[mode]);
    const totalVal = (h) => (mode === 'reps' ? calc.fmtTonnage(h.tonnage) : mode === 'duree' ? calc.fmtSec(h.totalT) : `${calc.fmt1(h.dist)} km`);

    view.innerHTML = `
      ${ctx.pageHead(ex.name, { back: '/progres', sub: esc([ex.muscle && calc.muscleLabel(ex.muscle), calc.EQUIPMENT[ex.equipment] && calc.equipLabel(ex.equipment)].filter(Boolean).join(', ')) })}
      ${figures()}
      <section class="block">
        <div class="chart-controls">
          ${metrics.length > 1 ? segmented('Mesure', metrics.map((m) => [m[0], m[1]]), metric) : ''}
          ${segmented('Période', RANGES.map((r) => [r[0], r[1]]), prefs.range)}
        </div>
        <h2 class="block-title">${esc(metricName)}${metricUnit(metric)}</h2>
        <p class="block-sub">${esc(metricHelp)}${pdc && mode === 'reps' ? ` ${t('Poids du corps inclus.')}` : ''}</p>
        <div class="chart-box" data-chart></div>
      </section>
      <section class="block">
        <h2 class="block-title">${t('Séances')}</h2>
        ${hist.length ? `<div class="table-wrap"><table class="table">
          <thead><tr><th scope="col">${t('Date')}</th><th scope="col">${t('Séries')}</th><th scope="col" class="num">${summaryHead}</th><th scope="col" class="num">${totalHead}</th></tr></thead>
          <tbody>${[...hist].reverse().map((h) => `<tr>
            <td><a href="#/historique/${h.workoutId}">${esc(calc.fmtDay(h.date))}</a></td>
            <td>${sessionText(ex, h).map(esc).join('<br>')}</td>
            <td class="num">${esc(summaryVal(h))}</td>
            <td class="num">${esc(totalVal(h))}</td></tr>`).join('')}</tbody>
        </table></div>` : `<p class="empty">${t('Aucune séance terminée avec cet exercice.')}</p>`}
      </section>`;

    lineChart(view.querySelector('[data-chart]'), {
      series: [{
        name: metricName,
        style: 'line+dots',
        cls: 's1',
        points: pts.filter((h) => metricValue(h, metric) != null).map((h) => ({ t: Date.parse(h.date), y: metricValue(h, metric) })),
      }],
      yFormat: yf,
      empty: hist.length ? t('Aucune séance sur cette période.') : t('Pas encore de séance terminée avec cet exercice.'),
    });
  };

  view.addEventListener('click', (e) => {
    const sg = e.target.closest('[data-seg]');
    if (!sg) return;
    if (sg.dataset.seg === 'Mesure') prefs.metric = sg.dataset.v;
    else prefs.range = sg.dataset.v;
    savePrefs();
    draw();
  });
  draw();
}
