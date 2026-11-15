// Écran « Plus » : exercices, programmes, compte, réglages, sauvegarde.
import * as store from '../store.js';
import * as calc from '../calc.js';
import * as sync from '../sync.js';
import { esc, icon, toast, confirmSheet, menuSheet, formData } from '../ui.js';
import { sortedExercises, exerciseListHtml, editExercise, pickExercise, addBaseExercises } from './common.js';
import { startWorkout, activeWorkout } from './workout.js';

export function renderMore(view, ctx) {
  const nEx = store.all('exercises').length;
  const nTpl = store.all('templates').length;
  const st = sync.state;
  const account = !sync.isConfigured() ? 'Synchro non configurée' : sync.isSignedIn() ? st.email || 'Connecté' : 'Non connecté';
  view.innerHTML = `
    ${ctx.pageHead('Plus')}
    <div class="list menu-big">
      <a class="list-row" href="#/exercices"><span class="list-main">Exercices<small>${nEx} exercice${nEx > 1 ? 's' : ''}</small></span>${icon('chevron', 'row-chevron')}</a>
      <a class="list-row" href="#/programmes"><span class="list-main">Programmes<small>${nTpl} programme${nTpl > 1 ? 's' : ''}</small></span>${icon('chevron', 'row-chevron')}</a>
      <a class="list-row" href="#/compte"><span class="list-main">Compte et synchronisation<small>${esc(account)}</small></span>${icon('chevron', 'row-chevron')}</a>
      <a class="list-row" href="#/reglages"><span class="list-main">Réglages<small>Repos, barre et disques, écran, thème</small></span>${icon('chevron', 'row-chevron')}</a>
      <a class="list-row" href="#/sauvegarde"><span class="list-main">Sauvegarde<small>Exporter ou importer tes données</small></span>${icon('chevron', 'row-chevron')}</a>
    </div>
    <p class="fine">Fonte ${esc(ctx.version)}</p>`;
}

// ---------- Exercices ----------
export function renderExercises(view, ctx) {
  const draw = () => {
    const list = sortedExercises();
    view.innerHTML = `
      ${ctx.pageHead('Exercices', { back: '/plus', actions: `<button class="btn primary small" data-new>${icon('add')}<span>Nouveau</span></button>` })}
      ${list.length ? `<div class="pick-list">${exerciseListHtml(list, { attr: 'data-edit' })}</div>` : ''}
      <section class="block soft">
        <p>${list.length ? 'Il te manque des classiques ?' : 'Ta liste est vide.'} Ajoute ${calc.BASE_EXERCISES.length} exercices courants (développé couché, squat, tractions…). Ceux que tu as déjà ne seront pas dupliqués.</p>
        <button class="btn" data-base>Ajouter les exercices courants</button>
      </section>`;
  };
  view.addEventListener('click', async (e) => {
    if (e.target.closest('[data-new]')) {
      if (await editExercise(null)) draw();
      return;
    }
    if (e.target.closest('[data-base]')) {
      const n = addBaseExercises();
      toast(n ? `${n} exercice${n > 1 ? 's' : ''} ajouté${n > 1 ? 's' : ''}.` : 'Tous les exercices courants sont déjà là.');
      draw();
      return;
    }
    const b = e.target.closest('[data-edit]');
    if (b) {
      const ex = store.get('exercises', b.dataset.edit);
      const c = await menuSheet(ex.name, [
        { label: 'Modifier', value: 'edit', icon: 'edit' },
        { label: 'Voir la progression', value: 'prog' },
        { label: 'Supprimer', value: 'del', danger: true, icon: 'trash' },
      ]);
      if (c === 'edit') {
        if (await editExercise(ex)) draw();
      } else if (c === 'prog') {
        ctx.go(`/progres/${ex.id}`);
      } else if (c === 'del') {
        const used = calc.exerciseHistory(ex.id).length;
        const ok = await confirmSheet('Supprimer l’exercice', used
          ? `« ${ex.name} » apparaît dans ${used} séance${used > 1 ? 's' : ''}. L'historique est conservé, mais l'exercice ne sera plus proposé.`
          : `Supprimer « ${ex.name} » ?`, { ok: 'Supprimer', danger: true });
        if (ok) {
          store.remove('exercises', ex.id);
          draw();
        }
      }
    }
  });
  draw();
}

