// Éléments partagés : choix d'un exercice, fiche exercice, disques sur la barre.
import * as store from '../store.js';
import * as calc from '../calc.js';
import { esc, icon, openSheet, formData, toast } from '../ui.js';

export function sortedExercises() {
  return store.all('exercises').sort((a, b) => a.name.localeCompare(b.name, 'fr'));
}

function groupByMuscle(list) {
  const groups = new Map();
  for (const m of calc.MUSCLES) groups.set(m, []);
  for (const ex of list) {
    const m = calc.MUSCLES.includes(ex.muscle) ? ex.muscle : 'Autre';
    groups.get(m).push(ex);
  }
  return [...groups.entries()].filter(([, l]) => l.length);
}

export function exerciseListHtml(list, { attr = 'data-pick' } = {}) {
  return groupByMuscle(list)
    .map(([m, l]) => `<div class="ex-group"><h3 class="group-title">${esc(m)}</h3>${l
      .map((ex) => `<button class="list-row" ${attr}="${ex.id}"><span class="list-main">${esc(ex.name)}</span><span class="list-meta">${esc(calc.EQUIPMENT[ex.equipment] || '')}${ex.equipment === 'barre' && ex.bar_weight != null ? ` ${esc(calc.fmt(ex.bar_weight))} kg` : ''}</span></button>`)
      .join('')}</div>`)
    .join('');
}

// Ouvre la liste des exercices et renvoie l'id choisi (ou null).
export function pickExercise(title = 'Ajouter un exercice') {
  return openSheet({
    title,
    wide: true,
    body: `<label class="search"><span class="sr-only">Rechercher</span>
        <input type="search" placeholder="Rechercher un exercice" autocomplete="off" data-q autofocus></label>
      <div class="pick-list" data-list></div>`,
    onMount(el, api) {
      const list = el.querySelector('[data-list]');
      const q = el.querySelector('[data-q]');
      const draw = () => {
        const term = q.value.trim().toLowerCase();
        const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        const found = sortedExercises().filter((ex) => !term || norm(ex.name).includes(norm(term)));
        list.innerHTML = `${found.length ? exerciseListHtml(found) : `<p class="empty">Aucun exercice ne correspond.</p>`}
          <button class="btn ghost block" data-create>${icon('add')}<span>${term ? `Créer « ${esc(q.value.trim())} »` : 'Créer un exercice'}</span></button>`;
      };
      q.addEventListener('input', draw);
      draw();
      list.addEventListener('click', async (e) => {
        const p = e.target.closest('[data-pick]');
        if (p) return api.close(p.dataset.pick);
        if (e.target.closest('[data-create]')) {
          const ex = await editExercise(null, q.value.trim());
          if (ex) api.close(ex.id);
        }
      });
    },
  });
}

// Fiche exercice : création ou modification. Renvoie l'exercice enregistré.
export function editExercise(ex, presetName = '') {
  const e = ex || { name: presetName, muscle: '', equipment: 'barre', increment: null, notes: '' };
  const inc = e.increment ?? calc.defaultIncrement(e.equipment);
  return openSheet({
    title: ex ? 'Modifier l’exercice' : 'Nouvel exercice',
    body: `<form class="form" data-form>
      <label class="field"><span>Nom</span><input name="name" required maxlength="80" value="${esc(e.name)}" ${ex ? '' : 'autofocus'}></label>
      <label class="field"><span>Groupe musculaire</span><select name="muscle">
        ${calc.MUSCLES.map((m) => `<option ${m === e.muscle ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></label>
      <label class="field"><span>Type</span><select name="equipment" data-equip>
        ${Object.entries(calc.EQUIPMENT).map(([k, v]) => `<option value="${k}" ${k === e.equipment ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
      <div class="field" data-bar-field ${e.equipment === 'barre' ? '' : 'hidden'}>
        <label for="ex-bar">Poids de la barre (kg)</label>
        <div class="chips tight">${calc.BAR_PRESETS.map(([n, w]) => `<button type="button" class="chip ${w === (e.bar_weight ?? calc.settings().bar) ? 'is-on' : ''}" data-bar-preset="${w}">${esc(n)} ${esc(calc.fmt(w))}</button>`).join('')}</div>
        <input id="ex-bar" name="bar_weight" inputmode="decimal" value="${esc(String(e.bar_weight ?? calc.settings().bar).replace('.', ','))}">
        <small>Sert au calcul des disques à charger. Les barres varient d'une salle à l'autre : pèse-la ou regarde l'étiquette.</small>
      </div>
      <p class="field-help" data-pdc-help ${e.equipment === 'pdc' ? '' : 'hidden'}>Au poids du corps, tu saisis le lest (0 sans lest). Les calculs ajoutent ton dernier poids enregistré.</p>
      <label class="field" data-inc-field ${['duree', 'cardio'].includes(e.equipment) ? 'hidden' : ''}><span>Incrément de charge (kg)</span><input name="increment" inputmode="decimal" value="${esc(String(inc).replace('.', ','))}">
        <small>Utilisé pour proposer la charge suivante quand tu atteins le haut de ta fourchette de répétitions.</small></label>
      <label class="field"><span>Notes</span><textarea name="notes" rows="2" maxlength="500" placeholder="Réglages machine, prise, tempo…">${esc(e.notes || '')}</textarea></label>
    </form>`,
    onMount(el) {
      const sel = el.querySelector('[data-equip]');
      sel.addEventListener('change', () => {
        el.querySelector('[data-pdc-help]').hidden = sel.value !== 'pdc';
        el.querySelector('[data-bar-field]').hidden = sel.value !== 'barre';
        el.querySelector('[data-inc-field]').hidden = ['duree', 'cardio'].includes(sel.value);
        el.querySelector('[name=increment]').value = String(calc.defaultIncrement(sel.value)).replace('.', ',');
      });
      el.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-bar-preset]');
        if (!b) return;
        el.querySelector('[name=bar_weight]').value = b.dataset.barPreset.replace('.', ',');
        el.querySelectorAll('[data-bar-preset]').forEach((x) => x.classList.toggle('is-on', x === b));
      });
      el.querySelector('[data-form]').addEventListener('submit', (ev) => {
        ev.preventDefault();
        el.querySelector('[data-action="1"]').click();
      });
    },
    actions: [
      { label: 'Annuler', value: null },
      {
        label: 'Enregistrer',
        kind: 'primary',
        handler(el) {
          const f = formData(el);
          const name = f.name.trim();
          if (!name) {
            el.querySelector('[name=name]').focus();
            return false;
          }
          const dup = store.all('exercises').find((x) => x.name.toLowerCase() === name.toLowerCase() && x.id !== e.id);
          if (dup) {
            toast(`« ${dup.name} » existe déjà.`);
            return false;
          }
          return store.save('exercises', {
            ...(ex || { id: store.uuid() }),
            name,
            muscle: f.muscle,
            equipment: f.equipment,
            increment: calc.parseNum(f.increment) ?? calc.defaultIncrement(f.equipment),
            bar_weight: f.equipment === 'barre' ? (calc.parseNum(f.bar_weight) ?? calc.settings().bar) : (ex?.bar_weight ?? null),
            notes: f.notes.trim(),
          });
        },
      },
    ],
  });
}

