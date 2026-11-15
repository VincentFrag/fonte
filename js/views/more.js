// Écran « Plus » : exercices, programmes, compte, réglages, sauvegarde.
import * as store from '../store.js';
import * as calc from '../calc.js';
import * as sync from '../sync.js';
import { esc, icon, toast, confirmSheet, menuSheet, formData, openSheet } from '../ui.js';
import { sortedExercises, exerciseListHtml, editExercise, pickExercise, addBaseExercises, videoSheet } from './common.js';
import { startWorkout, activeWorkout } from './workout.js';
import * as presets from '../presets.js';

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
      <a class="list-row" href="#/aide"><span class="list-main">Aide et tutoriels<small>Courtes vidéos pour prendre l'app en main</small></span>${icon('chevron', 'row-chevron')}</a>
    </div>
    <section class="block update-box">
      <p>Fonte ${esc(ctx.version)}</p>
      <button class="btn" data-update>${icon('sync')}<span>Rechercher une mise à jour</span></button>
    </section>`;
  view.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-update]');
    if (!b) return;
    b.disabled = true;
    b.querySelector('span').textContent = 'Recherche…';
    try {
      const r = await ctx.checkUpdate();
      if (r === 'applying') {
        b.querySelector('span').textContent = 'Installation…';
        return;
      }
      toast(r === 'uptodate' ? `Fonte est à jour (version ${ctx.version}).` : 'Mise à jour automatique indisponible sur ce navigateur.');
    } catch {
      toast('Pas de connexion au serveur. Réessaie avec du réseau.', { kind: 'error' });
    }
    b.disabled = false;
    b.querySelector('span').textContent = 'Rechercher une mise à jour';
  });
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
        { label: calc.validVideoUrl(ex.video_url) ? 'Voir ma vidéo de référence' : 'Voir la technique', value: 'video', icon: 'play' },
        { label: calc.validVideoUrl(ex.video_url) ? 'Changer ma vidéo de référence' : 'Ajouter ma vidéo de référence', value: 'setvideo' },
        { label: 'Supprimer', value: 'del', danger: true, icon: 'trash' },
      ]);
      if (c === 'edit') {
        if (await editExercise(ex)) draw();
      } else if (c === 'prog') {
        ctx.go(`/progres/${ex.id}`);
      } else if (c === 'video') {
        window.open(calc.techniqueUrl(ex), '_blank', 'noopener');
      } else if (c === 'setvideo') {
        const saved = await videoSheet(ex);
        if (saved) toast(saved.video_url ? 'Vidéo de référence enregistrée.' : 'Vidéo de référence retirée.');
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
    <button class="btn block catalog-btn" data-catalog>${icon('add')}<span>Ajouter un programme tout fait</span></button>
    ${list.length ? `<div class="list">${list.map((t) => {
      const names = (t.items || []).map((it) => store.getAny('exercises', it.exercise_id)?.name).filter(Boolean);
      return `<a class="list-row" href="#/programmes/${t.id}"><span class="list-main">${esc(t.name)}<small>${esc(names.join(', ') || 'Aucun exercice')}</small></span>${icon('chevron', 'row-chevron')}</a>`;
    }).join('')}</div>` : '<p class="empty">Aucun programme. Crée par exemple « Haut du corps » ou « Push A ».</p>'}`;
  view.addEventListener('click', async (e) => {
    if (e.target.closest('[data-catalog]')) {
      const p = await catalogSheet();
      if (!p) return;
      const created = presets.addProgram(p);
      toast(`« ${p.name} » ajouté : ${created.length} séance${created.length > 1 ? 's' : ''} type${created.length > 1 ? 's' : ''}.`);
      ctx.render();
      return;
    }
    if (!e.target.closest('[data-new]')) return;
    const t = store.save('templates', { id: store.uuid(), name: 'Nouveau programme', position: list.length, items: [], notes: '' });
    ctx.go(`/programmes/${t.id}?new`);
  });
}