// ---------- Programmes ----------
export function renderTemplates(view, ctx) {
  const list = store.all('templates').sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name, 'fr'));
  view.innerHTML = `
    ${ctx.pageHead('Programmes', { back: '/plus', actions: `<button class="btn primary small" data-new>${icon('add')}<span>Nouveau</span></button>` })}
    <p class="block-sub">Un programme est une séance type : la liste des exercices, le nombre de séries, la fourchette de répétitions et le repos. Quand tu atteins le haut de la fourchette sur toutes les séries, l'app te propose la charge suivante.</p>
    ${list.length ? `<div class="list">${list.map((t) => {
      const names = (t.items || []).map((it) => store.getAny('exercises', it.exercise_id)?.name).filter(Boolean);
      return `<a class="list-row" href="#/programmes/${t.id}"><span class="list-main">${esc(t.name)}<small>${esc(names.join(', ') || 'Aucun exercice')}</small></span>${icon('chevron', 'row-chevron')}</a>`;
    }).join('')}</div>` : '<p class="empty">Aucun programme. Crée par exemple « Haut du corps » ou « Push A ».</p>'}`;
  view.addEventListener('click', (e) => {
    if (!e.target.closest('[data-new]')) return;
    const t = store.save('templates', { id: store.uuid(), name: 'Nouveau programme', position: list.length, items: [], notes: '' });
    ctx.go(`/programmes/${t.id}?new`);
  });
}

export function renderTemplateEdit(view, ctx, id) {
  const orig = store.get('templates', id);
  if (!orig) {
    view.innerHTML = `${ctx.pageHead('Programme', { back: '/programmes' })}<p class="empty">Ce programme n'existe plus.</p>`;
    return;
  }
  let t = JSON.parse(JSON.stringify(orig));
  let dirty = false;
  const save = () => {
    t = store.save('templates', t, { silent: true });
    dirty = false;
  };
  const defRest = calc.settings().rest;

  const draw = () => {
    view.innerHTML = `
      ${ctx.pageHead('Programme', { back: '/programmes', actions: `<button class="icon-btn" data-menu aria-label="Options du programme">${icon('more')}</button>` })}
      <label class="field big"><span>Nom</span><input data-name maxlength="80" value="${esc(t.name)}"></label>
      <div class="tpl-items">
        ${t.items.length ? `<div class="tpl-row tpl-row-head" aria-hidden="true"><span>Exercice</span><span>Séries</span><span>Reps min</span><span>Reps max</span><span>Repos (s)</span><span></span></div>` : ''}
        ${t.items.map((it, i) => {
          const ex = store.getAny('exercises', it.exercise_id);
          return `<div class="tpl-row" data-i="${i}">
            <span class="tpl-ex">${esc(ex?.name || 'Exercice supprimé')}</span>
            <label><span class="sr-only">Séries</span><span class="tpl-mini" aria-hidden="true">Séries</span><input class="num" inputmode="numeric" data-f="sets" value="${it.sets ?? ''}"></label>
            <label><span class="sr-only">Répétitions minimum</span><span class="tpl-mini" aria-hidden="true">Reps min</span><input class="num" inputmode="numeric" data-f="rep_min" value="${it.rep_min ?? ''}"></label>
            <label><span class="sr-only">Répétitions maximum</span><span class="tpl-mini" aria-hidden="true">Reps max</span><input class="num" inputmode="numeric" data-f="rep_max" value="${it.rep_max ?? ''}"></label>
            <label><span class="sr-only">Repos en secondes</span><span class="tpl-mini" aria-hidden="true">Repos (s)</span><input class="num" inputmode="numeric" data-f="rest_sec" value="${it.rest_sec ?? ''}"></label>
            <button class="icon-btn" data-row-menu aria-label="Options pour ${esc(ex?.name || 'cet exercice')}">${icon('more')}</button>
          </div>`;
        }).join('')}
      </div>
      <button class="btn ghost block" data-add>${icon('add')}<span>Ajouter un exercice</span></button>
      ${t.items.length ? `<button class="btn primary block" data-start>Démarrer cette séance</button>` : ''}`;
  };

  view.addEventListener('input', (e) => {
    if (e.target.matches('[data-name]')) {
      t.name = e.target.value;
      dirty = true;
      return;
    }
    const f = e.target.dataset.f;
    if (!f) return;
    const it = t.items[Number(e.target.closest('[data-i]').dataset.i)];
    const v = calc.parseNum(e.target.value);
    it[f] = v == null ? null : Math.max(0, Math.round(v));
    dirty = true;
  });
  view.addEventListener('change', () => {
    if (!t.name.trim()) t.name = 'Programme';
    if (dirty) save();
  });

  view.addEventListener('click', async (e) => {
    if (e.target.closest('[data-add]')) {
      const exId = await pickExercise();
      if (!exId) return;
      const last = t.items[t.items.length - 1];
      t.items.push({ exercise_id: exId, sets: last?.sets ?? 3, rep_min: last?.rep_min ?? 8, rep_max: last?.rep_max ?? 12, rest_sec: last?.rest_sec ?? defRest });
      save();
      draw();
      return;
    }
    if (e.target.closest('[data-row-menu]')) {
      const i = Number(e.target.closest('[data-i]').dataset.i);
      const items = [];
      if (i > 0) items.push({ label: 'Monter', value: 'up', icon: 'up' });
      if (i < t.items.length - 1) items.push({ label: 'Descendre', value: 'down', icon: 'down' });
      items.push({ label: 'Retirer du programme', value: 'del', danger: true, icon: 'trash' });
      const c = await menuSheet(store.getAny('exercises', t.items[i].exercise_id)?.name || 'Exercice', items);
      if (c === 'up' || c === 'down') {
        const j = c === 'up' ? i - 1 : i + 1;
        [t.items[i], t.items[j]] = [t.items[j], t.items[i]];
      } else if (c === 'del') t.items.splice(i, 1);
      if (c) {
        save();
        draw();
      }
      return;
    }
    if (e.target.closest('[data-start]')) {
      if (dirty) save();
      if (activeWorkout()) {
        toast('Une séance est déjà en cours. Termine-la ou abandonne-la avant.');
        ctx.go('/seance');
        return;
      }
      startWorkout(ctx, t.id);
      return;
    }
    if (e.target.closest('[data-menu]')) {
      const c = await menuSheet(t.name, [
        { label: 'Dupliquer', value: 'dup' },
        { label: 'Supprimer le programme', value: 'del', danger: true, icon: 'trash' },
      ]);
      if (c === 'dup') {
        if (dirty) save();
        const copy = store.save('templates', { ...t, id: store.uuid(), name: `${t.name} (copie)`, position: store.all('templates').length });
        ctx.go(`/programmes/${copy.id}`);
      } else if (c === 'del') {
        if (await confirmSheet('Supprimer le programme', `Supprimer « ${t.name} » ? Tes séances passées sont conservées.`, { ok: 'Supprimer', danger: true })) {
          store.remove('templates', t.id);
          ctx.go('/programmes');
        }
      }
    }
  });
  ctx.onCleanup(() => {
    if (dirty) save();
  });

  draw();
  if (location.hash.endsWith('?new')) {
    const input = view.querySelector('[data-name]');
    input.focus();
    input.select();
  }
}

