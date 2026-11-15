// Éléments partagés : choix d'un exercice, fiche exercice, disques sur la barre.
import * as store from '../store.js';
import * as calc from '../calc.js';
import { esc, icon, openSheet, formData, toast } from '../ui.js';
import { t, tp, lang, numInput, dn, nameVariants } from '../i18n.js';

export function sortedExercises() {
  return store.all('exercises').sort((a, b) => dn(a.name).localeCompare(dn(b.name), lang()));
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
    .map(([m, l]) => `<div class="ex-group"><h3 class="group-title">${esc(calc.muscleLabel(m))}</h3>${l
      .map((ex) => `<button class="list-row" ${attr}="${ex.id}"><span class="list-main">${esc(dn(ex.name))}</span><span class="list-meta">${esc(calc.equipLabel(ex.equipment))}${ex.equipment === 'barre' && ex.bar_weight != null ? ` ${esc(calc.fmt(ex.bar_weight))} kg` : ''}</span></button>`)
      .join('')}</div>`)
    .join('');
}

// Ouvre la liste des exercices et renvoie l'id choisi (ou null).
export function pickExercise(title = t('Ajouter un exercice')) {
  return openSheet({
    title,
    wide: true,
    body: `<label class="search"><span class="sr-only">${t('Rechercher')}</span>
        <input type="search" placeholder="${esc(t('Rechercher un exercice'))}" autocomplete="off" data-q autofocus></label>
      <div class="pick-list" data-list></div>`,
    onMount(el, api) {
      const list = el.querySelector('[data-list]');
      const q = el.querySelector('[data-q]');
      const draw = () => {
        const term = q.value.trim().toLowerCase();
        const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        const found = sortedExercises().filter((ex) => !term || norm(`${ex.name} ${dn(ex.name)}`).includes(norm(term)));
        list.innerHTML = `${found.length ? exerciseListHtml(found) : `<p class="empty">${t('Aucun exercice ne correspond.')}</p>`}
          <button class="btn ghost block" data-create>${icon('add')}<span>${term ? esc(t('Créer « {name} »', { name: q.value.trim() })) : t('Créer un exercice')}</span></button>`;
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
    title: ex ? t('Modifier l’exercice') : t('Nouvel exercice'),
    body: `<form class="form" data-form>
      <label class="field"><span>${t('Nom')}</span><input name="name" required maxlength="80" value="${esc(dn(e.name))}" ${ex ? '' : 'autofocus'}></label>
      <label class="field"><span>${t('Groupe musculaire')}</span><select name="muscle">
        ${calc.MUSCLES.map((m) => `<option value="${esc(m)}" ${m === e.muscle ? 'selected' : ''}>${esc(calc.muscleLabel(m))}</option>`).join('')}</select></label>
      <label class="field"><span>${t('Type')}</span><select name="equipment" data-equip>
        ${Object.keys(calc.EQUIPMENT).map((k) => `<option value="${k}" ${k === e.equipment ? 'selected' : ''}>${esc(calc.equipLabel(k))}</option>`).join('')}</select></label>
      <div class="field" data-bar-field ${e.equipment === 'barre' ? '' : 'hidden'}>
        <label for="ex-bar">${t('Poids de la barre (kg)')}</label>
        <div class="chips tight">${calc.BAR_PRESETS.map(([n, w]) => `<button type="button" class="chip ${w === (e.bar_weight ?? calc.settings().bar) ? 'is-on' : ''}" data-bar-preset="${w}">${esc(t(n))} ${esc(calc.fmt(w))}</button>`).join('')}</div>
        <input id="ex-bar" name="bar_weight" inputmode="decimal" value="${esc(numInput(e.bar_weight ?? calc.settings().bar))}">
        <small>${t('Sert au calcul des disques à charger. Les barres varient d’une salle à l’autre : pèse-la ou regarde l’étiquette.')}</small>
      </div>
      <p class="field-help" data-pdc-help ${e.equipment === 'pdc' ? '' : 'hidden'}>${t('Au poids du corps, tu saisis le lest (0 sans lest). Les calculs ajoutent ton dernier poids enregistré.')}</p>
      <label class="field" data-inc-field ${['duree', 'cardio'].includes(e.equipment) ? 'hidden' : ''}><span>${t('Incrément de charge (kg)')}</span><input name="increment" inputmode="decimal" value="${esc(numInput(inc))}">
        <small>${t('Utilisé pour proposer la charge suivante quand tu atteins le haut de ta fourchette de répétitions.')}</small></label>
      <label class="field"><span>${t('Vidéo de technique (facultatif)')}</span><input type="url" name="video_url" inputmode="url" autocapitalize="off" placeholder="https://www.youtube.com/watch?v=…" value="${esc(e.video_url || '')}">
        <small>${t('Colle le lien d’une vidéo qui te convient. Sans lien, le bouton « Voir la technique » lance une recherche YouTube sur le nom de l’exercice.')}</small></label>
      <label class="field"><span>${t('Notes')}</span><textarea name="notes" rows="2" maxlength="500" placeholder="${esc(t('Réglages machine, prise, tempo…'))}">${esc(e.notes || '')}</textarea></label>
    </form>`,
    onMount(el) {
      const sel = el.querySelector('[data-equip]');
      sel.addEventListener('change', () => {
        el.querySelector('[data-pdc-help]').hidden = sel.value !== 'pdc';
        el.querySelector('[data-bar-field]').hidden = sel.value !== 'barre';
        el.querySelector('[data-inc-field]').hidden = ['duree', 'cardio'].includes(sel.value);
        el.querySelector('[name=increment]').value = numInput(calc.defaultIncrement(sel.value));
      });
      el.addEventListener('click', (ev) => {
        const b = ev.target.closest('[data-bar-preset]');
        if (!b) return;
        el.querySelector('[name=bar_weight]').value = numInput(b.dataset.barPreset);
        el.querySelectorAll('[data-bar-preset]').forEach((x) => x.classList.toggle('is-on', x === b));
      });
      el.querySelector('[data-form]').addEventListener('submit', (ev) => {
        ev.preventDefault();
        el.querySelector('[data-action="1"]').click();
      });
    },
    actions: [
      { label: t('Annuler'), value: null },
      {
        label: t('Enregistrer'),
        kind: 'primary',
        handler(el) {
          const f = formData(el);
          const name = f.name.trim();
          if (!name) {
            el.querySelector('[name=name]').focus();
            return false;
          }
          const rawUrl = (f.video_url || '').trim();
          if (rawUrl && !calc.validVideoUrl(rawUrl)) {
            toast(t('Le lien de la vidéo doit commencer par https://'));
            el.querySelector('[name=video_url]').focus();
            return false;
          }
          const variants = new Set(nameVariants(name));
          const dup = store.all('exercises').find((x) => x.id !== e.id && nameVariants(x.name).some((v) => variants.has(v)));
          if (dup) {
            toast(t('« {name} » existe déjà.', { name: dn(dup.name) }));
            return false;
          }
          return store.save('exercises', {
            ...(ex || { id: store.uuid() }),
            // Nom inchangé : on garde le nom enregistré (évite de renommer un exercice du catalogue en changeant de langue)
            name: ex && name === dn(ex.name) ? ex.name : name,
            muscle: f.muscle,
            equipment: f.equipment,
            increment: calc.parseNum(f.increment) ?? calc.defaultIncrement(f.equipment),
            bar_weight: f.equipment === 'barre' ? (calc.parseNum(f.bar_weight) ?? calc.settings().bar) : (ex?.bar_weight ?? null),
            video_url: calc.validVideoUrl(rawUrl),
            notes: f.notes.trim(),
          });
        },
      },
    ],
  });
}

// Ajoute les exercices courants, dans la langue de l'app, sans doublon (dans l'une ou l'autre langue).
export function addBaseExercises() {
  const existing = new Set(store.all('exercises').map((x) => x.name.toLowerCase()));
  let n = 0;
  for (const row of calc.BASE_EXERCISES) {
    const [fr, muscle, equipment, en] = row;
    if (existing.has(fr.toLowerCase()) || existing.has(en.toLowerCase())) continue;
    store.save('exercises', { id: store.uuid(), name: calc.baseName(row), muscle, equipment, increment: calc.defaultIncrement(equipment), notes: '' });
    n++;
  }
  return n;
}

export function workoutRowHtml(w) {
  const st = calc.workoutStats(w);
  const rec = calc.recordsIn(w).size;
  const d = new Date(w.started_at);
  return `<a class="hist-row" href="#/historique/${w.id}">
    <span class="hist-date"><span class="hist-daynum">${d.getDate()}</span><span class="hist-wd">${esc(calc.fmtWeekday(d).replace('.', ''))}</span></span>
    <span class="hist-body"><span class="hist-name">${esc(dn(w.name) || t('Séance'))}</span>
      <span class="hist-meta">${calc.fmtDuration(st.duration)}, ${tp(st.sets, '{n} série', '{n} séries')}${st.tonnage ? `, ${calc.fmtTonnage(st.tonnage)}` : ''}${st.dist ? `, ${calc.fmt1(st.dist)} km` : ''}</span></span>
    ${rec ? `<span class="tag record">${tp(rec, '{n} record', '{n} records')}</span>` : ''}
    ${icon('chevron', 'row-chevron')}
  </a>`;
}

export function setText(ex, w, r, base = null) {
  const bw = t('PDC');
  const load = calc.isPdc(ex, base) ? (w ? `${bw} + ${calc.fmt(w)} kg` : bw) : `${calc.fmt(w)} kg`;
  return `${load} × ${r ?? '–'}`;
}

// Disques à charger de chaque côté de la barre
export function platesHtml(total, ex, base = null) {
  const s = calc.settings();
  const bar = base?.kind === 'bar' ? base.weight : calc.barWeightOf(ex);
  const res = calc.platesFor(total, bar, s.plates);
  if (total == null) return '';
  if (!res) return `<span class="plates-text">${t('Moins que la barre ({w} kg)', { w: calc.fmt(bar) })}</span>`;
  if (!res.plates.length) return `<span class="plates-text">${t('Barre seule ({w} kg)', { w: calc.fmt(bar) })}</span>`;
  const maxP = Math.max(...s.plates);
  const glyphs = res.plates
    .map((p) => {
      const hgt = 12 + 26 * Math.sqrt(p / maxP);
      const wid = p >= 10 ? 9 : p >= 2.5 ? 6 : 5;
      return `<span class="plate" style="--c:${calc.PLATE_COLORS[p] || '#9AA1A9'};height:${hgt.toFixed(1)}px;width:${wid}px"></span>`;
    })
    .join('');
  return `<span class="bar-glyph" aria-hidden="true"><span class="bar-sleeve"></span>${glyphs}<span class="bar-collar"></span><span class="bar-tip"></span></span>
    <span class="plates-text">${t('Barre {w} kg, par côté : {plates}', { w: calc.fmt(bar), plates: res.plates.map((p) => calc.fmt(p)).join(' + ') })}${res.rest ? ` <em>${t('(reste {w} kg)', { w: calc.fmt(res.rest) })}</em>` : ''}</span>`;
}

// Vidéo de référence d'un exercice : coller un lien YouTube (vidéo ou short).
export function videoSheet(ex) {
  const has = Boolean(calc.validVideoUrl(ex.video_url));
  const canPaste = Boolean(navigator.clipboard?.readText);
  return openSheet({
    title: t('Ma vidéo de référence'),
    body: `<p class="sheet-text first">${esc(dn(ex.name))}</p>
      <ol class="steps">
        <li>${t('Sur YouTube, ouvre la vidéo ou le short qui te sert de modèle.')}</li>
        <li>${t('Touche <strong>Partager</strong>, puis <strong>Copier le lien</strong>.')}</li>
        <li>${t('Reviens ici et colle le lien.')}</li>
      </ol>
      <label class="field"><span>${t('Lien de la vidéo')}</span>
        <span class="inline-input"><input type="url" name="video_url" inputmode="url" autocapitalize="off" autocomplete="off"
          placeholder="https://youtube.com/shorts/…" value="${esc(ex.video_url || '')}">
          ${canPaste ? `<button class="btn" type="button" data-paste>${t('Coller')}</button>` : ''}</span></label>`,
    onMount(el) {
      el.querySelector('[data-paste]')?.addEventListener('click', async () => {
        try {
          const txt = await navigator.clipboard.readText();
          const url = calc.extractUrl(txt);
          if (url) el.querySelector('[name=video_url]').value = url;
          else toast(t('Le presse-papiers ne contient pas de lien.'));
        } catch {
          toast(t('Colle le lien à la main : appui long dans le champ, puis Coller.'));
        }
      });
    },
    actions: [
      ...(has ? [{ label: t('Retirer'), value: 'remove' }] : [{ label: t('Annuler'), value: null }]),
      {
        label: t('Enregistrer'),
        kind: 'primary',
        handler(el) {
          const raw = el.querySelector('[name=video_url]').value;
          const url = calc.validVideoUrl(calc.extractUrl(raw) || raw);
          if (!url) {
            toast(t('Colle un lien qui commence par https://'));
            return false;
          }
          return store.save('exercises', { ...ex, video_url: url });
        },
      },
    ],
  }).then((r) => {
    if (r === 'remove') return store.save('exercises', { ...ex, video_url: null });
    return r || null;
  });
}