// Catalogue : liste des programmes, puis détail avant ajout
async function catalogSheet() {
  for (;;) {
    const id = await openSheet({
      title: 'Programmes tout faits',
      wide: true,
      body: [['muscu', 'Musculation'], ['cardio', 'Cardio, HIIT et gainage']].map(([fam, title]) => `
        <h3 class="group-title">${esc(title)}</h3>
        <div class="menu-list catalog-list">${presets.PROGRAMS.filter((p) => p.family === fam).map((p) => `
          <button class="menu-item" data-prog="${p.id}"><span class="mi-main">${esc(p.name)}<small>${esc(p.summary)}</small></span>${icon('chevron')}</button>`).join('')}
        </div>`).join(''),
      onMount(el, api) {
        el.addEventListener('click', (e) => {
          const b = e.target.closest('[data-prog]');
          if (b) api.close(b.dataset.prog);
        });
      },
    });
    if (!id) return null;
    const p = presets.PROGRAMS.find((x) => x.id === id);
    const missing = presets.missingExercises(p);
    const exName = (n) => esc(n);
    const itemLine = (i) => {
      if (i.target_t != null) return `${exName(i.ex)} <span>${i.sets} × ${esc(calc.fmtSec(i.target_t))}${i.int_rest != null ? `, récup ${esc(calc.fmtSec(i.int_rest))}` : ''}</span>`;
      if (i.rep_min != null) return `${exName(i.ex)} <span>${i.sets} × ${i.rep_min}${i.rep_max !== i.rep_min ? `–${i.rep_max}` : ''}</span>`;
      return `${exName(i.ex)} <span>durée et distance</span>`;
    };
    const ok = await openSheet({
      title: p.name,
      wide: true,
      body: `<p class="sheet-text first">${esc(p.description)}</p>
        ${p.templates.map((t) => `<div class="catalog-tpl"><h3>${esc(t.name)}</h3>
          <ul>${t.items.map((i) => `<li>${itemLine(i)}</li>`).join('')}</ul></div>`).join('')}
        <p class="fine">${p.templates.length} séance${p.templates.length > 1 ? 's' : ''} type${p.templates.length > 1 ? 's' : ''} ${p.templates.length > 1 ? 'seront ajoutées' : 'sera ajoutée'} à tes programmes${missing.length ? `, avec ${missing.length} nouvel${missing.length > 1 ? 's' : ''} exercice${missing.length > 1 ? 's' : ''}` : ''}. Tu pourras tout modifier ensuite.</p>`,
      actions: [
        { label: 'Retour', value: 'back' },
        { label: 'Ajouter ce programme', kind: 'primary', value: 'add' },
      ],
    });
    if (ok === 'add') return p;
    if (ok !== 'back') return null;
  }
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
        ${t.items.map((it, i) => {
          const ex = store.getAny('exercises', it.exercise_id);
          const mode = calc.modeOf(ex);
          const field = (f, label, aria) => `<label><span class="sr-only">${aria}</span><span class="tpl-mini" aria-hidden="true">${label}</span><input class="num" inputmode="numeric" data-f="${f}" value="${it[f] ?? ''}"></label>`;
          const blank = '<span class="tpl-blank" aria-hidden="true"></span>';
          let fields;
          if (mode === 'duree') {
            fields = field('sets', it.circuit ? 'Tours' : 'Séries', it.circuit ? 'Nombre de tours' : 'Séries')
              + field('target_t', 'Effort (s)', 'Durée de l’effort en secondes')
              + field('int_rest', 'Récup (s)', 'Récupération entre les efforts, en secondes')
              + field('rest_sec', it.circuit ? 'Entre tours' : 'Repos (s)', it.circuit ? 'Repos entre les tours, en secondes' : 'Repos après l’exercice, en secondes');
          } else if (mode === 'cardio') {
            fields = field('sets', 'Séries', 'Séries') + blank + blank + field('rest_sec', 'Repos (s)', 'Repos en secondes');
          } else {
            fields = field('sets', 'Séries', 'Séries')
              + field('rep_min', 'Reps min', 'Répétitions minimum')
              + field('rep_max', 'Reps max', 'Répétitions maximum')
              + field('rest_sec', 'Repos (s)', 'Repos en secondes');
          }
          return `<div class="tpl-row" data-i="${i}">
            <span class="tpl-ex">${esc(ex?.name || 'Exercice supprimé')}${it.circuit ? ' <span class="tag">Circuit</span>' : ''}</span>
            ${fields}
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
      const mode = calc.modeOf(store.get('exercises', exId));
      if (mode === 'duree') t.items.push({ exercise_id: exId, sets: 3, target_t: 30, int_rest: null, rest_sec: 60 });
      else if (mode === 'cardio') t.items.push({ exercise_id: exId, sets: 1, rest_sec: defRest });
      else t.items.push({ exercise_id: exId, sets: last?.sets ?? 3, rep_min: last?.rep_min ?? 8, rep_max: last?.rep_max ?? 12, rest_sec: last?.rest_sec ?? defRest });
      save();
      draw();
      return;
    }
    if (e.target.closest('[data-row-menu]')) {
      const i = Number(e.target.closest('[data-i]').dataset.i);
      const items = [];
      if (i > 0) items.push({ label: 'Monter', value: 'up', icon: 'up' });
      if (i < t.items.length - 1) items.push({ label: 'Descendre', value: 'down', icon: 'down' });
      if (calc.modeOf(store.getAny('exercises', t.items[i].exercise_id)) === 'duree') {
        items.push({ label: t.items[i].circuit ? 'Retirer du circuit' : 'Enchaîner en circuit avec les voisins', value: 'circuit' });
      }
      items.push({ label: 'Retirer du programme', value: 'del', danger: true, icon: 'trash' });
      const c = await menuSheet(store.getAny('exercises', t.items[i].exercise_id)?.name || 'Exercice', items);
      if (c === 'circuit') {
        t.items[i].circuit = !t.items[i].circuit;
        if (t.items[i].circuit && t.items[i].int_rest == null) t.items[i].int_rest = 15;
        save();
        draw();
        return;
      }
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
      <p class="block-sub">La synchro se lance automatiquement à l'ouverture de l'app et quelques secondes après chaque modification. Hors connexion, tout reste enregistré sur l'appareil et part dès le retour du réseau.</p>
      <form class="block form" data-password>
        <h2 class="block-title">Changer le mot de passe</h2>
        <label class="field"><span>Nouveau mot de passe</span><input type="password" name="pw1" autocomplete="new-password" minlength="10" required>
          <small>10 caractères minimum. Le plus simple : laisse ton gestionnaire de mots de passe en générer un.</small></label>
        <label class="field"><span>Confirme le mot de passe</span><input type="password" name="pw2" autocomplete="new-password" minlength="10" required></label>
        <button class="btn" type="submit">Changer le mot de passe</button>
      </form>`;
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
    if (!e.target.matches('[data-password]')) return;
    e.preventDefault();
    const f = formData(e.target);
    if (f.pw1 !== f.pw2) {
      toast('Les deux mots de passe ne sont pas identiques.', { kind: 'error' });
      return;
    }
    if (f.pw1.length < 10) {
      toast('Le mot de passe doit faire au moins 10 caractères.', { kind: 'error' });
      return;
    }
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      await sync.changePassword(f.pw1);
      e.target.reset();
      toast('Mot de passe changé. Les autres appareils restent connectés.');
    } catch (err) {
      const m = err?.message || String(err);
      let msg = m;
      if (/different from the old/i.test(m)) msg = 'Le nouveau mot de passe doit être différent de l’ancien.';
      else if (/reauthenticat|recent/i.test(m)) msg = 'Supabase demande une reconnexion récente : déconnecte-toi, reconnecte-toi, puis réessaie.';
      else if (/weak|short|characters/i.test(m)) msg = 'Mot de passe refusé par Supabase : trop faible.';
      else if (/fetch|network/i.test(m)) msg = 'Pas de connexion au serveur. Réessaie avec du réseau.';
      toast(msg, { kind: 'error', duration: 6000 });
    }
    btn.disabled = false;
  });

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
      <label class="field"><span>Poids de barre par défaut (kg)</span><input name="bar" inputmode="decimal" value="${String(s.bar).replace('.', ',')}">
        <small>Utilisé pour les exercices à la barre sans poids de barre précisé. Chaque exercice peut avoir sa propre barre : Plus > Exercices > Modifier.</small></label>
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
      const rows = [['date', 'seance', 'exercice', 'groupe', 'serie', 'echauffement', 'charge_kg', 'reps', 'rir', 'charge_effective_kg', 'e1rm_kg', 'duree_s', 'distance_km']];
      for (const w of calc.finishedWorkouts()) {
        const day = calc.localDay(w.started_at);
        for (const it of w.items || []) {
          const ex = store.getAny('exercises', it.exercise_id);
          it.sets.forEach((s, i) => {
            if (!s.done) return;
            const load = calc.effectiveLoad(ex, s.w, day, it.base);
            const e1 = s.warmup ? null : calc.e1rm(load, s.r);
            const n = (v) => (v == null ? '' : String(Math.round(v * 100) / 100).replace('.', ','));
            const mode = calc.itemMode(it, ex);
            rows.push([day, w.name, ex?.name || it.name, ex?.muscle || '', i + 1, s.warmup ? 'oui' : 'non',
              mode === 'reps' ? n(s.w) : '', mode === 'reps' ? s.r : '', mode === 'reps' ? s.rir ?? '' : '',
              mode === 'reps' ? n(load) : '', mode === 'reps' ? n(e1) : '', s.t ?? '', n(s.d)]);
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

// ---------- Aide et tutoriels ----------
const TUTOS = [
  ['1-programme-tout-fait', 'Ajouter un programme tout fait', 'Choisir un programme du catalogue et le retrouver dans tes séances.'],
  ['2-faire-une-seance', 'Faire une séance', 'Charges pré-remplies, choix de la barre, repos, records et bilan.'],
  ['3-minuteur-hiit', 'Le minuteur HIIT', 'Efforts et récups enchaînés, avec les séries cochées pour toi.'],
  ['4-progression', 'Suivre sa progression', 'Records, courbes par exercice et poids de corps.'],
  ['5-video-de-reference', 'Ajouter ta vidéo de référence', 'Enregistrer un short YouTube sur un exercice pour le retrouver à chaque séance.'],
];

export function renderHelp(view, ctx) {
  view.innerHTML = `
    ${ctx.pageHead('Aide et tutoriels', { back: '/plus' })}
    <p class="block-sub">Des vidéos de moins d'une minute, sans son. Il faut une connexion pour les regarder la première fois.</p>
    <div class="list">${TUTOS.map(([id, title, desc]) => `
      <button class="list-row" data-tuto="${id}"><span class="tuto-thumb">${icon('play')}</span>
        <span class="list-main">${esc(title)}<small>${esc(desc)}</small></span>${icon('chevron', 'row-chevron')}</button>`).join('')}
    </div>
    <section class="block soft">
      <p>Pour voir comment faire un exercice, touche <strong>Voir la technique</strong> sous son nom pendant une séance. Tu peux aussi enregistrer ta propre vidéo de référence dans la fiche de l'exercice (<strong>Plus > Exercices</strong>).</p>
    </section>`;
  view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tuto]');
    if (!b) return;
    const [id, title] = TUTOS.find((t) => t[0] === b.dataset.tuto);
    openSheet({
      title,
      body: `<video class="tuto-video" src="docs/tutos/${id}.mp4" autoplay muted loop playsinline controls preload="auto"
        aria-label="Tutoriel : ${esc(title)}"></video>`,
    });
  });
}