// ---------- Compte et synchronisation ----------
export function renderAccount(view, ctx) {
  let email = '';
  const unsub = sync.onStatus(() => {
    if (view.isConnected && !view.querySelector('input:focus')) draw();
  });
  ctx.onCleanup(unsub);

  function draw() {
    const st = sync.state;
    let body = '';
    if (!sync.isConfigured()) {
      body = `<section class="block soft">
        <h2 class="block-title">Synchronisation non configurée</h2>
        <p>Tes données sont enregistrées uniquement sur cet appareil. Pour les retrouver sur ton iPhone, ta tablette et ton ordinateur, renseigne l'adresse et la clé de ton projet Supabase dans le fichier <code>config.js</code>, comme expliqué dans le guide.</p>
      </section>`;
    } else if (sync.isSignedIn()) {
      const pending = store.pendingCount();
      body = `<section class="block">
        <dl class="kv">
          <div><dt>Compte</dt><dd>${esc(st.email || '')}</dd></div>
          <div><dt>État</dt><dd>${esc({ ok: 'Synchronisé', syncing: 'Synchronisation en cours', offline: 'Hors ligne', error: 'Erreur' }[st.status] || st.status)}</dd></div>
          <div><dt>Dernière synchro</dt><dd>${st.lastSync ? esc(calc.fmtTime(st.lastSync)) : '–'}</dd></div>
          <div><dt>Modifications en attente</dt><dd>${pending}</dd></div>
        </dl>
        ${st.error ? `<p class="error-text">${esc(st.error)}</p>` : ''}
        <div class="row-actions">
          <button class="btn primary" data-sync>${icon('sync')}<span>Synchroniser maintenant</span></button>
          <button class="btn" data-out>Se déconnecter</button>
        </div>
      </section>
      <p class="block-sub">La synchro se lance automatiquement à l'ouverture de l'app et quelques secondes après chaque modification. Hors connexion, tout reste enregistré sur l'appareil et part dès le retour du réseau.</p>`;
    } else {
      body = `<form class="block form" data-login>
        <p>Connecte-toi avec le compte créé dans Supabase. Tu ne le fais qu'une fois par appareil : la connexion reste active ensuite.</p>
        <label class="field"><span>Adresse email</span><input type="email" name="email" autocomplete="username" autocapitalize="off" required value="${esc(email)}"></label>
        <label class="field"><span>Mot de passe</span><input type="password" name="password" autocomplete="current-password" required></label>
        <button class="btn primary" type="submit">Se connecter</button>
      </form>`;
    }
    view.innerHTML = `${ctx.pageHead('Compte et synchronisation', { back: '/plus' })}${body}`;
  }

  view.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!e.target.matches('[data-login]')) return;
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    const f = formData(e.target);
    email = f.email.trim();
    try {
      await sync.signIn(email, f.password);
      toast('Connecté. Synchronisation en cours…');
      draw();
    } catch (err) {
      const m = err?.message || String(err);
      let msg = m;
      if (/invalid login credentials/i.test(m)) msg = 'Email ou mot de passe incorrect.';
      else if (/not confirmed/i.test(m)) msg = 'Compte non confirmé : recrée-le dans Supabase en cochant « Auto Confirm User ».';
      else if (/rate limit|too many/i.test(m)) msg = 'Trop de tentatives rapprochées. Attends quelques minutes.';
      else if (/fetch|network/i.test(m)) msg = 'Pas de connexion au serveur. Vérifie le réseau et l’adresse dans config.js.';
      toast(msg, { kind: 'error', duration: 6000 });
      btn.disabled = false;
    }
  });

  view.addEventListener('click', async (e) => {
    if (e.target.closest('[data-sync]')) sync.syncNow();
    if (e.target.closest('[data-out]')) {
      const pending = store.pendingCount();
      const ok = await confirmSheet('Se déconnecter', pending
        ? `Attention : ${pending} modification${pending > 1 ? 's n’ont' : ' n’a'} pas encore été envoyée${pending > 1 ? 's' : ''} et ${pending > 1 ? 'seront perdues' : 'sera perdue'}. Les données de cet appareil seront effacées.`
        : 'Les données seront effacées de cet appareil. Elles restent dans ton compte et reviendront à la prochaine connexion.', { ok: 'Se déconnecter', danger: true });
      if (!ok) return;
      await sync.signOut();
      location.hash = '/seance';
      location.reload();
    }
  });

  draw();
}

