// Écran « Poids » : pesées, moyenne sur 7 jours, tendance.
import * as store from '../store.js';
import * as calc from '../calc.js';
import { esc, icon, toast, confirmSheet } from '../ui.js';
import { lineChart } from '../charts.js';
import { prefs, savePrefs, segmented, RANGES } from './progress.js';

export function renderBody(view, ctx) {
  let showAll = false;

  const draw = () => {
    const series = calc.bodyweightSeries();
    const last = series[series.length - 1];
    const today = calc.localDay();
    const todayEntry = store.get('bodyweights', today);
    const trend = calc.bodyweightTrend(series);
    const avg30 = (() => {
      if (!last) return null;
      const target = last.t - 30 * 86400000;
      let ref = null;
      for (const p of series) if (p.t <= target) ref = p;
      return ref ? last.avg - ref.avg : null;
    })();

    const range = RANGES.find((r) => r[0] === prefs.bwRange) || RANGES[0];
    const since = range[2] ? Date.now() - range[2] * 86400000 : 0;
    const pts = series.filter((p) => p.t >= since);
    const list = [...series].reverse();
    const shown = showAll ? list : list.slice(0, 10);

    view.innerHTML = `
      ${ctx.pageHead('Poids')}
      <form class="bw-form block" data-form>
        <label class="field bw-day"><span>Date</span><input type="date" name="day" value="${today}" max="${today}"></label>
        <label class="field bw-weight"><span>Poids (kg)</span>
          <input name="weight" inputmode="decimal" autocomplete="off" required value="${esc(todayEntry ? String(todayEntry.weight).replace('.', ',') : last ? String(last.weight).replace('.', ',') : '')}"></label>
        <button class="btn primary" type="submit">${todayEntry ? 'Mettre à jour' : 'Enregistrer'}</button>
      </form>
      <p class="block-sub bw-tip">Pèse-toi idéalement le matin, à jeun, dans les mêmes conditions. La moyenne sur 7 jours lisse les variations d'eau et de digestion.</p>
      ${last ? `<div class="figures">
        <div class="figure"><span class="fig-value">${esc(calc.fmt1(last.avg))}<small>kg</small></span><span class="fig-label">moyenne 7 jours</span></div>
        <div class="figure"><span class="fig-value">${trend == null ? '–' : esc(calc.fmtSigned(trend, 2))}<small>kg</small></span><span class="fig-label">par semaine, tendance sur 4 semaines</span></div>
        <div class="figure"><span class="fig-value">${avg30 == null ? '–' : esc(calc.fmtSigned(avg30))}<small>kg</small></span><span class="fig-label">en 30 jours (moyenne)</span></div>
      </div>` : ''}
      <section class="block">
        <div class="chart-controls">${segmented('Période', RANGES.map((r) => [r[0], r[1]]), prefs.bwRange)}</div>
        <h2 class="block-title">Évolution (kg)</h2>
        <div class="legend" aria-hidden="${pts.length ? 'false' : 'true'}">
          <span><span class="key s2"></span>Pesée</span><span><span class="key s1 line"></span>Moyenne 7 jours</span>
        </div>
        <div class="chart-box" data-chart></div>
      </section>
      <section class="block">
        <h2 class="block-title">Pesées</h2>
        ${list.length ? `<div class="list bw-list">${shown.map((p) => `
          <div class="list-row static">
            <span class="list-main">${esc(calc.fmtDay(calc.dayToDate(p.day)))}</span>
            <span class="list-value">${esc(calc.fmt(p.weight))} kg</span>
            <button class="icon-btn" data-del="${p.day}" aria-label="Supprimer la pesée du ${esc(calc.fmtShort(calc.dayToDate(p.day)))}">${icon('trash')}</button>
          </div>`).join('')}</div>
          ${list.length > 10 ? `<button class="btn ghost block" data-all>${showAll ? 'Afficher moins' : `Afficher les ${list.length} pesées`}</button>` : ''}` : '<p class="empty">Aucune pesée pour l’instant.</p>'}
      </section>`;

    lineChart(view.querySelector('[data-chart]'), {
      series: [
        { name: 'Pesée', style: 'dots', cls: 's2', points: pts.map((p) => ({ t: p.t, y: p.weight })) },
        { name: 'Moyenne 7 jours', style: 'line', cls: 's1', points: pts.map((p) => ({ t: p.t, y: Math.round(p.avg * 100) / 100 })) },
      ],
      yFormat: (v) => calc.fmt1(v),
      empty: 'Ajoute ta première pesée pour voir la courbe.',
    });
  };

  view.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const day = f.day.value || calc.localDay();
    const weight = calc.parseNum(f.weight.value);
    if (!weight || weight < 20 || weight > 400) {
      toast('Indique un poids entre 20 et 400 kg.');
      f.weight.focus();
      return;
    }
    store.save('bodyweights', { day, weight: Math.round(weight * 100) / 100 }, { silent: true });
    toast('Pesée enregistrée.');
    draw();
  });

  view.addEventListener('click', async (e) => {
    const s = e.target.closest('[data-seg]');
    if (s) {
      prefs.bwRange = s.dataset.v;
      savePrefs();
      draw();
      return;
    }
    if (e.target.closest('[data-all]')) {
      showAll = !showAll;
      draw();
      return;
    }
    const d = e.target.closest('[data-del]');
    if (d) {
      const ok = await confirmSheet('Supprimer la pesée', `Supprimer la pesée du ${calc.fmtFull(calc.dayToDate(d.dataset.del))} ?`, { ok: 'Supprimer', danger: true });
      if (ok) {
        store.remove('bodyweights', d.dataset.del);
        draw();
      }
    }
  });

  draw();
}