export function addBaseExercises() {
  const existing = new Set(store.all('exercises').map((x) => x.name.toLowerCase()));
  let n = 0;
  for (const [name, muscle, equipment] of calc.BASE_EXERCISES) {
    if (existing.has(name.toLowerCase())) continue;
    store.save('exercises', { id: store.uuid(), name, muscle, equipment, increment: calc.defaultIncrement(equipment), notes: '' });
    n++;
  }
  return n;
}

const dfWd = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });

export function workoutRowHtml(w) {
  const st = calc.workoutStats(w);
  const rec = calc.recordsIn(w).size;
  const d = new Date(w.started_at);
  return `<a class="hist-row" href="#/historique/${w.id}">
    <span class="hist-date"><span class="hist-daynum">${d.getDate()}</span><span class="hist-wd">${esc(dfWd.format(d).replace('.', ''))}</span></span>
    <span class="hist-body"><span class="hist-name">${esc(w.name || 'Séance')}</span>
      <span class="hist-meta">${calc.fmtDuration(st.duration)}, ${st.sets} série${st.sets > 1 ? 's' : ''}${st.tonnage ? `, ${calc.fmtTonnage(st.tonnage)}` : ''}${st.dist ? `, ${calc.fmt1(st.dist)} km` : ''}</span></span>
    ${rec ? `<span class="tag record">${rec} record${rec > 1 ? 's' : ''}</span>` : ''}
    ${icon('chevron', 'row-chevron')}
  </a>`;
}

export function setText(ex, w, r, base = null) {
  const load = calc.isPdc(ex, base) ? (w ? `PDC + ${calc.fmt(w)} kg` : 'PDC') : `${calc.fmt(w)} kg`;
  return `${load} × ${r ?? '–'}`;
}

// Disques à charger de chaque côté de la barre
export function platesHtml(total, ex, base = null) {
  const s = calc.settings();
  const bar = base?.kind === 'bar' ? base.weight : calc.barWeightOf(ex);
  const res = calc.platesFor(total, bar, s.plates);
  if (total == null) return '';
  if (!res) return `<span class="plates-text">Moins que la barre (${calc.fmt(bar)} kg)</span>`;
  if (!res.plates.length) return `<span class="plates-text">Barre seule (${calc.fmt(bar)} kg)</span>`;
  const maxP = Math.max(...s.plates);
  const glyphs = res.plates
    .map((p) => {
      const hgt = 12 + 26 * Math.sqrt(p / maxP);
      const wid = p >= 10 ? 9 : p >= 2.5 ? 6 : 5;
      return `<span class="plate" style="--c:${calc.PLATE_COLORS[p] || '#9AA1A9'};height:${hgt.toFixed(1)}px;width:${wid}px"></span>`;
    })
    .join('');
  return `<span class="bar-glyph" aria-hidden="true"><span class="bar-sleeve"></span>${glyphs}<span class="bar-collar"></span><span class="bar-tip"></span></span>
    <span class="plates-text">Barre ${calc.fmt(bar)} kg, par côté : ${res.plates.map((p) => calc.fmt(p)).join(' + ')}${res.rest ? ` <em>(reste ${calc.fmt(res.rest)} kg)</em>` : ''}</span>`;
}