// ---------- Réglages ----------
export function renderSettings(view, ctx) {
  const s = calc.settings();
  view.innerHTML = `
    ${ctx.pageHead('Réglages', { back: '/plus' })}
    <form class="form block" data-form>
      <h2 class="block-title">Séance</h2>
      <label class="field"><span>Repos par défaut (secondes)</span><input name="rest" inputmode="numeric" value="${s.rest}"></label>
      <label class="switch"><input type="checkbox" name="showRir" ${s.showRir ? 'checked' : ''}><span>Afficher la colonne RIR<small>Répétitions en réserve : combien de reps tu aurais encore pu faire. 0 = échec.</small></span></label>
      <label class="switch"><input type="checkbox" name="sound" ${s.sound ? 'checked' : ''}><span>Son à la fin du repos<small>Sur iPhone, le son ne joue que si l'app est au premier plan et le mode silencieux désactivé.</small></span></label>
      <label class="switch"><input type="checkbox" name="wakeLock" ${s.wakeLock ? 'checked' : ''}><span>Garder l'écran allumé pendant la séance</span></label>
      <h2 class="block-title">Barre et disques</h2>
      <label class="field"><span>Poids de la barre (kg)</span><input name="bar" inputmode="decimal" value="${String(s.bar).replace('.', ',')}"></label>
      <label class="field"><span>Disques disponibles (kg, séparés par des espaces)</span><input name="plates" value="${esc(s.plates.map((p) => String(p).replace('.', ',')).join(' '))}">
        <small>Sert à afficher les disques à charger de chaque côté pour les exercices à la barre.</small></label>
      <h2 class="block-title">Affichage</h2>
      <label class="field"><span>Thème</span><select name="theme">
        <option value="auto" ${s.theme === 'auto' ? 'selected' : ''}>Comme l'appareil</option>
        <option value="light" ${s.theme === 'light' ? 'selected' : ''}>Clair</option>
        <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Sombre</option>
      </select></label>
      <p class="fine">Les réglages sont propres à chaque appareil.</p>
    </form>`;
  view.addEventListener('change', () => {
    const f = formData(view.querySelector('[data-form]'));
    const plates = f.plates.split(/[\s;]+/).map(calc.parseNum).filter((x) => x > 0);
    calc.saveSettings({
      rest: Math.max(5, Math.round(calc.parseNum(f.rest) || 120)),
      showRir: f.showRir,
      sound: f.sound,
      wakeLock: f.wakeLock,
      bar: calc.parseNum(f.bar) ?? 20,
      plates: plates.length ? plates : calc.DEFAULT_SETTINGS.plates,
      theme: f.theme,
    });
    ctx.applyTheme();
    toast('Réglages enregistrés.', { duration: 1500 });
  });
}

