// Graphiques SVG légers, sans dépendance. Ligne avec réticule + info-bulle, colonnes.
import { esc } from './ui.js';

function niceTicks(min, max, count = 4) {
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    min -= pad;
    max += pad;
  }
  const span = max - min;
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const norm = raw / mag;
  const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { lo, hi, ticks };
}

const dfTick = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

/**
 * series: [{ name, points: [{t, y}], style: 'line' | 'dots' | 'line+dots', cls }]
 * La première série « line » sert à l'étiquette directe de la dernière valeur.
 */
export function lineChart(el, { series, yFormat = (v) => v, height = 220, empty = 'Pas encore de données.' }) {
  const all = series.flatMap((s) => s.points);
  if (all.length < 1) {
    el.innerHTML = `<p class="chart-empty">${esc(empty)}</p>`;
    return;
  }
  const width = Math.max(280, el.clientWidth || 600);
  const pad = { l: 46, r: 16, t: 14, b: 28 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;

  let tMin = Math.min(...all.map((p) => p.t));
  let tMax = Math.max(...all.map((p) => p.t));
  if (tMin === tMax) {
    tMin -= 86400000 * 3;
    tMax += 86400000 * 3;
  }
  const yv = all.map((p) => p.y);
  const { lo, hi, ticks } = niceTicks(Math.min(...yv), Math.max(...yv));
  const x = (t) => pad.l + ((t - tMin) / (tMax - tMin)) * w;
  const y = (v) => pad.t + h - ((v - lo) / (hi - lo || 1)) * h;

  // Graduations temporelles : 4 au plus
  const xticks = [];
  const n = Math.min(4, Math.max(2, Math.floor(w / 110)));
  for (let i = 0; i < n; i++) xticks.push(tMin + ((tMax - tMin) * i) / (n - 1));

  let svg = `<svg class="chart" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img">`;
  for (const v of ticks) {
    svg += `<line class="grid" x1="${pad.l}" x2="${width - pad.r}" y1="${y(v)}" y2="${y(v)}"/>`;
    svg += `<text class="tick" x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end">${esc(yFormat(v))}</text>`;
  }
  xticks.forEach((t, i) => {
    const anchor = i === 0 ? 'start' : i === xticks.length - 1 ? 'end' : 'middle';
    svg += `<text class="tick" x="${x(t)}" y="${height - 8}" text-anchor="${anchor}">${esc(dfTick.format(new Date(t)))}</text>`;
  });

  for (const s of series) {
    const pts = [...s.points].sort((a, b) => a.t - b.t);
    if (s.style.includes('line') && pts.length > 1) {
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.y).toFixed(1)}`).join('');
      svg += `<path class="line ${s.cls || ''}" d="${d}"/>`;
    }
    const showDots = s.style.includes('dots') || pts.length <= 1 || (s.style === 'line+dots' && pts.length <= 40);
    if (showDots) {
      for (const p of pts) svg += `<circle class="dot ${s.cls || ''}" cx="${x(p.t)}" cy="${y(p.y)}" r="${s.style === 'dots' ? 3.5 : 4}"/>`;
    }
  }

  // Étiquette directe : dernière valeur de la série principale
  const main = series.find((s) => s.style.includes('line')) || series[0];
  const lastPt = [...main.points].sort((a, b) => a.t - b.t).pop();
  if (lastPt) {
    const lx = x(lastPt.t);
    const ly = y(lastPt.y);
    svg += `<circle class="dot-end ${main.cls || ''}" cx="${lx}" cy="${ly}" r="5"/>`;
    const above = ly - pad.t > 22;
    svg += `<text class="end-label" x="${Math.min(lx, width - pad.r)}" y="${above ? ly - 11 : ly + 20}" text-anchor="end">${esc(yFormat(lastPt.y))}</text>`;
  }

  svg += `<line class="crosshair" x1="0" x2="0" y1="${pad.t}" y2="${pad.t + h}" visibility="hidden"/>`;
  svg += `<rect class="hit" x="${pad.l}" y="${pad.t}" width="${w}" height="${h}" fill="transparent"/>`;
  svg += '</svg>';

  el.innerHTML = `<div class="chart-wrap">${svg}<div class="chart-tip" hidden></div></div>`;

  // Réticule + info-bulle
  const svgEl = el.querySelector('svg');
  const tip = el.querySelector('.chart-tip');
  const cross = el.querySelector('.crosshair');
  const times = [...new Set(all.map((p) => p.t))].sort((a, b) => a - b);
  const show = (clientX) => {
    const r = svgEl.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * width;
    const tt = tMin + ((px - pad.l) / w) * (tMax - tMin);
    let best = times[0];
    for (const t of times) if (Math.abs(t - tt) < Math.abs(best - tt)) best = t;
    const cx = x(best);
    cross.setAttribute('x1', cx);
    cross.setAttribute('x2', cx);
    cross.setAttribute('visibility', 'visible');
    const rows = series
      .map((s) => {
        const p = s.points.find((q) => q.t === best);
        return p ? `<div class="tip-row"><span class="key ${s.cls || ''}"></span>${esc(s.name)} <b>${esc(yFormat(p.y))}</b>${p.note ? `<small>${esc(p.note)}</small>` : ''}</div>` : '';
      })
      .join('');
    tip.innerHTML = `<div class="tip-date">${esc(new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(best)))}</div>${rows}`;
    tip.hidden = false;
    const left = (cx / width) * r.width;
    tip.style.left = `${Math.min(Math.max(left, 70), r.width - 70)}px`;
  };
  const hide = () => {
    tip.hidden = true;
    cross.setAttribute('visibility', 'hidden');
  };
  svgEl.addEventListener('pointermove', (e) => show(e.clientX));
  svgEl.addEventListener('pointerdown', (e) => show(e.clientX));
  svgEl.addEventListener('pointerleave', hide);
}

// Colonnes simples (une série). data: [{label, value, title}]
export function columnChart(el, data, { height = 120, format = (v) => v } = {}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  el.innerHTML = `<div class="cols" style="--h:${height}px">${data
    .map((d, i) => {
      const pct = (d.value / max) * 100;
      const last = i === data.length - 1;
      return `<div class="col" title="${esc(d.title || '')}">
        <div class="col-bar-area">${last ? `<span class="col-val">${esc(format(d.value))}</span>` : ''}
          <div class="col-bar ${d.value ? '' : 'is-zero'}" style="height:${d.value ? Math.max(pct, 4) : 0}%"></div></div>
        <span class="col-label">${esc(d.label)}</span></div>`;
    })
    .join('')}</div>`;
}

// Barres horizontales étiquetées (une série)
export function barList(el, data, { format = (v) => v, empty = 'Rien sur la période.' } = {}) {
  if (!data.length) {
    el.innerHTML = `<p class="chart-empty">${esc(empty)}</p>`;
    return;
  }
  const max = Math.max(...data.map((d) => d.value));
  el.innerHTML = `<div class="hbars">${data
    .map((d) => `<div class="hbar"><span class="hbar-label">${esc(d.label)}</span>
      <span class="hbar-track"><span class="hbar-fill" style="width:${(d.value / max) * 100}%"></span></span>
      <span class="hbar-val">${esc(format(d.value))}</span></div>`)
    .join('')}</div>`;
}