// ---------- Sauvegarde ----------
async function shareOrDownload(filename, text, type) {
  const blob = new Blob([text], { type });
  const file = new File([blob], filename, { type });
  if (navigator.canShare && navigator.canShare({ files: [file] }) && /iPhone|iPad|Android/i.test(navigator.userAgent)) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(a.href);
    a.remove();
  }, 1000);
}

function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function renderBackup(view, ctx) {
  view.innerHTML = `
    ${ctx.pageHead('Sauvegarde', { back: '/plus' })}
    <section class="block">
      <h2 class="block-title">Exporter</h2>
      <p>Le fichier JSON contient tout : exercices, programmes, séances et pesées. Garde-le dans Fichiers ou iCloud Drive, en plus de la synchro.</p>
      <div class="row-actions">
        <button class="btn primary" data-json>Exporter en JSON</button>
        <button class="btn" data-csv>Exporter les séries en CSV</button>
      </div>
      <p class="fine">Le CSV (séparateur point-virgule) s'ouvre directement dans Excel.</p>
    </section>
    <section class="block">
      <h2 class="block-title">Importer</h2>
      <p>Importe un fichier JSON exporté depuis Fonte. Les données sont fusionnées : rien n'est supprimé, et la version la plus récente de chaque élément est gardée.</p>
      <label class="btn file-btn">Choisir un fichier JSON<input type="file" accept="application/json,.json" data-import hidden></label>
    </section>`;

  view.addEventListener('click', async (e) => {
    const stamp = calc.localDay();
    if (e.target.closest('[data-json]')) {
      const out = { app: 'fonte', version: 1, exported_at: new Date().toISOString() };
      for (const t of Object.keys(store.TABLES)) {
        out[t] = store.all(t).map((r) => {
          const o = {};
          for (const c of store.TABLES[t].columns) if (c !== 'user_id') o[c] = r[c] ?? null;
          return o;
        });
      }
      await shareOrDownload(`fonte-${stamp}.json`, JSON.stringify(out, null, 1), 'application/json');
    }
    if (e.target.closest('[data-csv]')) {
      const rows = [['date', 'seance', 'exercice', 'groupe', 'serie', 'echauffement', 'charge_kg', 'reps', 'rir', 'charge_effective_kg', 'e1rm_kg']];
      for (const w of calc.finishedWorkouts()) {
        const day = calc.localDay(w.started_at);
        for (const it of w.items || []) {
          const ex = store.getAny('exercises', it.exercise_id);
          it.sets.forEach((s, i) => {
            if (!s.done) return;
            const load = calc.effectiveLoad(ex, s.w, day);
            const e1 = s.warmup ? null : calc.e1rm(load, s.r);
            const n = (v) => (v == null ? '' : String(Math.round(v * 100) / 100).replace('.', ','));
            rows.push([day, w.name, ex?.name || it.name, ex?.muscle || '', i + 1, s.warmup ? 'oui' : 'non', n(s.w), s.r, s.rir ?? '', n(load), n(e1)]);
          });
        }
      }
      const csv = '﻿' + rows.map((r) => r.map(csvCell).join(';')).join('\r\n');
      await shareOrDownload(`fonte-series-${stamp}.csv`, csv, 'text/csv');
    }
  });

  view.addEventListener('change', async (e) => {
    const input = e.target.closest('[data-import]');
    if (!input?.files?.[0]) return;
    try {
      const data = JSON.parse(await input.files[0].text());
      if (data.app !== 'fonte') throw new Error('Ce fichier ne vient pas de Fonte.');
      let n = 0;
      for (const t of Object.keys(store.TABLES)) if (Array.isArray(data[t])) n += store.importRows(t, data[t]);
      toast(n ? `${n} élément${n > 1 ? 's' : ''} importé${n > 1 ? 's' : ''}.` : 'Rien de nouveau dans ce fichier.');
    } catch (err) {
      toast(`Import impossible : ${err.message}`, { kind: 'error', duration: 6000 });
    }
    input.value = '';
  });
}
