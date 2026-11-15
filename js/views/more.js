// Écran « Plus » : exercices, programmes, compte, réglages, sauvegarde.
import * as store from '../store.js';
import * as calc from '../calc.js';
import * as sync from '../sync.js';
import { esc, icon, toast, confirmSheet, menuSheet, formData, openSheet } from '../ui.js';
import { sortedExercises, exerciseListHtml, editExercise, pickExercise, addBaseExercises, videoSheet } from './common.js';
import { startWorkout, activeWorkout } from './workout.js';
import * as presets from '../presets.js';
import { t, tp, lang, numInput } from '../i18n.js';

export function renderMore(view, ctx) {
  const nEx = store.all('exercises').length;
  const nTpl = store.all('templates').length;
  const st = sync.state;
  const account = !sync.isConfigured() ? t('Synchro non configurée') : sync.isSignedIn() ? st.email || t('Connecté') : t('Non connecté');
  view.innerHTML = `
    ${ctx.pageHead(t('Plus'))}
    <div class="list menu-big">
      <a class="list-row" href="#/exercices"><span class="list-main">${t('Exercices')}<small>${tp(nEx, '{n} exercice', '{n} exercices')}</small></span>${icon('chevron', 'row-chevron')}</a>
      <a class="list-row" href="#/programmes"><span class="list-main">${t('Programmes')}<small>${tp(nTpl, '{n} programme', '{n} programmes')}</small></span>${icon('chevron', 'row-chevron')}</a>
      <a class="list-row" href="#/compte"><span class="list-main">${t('Compte et synchronisation')}<small>${esc(account)}</small></span>${icon('chevron', 'row-chevron')}</a>
      <a class="list-row" href="#/reglages"><span class="list-main">${t('Réglages')}<small>${t('Langue, repos, barre et disques, écran, thème')}</small></span>${icon('chevron', 'row-chevron')}</a>
      <a class="list-row" href="#/sauvegarde"><span class="list-main">${t('Sauvegarde')}<small>${t('Exporter ou importer tes données')}</small></span>${icon('chevron', 'row-chevron')}</a>
      <a class="list-row" href="#/aide"><span class="list-main">${t('Aide et tutoriels')}<small>${t('Courtes vidéos pour prendre l’app en main')}</small></span>${icon('chevron', 'row-chevron')}</a>
    </div>
    <section class="block update-box">
      <p>Fonte ${esc(ctx.version)}</p>
      <button class="btn" data-update>${icon('sync')}<span>${t('Rechercher une mise à jour')}</span></button>
    </section>`;
  view.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-update]');
    if (!b) return;
    b.disabled = true;
    b.querySelector('span').textContent = t('Recherche…');
    try {
      const r = await ctx.checkUpdate();
      if (r === 'applying') {
        b.querySelector('span').textContent = t('Installation…');
        return;
      }
      toast(r === 'uptodate' ? t('Fonte est à jour (version {v}).', { v: ctx.version }) : t('Mise à jour automatique indisponible sur ce navigateur.'));
    } catch {
      toast('Pas de connexion au serveur. Réessaie avec du réseau.', { kind: 'error' });
    }
    b.disabled = false;
    b.querySelector('span').textContent = t('Rechercher une mise à jour');
  });
}

// ---------- Exercices ----------
export function renderExercises(view, ctx) {
  const draw = () => {
    const list = sortedExercises();
    view.innerHTML = `
      ${ctx.pageHead(t('Exercices'), { back: '/plus', actions: `<button class="btn primary small" data-new>${icon('add')}<span>${t('Nouveau')}</span></button>` })}
      ${list.length ? `<div class="pick-list">${exerciseListHtml(list, { attr: 'data-edit' })}</div>` : ''}
      <section class="block soft">
        <p>${list.length ? t('Il te manque des classiques ?') : t('Ta liste est vide.')} ${t('Ajoute {n} exercices courants (développé couché, squat, tractions…). Ceux que tu as déjà ne seront pas dupliqués.', { n: calc.BASE_EXERCISES.length })}</p>
        <button class="btn" data-base>${t('Ajouter les exercices courants')}</button>
      </section>`;
  };
  view.addEventListener('click', async (e) => {
    if (e.target.closest('[data-new]')) {
      if (await editExercise(null)) draw();
      return;
    }
    if (e.target.closest('[data-base]')) {
      const n = addBaseExercises();
      toast(n ? tp(n, '{n} exercice ajouté.', '{n} exercices ajoutés.') : t('Tous les exercices courants sont déjà là.'));
      draw();
      return;
    }
    const b = e.target.closest('[data-edit]');
    if (b) {
      const ex = store.get('exercises', b.dataset.edit);
      const c = await menuSheet(ex.name, [
        { label: t('Modifier'), value: 'edit', icon: 'edit' },
        { label: t('Voir la progression'), value: 'prog' },
        { label: calc.validVideoUrl(ex.video_url) ? t('Voir ma vidéo de référence') : t('Voir la technique'), value: 'video', icon: 'play' },
        { label: calc.validVideoUrl(ex.video_url) ? t('Changer ma vidéo de référence') : t('Ajouter ma vidéo de référence'), value: 'setvideo' },
        { label: t('Supprimer'), value: 'del', danger: true, icon: 'trash' },
      ]);
      if (c === 'edit') {
        if (await editExercise(ex)) draw();
      } else if (c === 'prog') {
        ctx.go(`/progres/${ex.id}`);
      } else if (c === 'video') {
        window.open(calc.techniqueUrl(ex), '_blank', 'noopener');
      } else if (c === 'setvideo') {
        const saved = await videoSheet(ex);
        if (saved) toast(saved.video_url ? t('Vidéo de référence enregistrée.') : t('Vidéo de référence retirée.'));
      } else if (c === 'del') {
        const used = calc.exerciseHistory(ex.id).length;
        const ok = await confirmSheet(t('Supprimer l’exercice'), used
          ? tp(used, '« {name} » apparaît dans {n} séance. L’historique est conservé, mais l’exercice ne sera plus proposé.', '« {name} » apparaît dans {n} séances. L’historique est conservé, mais l’exercice ne sera plus proposé.', { name: ex.name })
          : t('Supprimer « {name} » ?', { name: ex.name }), { ok: t('Supprimer'), danger: true });
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
  const list = store.all('templates').sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || a.name.localeCompare(b.name, lang()));
  view.innerHTML = `
    ${ctx.pageHead(t('Programmes'), { back: '/plus', actions: `<button class="btn primary small" data-new>${icon('add')}<span>${t('Nouveau')}</span></button>` })}
    <p class="block-sub">${t('Un programme est une séance type : la liste des exercices, le nombre de séries, la fourchette de répétitions et le repos. Quand tu atteins le haut de la fourchette sur toutes les séries, l’app te propose la charge suivante.')}</p>
    <button class="btn block catalog-btn" data-catalog>${icon('add')}<span>${t('Ajouter un programme tout fait')}</span></button>
    ${list.length ? `<div class="list">${list.map((tpl) => {
      const names = (tpl.items || []).map((it) => store.getAny('exercises', it.exercise_id)?.name).filter(Boolean);
      return `<a class="list-row" href="#/programmes/${tpl.id}"><span class="list-main">${esc(tpl.name)}<small>${esc(names.join(', ') || t('Aucun exercice'))}</small></span>${icon('chevron', 'row-chevron')}</a>`;
    }).join('')}</div>` : `<p class="empty">${t('Aucun programme. Crée par exemple « Haut du corps » ou « Push A ».')}</p>`}`;
  view.addEventListener('click', async (e) => {
    if (e.target.closest('[data-catalog]')) {
      const p = await catalogSheet();
      if (!p) return;
      const created = presets.addProgram(p);
      toast(tp(created.length, '« {name} » ajouté : {n} séance type.', '« {name} » ajouté : {n} séances types.', { name: t(p.name) }));
      ctx.render();
      return;
    }
    if (!e.target.closest('[data-new]')) return;
    const tpl = store.save('templates', { id: store.uuid(), name: t('Nouveau programme'), position: list.length, items: [], notes: '' });
    ctx.go(`/programmes/${tpl.id}?new`);
  });
}

// Catalogue : liste des programmes, puis détail avant ajout
async function catalogSheet() {
  for (;;) {
    const id = await openSheet({
      title: t('Programmes tout faits'),
      wide: true,
      body: [['muscu', 'Musculation'], ['cardio', 'Cardio, HIIT et gainage']].map(([fam, title]) => `
        <h3 class="group-title">${esc(t(title))}</h3>
        <div class="menu-list catalog-list">${presets.PROGRAMS.filter((p) => p.family === fam).map((p) => `
          <button class="menu-item" data-prog="${p.id}"><span class="mi-main">${esc(t(p.name))}<small>${esc(t(p.summary))}</small></span>${icon('chevron')}</button>`).join('')}
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
    const exName = (n) => esc(presets.exLabel(n));
    const itemLine = (i) => {
      if (i.target_t != null) return `${exName(i.ex)} <span>${i.sets} × ${esc(calc.fmtSec(i.target_t))}${i.int_rest != null ? `, ${esc(t('récup {v}', { v: calc.fmtSec(i.int_rest) }))}` : ''}</span>`;
      if (i.rep_min != null) return `${exName(i.ex)} <span>${i.sets} × ${i.rep_min}${i.rep_max !== i.rep_min ? `–${i.rep_max}` : ''}</span>`;
      return `${exName(i.ex)} <span>${t('durée et distance')}</span>`;
    };
    const ok = await openSheet({
      title: t(p.name),
      wide: true,
      body: `<p class="sheet-text first">${esc(t(p.description))}</p>
        ${p.templates.map((tpl) => `<div class="catalog-tpl"><h3>${esc(t(tpl.name))}</h3>
          <ul>${tpl.items.map((i) => `<li>${itemLine(i)}</li>`).join('')}</ul></div>`).join('')}
        <p class="fine">${esc(tp(p.templates.length, '{n} séance type sera ajoutée à tes programmes', '{n} séances types seront ajoutées à tes programmes'))}${missing.length ? esc(tp(missing.length, ', avec {n} nouvel exercice', ', avec {n} nouveaux exercices')) : ''}. ${t('Tu pourras tout modifier ensuite.')}</p>`,
      actions: [
        { label: t('Retour'), value: 'back' },
        { label: t('Ajouter ce programme'), kind: 'primary', value: 'add' },
      ],
    });
    if (ok === 'add') return p;
    if (ok !== 'back') return null;
  }
}

export function renderTemplateEdit(view, ctx, id) {
  const orig = store.get('templates', id);
  if (!orig) {
    view.innerHTML = `${ctx.pageHead(t('Programme'), { back: '/programmes' })}<p class="empty">${t('Ce programme n’existe plus.')}</p>`;
    return;
  }
  let tpl = JSON.parse(JSON.stringify(orig));
  let dirty = false;
  const save = () => {
    tpl = store.save('templates', tpl, { silent: true });
    dirty = false;
  };
  const defRest = calc.settings().rest;

  const draw = () => {
    view.innerHTML = `
      ${ctx.pageHead(t('Programme'), { back: '/programmes', actions: `<button class="icon-btn" data-menu aria-label="${esc(t('Options du programme'))}">${icon('more')}</button>` })}
      <label class="field big"><span>${t('Nom')}</span><input data-name maxlength="80" value="${esc(tpl.name)}"></label>
      <div class="tpl-items">
        ${tpl.items.map((it, i) => {
          const ex = store.getAny('exercises', it.exercise_id);
          const mode = calc.modeOf(ex);
          const field = (f, label, aria) => `<label><span class="sr-only">${esc(t(aria))}</span><span class="tpl-mini" aria-hidden="true">${esc(t(label))}</span><input class="num" inputmode="numeric" data-f="${f}" value="${it[f] ?? ''}"></label>`;
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
            <span class="tpl-ex">${esc(ex?.name || t('Exercice supprimé'))}${it.circuit ? ` <span class="tag">${t('Circuit')}</span>` : ''}</span>
            ${fields}
            <button class="icon-btn" data-row-menu aria-label="${esc(ex ? t('Options pour {name}', { name: ex.name }) : t('Options pour cet exercice'))}">${icon('more')}</button>
          </div>`;
        }).join('')}
      </div>
      <button class="btn ghost block" data-add>${icon('add')}<span>${t('Ajouter un exercice')}</span></button>
      ${tpl.items.length ? `<button class="btn primary block" data-start>${t('Démarrer cette séance')}</button>` : ''}`;
  };

  view.addEventListener('input', (e) => {
    if (e.target.matches('[data-name]')) {
      tpl.name = e.target.value;
      dirty = true;
      return;
    }
    const f = e.target.dataset.f;
    if (!f) return;
    const it = tpl.items[Number(e.target.closest('[data-i]').dataset.i)];
    const v = calc.parseNum(e.target.value);
    it[f] = v == null ? null : Math.max(0, Math.round(v));
    dirty = true;
  });
  view.addEventListener('change', () => {
    if (!tpl.name.trim()) tpl.name = t('Programme');
    if (dirty) save();
  });

  view.addEventListener('click', async (e) => {
    if (e.target.closest('[data-add]')) {
      const exId = await pickExercise();
      if (!exId) return;
      const last = tpl.items[tpl.items.length - 1];
      const mode = calc.modeOf(store.get('exercises', exId));
      if (mode === 'duree') tpl.items.push({ exercise_id: exId, sets: 3, target_t: 30, int_rest: null, rest_sec: 60 });
      else if (mode === 'cardio') tpl.items.push({ exercise_id: exId, sets: 1, rest_sec: defRest });
      else tpl.items.push({ exercise_id: exId, sets: last?.sets ?? 3, rep_min: last?.rep_min ?? 8, rep_max: last?.rep_max ?? 12, rest_sec: last?.rest_sec ?? defRest });
      save();
      draw();
      return;
    }
    if (e.target.closest('[data-row-menu]')) {
      const i = Number(e.target.closest('[data-i]').dataset.i);
      const items = [];
      if (i > 0) items.push({ label: t('Monter'), value: 'up', icon: 'up' });
      if (i < tpl.items.length - 1) items.push({ label: t('Descendre'), value: 'down', icon: 'down' });
      if (calc.modeOf(store.getAny('exercises', tpl.items[i].exercise_id)) === 'duree') {
        items.push({ label: tpl.items[i].circuit ? t('Retirer du circuit') : t('Enchaîner en circuit avec les voisins'), value: 'circuit' });
      }
      items.push({ label: t('Retirer du programme'), value: 'del', danger: true, icon: 'trash' });
      const c = await menuSheet(store.getAny('exercises', tpl.items[i].exercise_id)?.name || t('Exercice'), items);
      if (c === 'circuit') {
        tpl.items[i].circuit = !tpl.items[i].circuit;
        if (tpl.items[i].circuit && tpl.items[i].int_rest == null) tpl.items[i].int_rest = 15;
        save();
        draw();
        return;
      }
      if (c === 'up' || c === 'down') {
        const j = c === 'up' ? i - 1 : i + 1;
        [tpl.items[i], tpl.items[j]] = [tpl.items[j], tpl.items[i]];
      } else if (c === 'del') tpl.items.splice(i, 1);
      if (c) {
        save();
        draw();
      }
      return;
    }
    if (e.target.closest('[data-start]')) {
      if (dirty) save();
      if (activeWorkout()) {
        toast(t('Une séance est déjà en cours. Termine-la ou abandonne-la avant.'));
        ctx.go('/seance');
        return;
      }
      startWorkout(ctx, tpl.id);
      return;
    }
    if (e.target.closest('[data-menu]')) {
      const c = await menuSheet(tpl.name, [
        { label: t('Dupliquer'), value: 'dup' },
        { label: t('Supprimer le programme'), value: 'del', danger: true, icon: 'trash' },
      ]);
      if (c === 'dup') {
        if (dirty) save();
        const copy = store.save('templates', { ...tpl, id: store.uuid(), name: t('{name} (copie)', { name: tpl.name }), position: store.all('templates').length });
        ctx.go(`/programmes/${copy.id}`);
      } else if (c === 'del') {
        if (await confirmSheet(t('Supprimer le programme'), t('Supprimer « {name} » ? Tes séances passées sont conservées.', { name: tpl.name }), { ok: t('Supprimer'), danger: true })) {
          store.remove('templates', tpl.id);
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
        <h2 class="block-title">${t('Synchronisation non configurée')}</h2>
        <p>${t('Tes données sont enregistrées uniquement sur cet appareil. Pour les retrouver sur ton téléphone, ta tablette et ton ordinateur, renseigne l’adresse et la clé de ton projet Supabase dans le fichier <code>config.js</code>, comme expliqué dans le guide.')}</p>
      </section>`;
    } else if (sync.isSignedIn()) {
      const pending = store.pendingCount();
      body = `<section class="block">
        <dl class="kv">
          <div><dt>${t('Compte')}</dt><dd>${esc(st.email || '')}</dd></div>
          <div><dt>${t('État')}</dt><dd>${esc(t({ ok: 'Synchronisé', syncing: 'Synchronisation en cours', offline: 'Hors ligne', error: 'Erreur' }[st.status] || st.status))}</dd></div>
          <div><dt>${t('Dernière synchro')}</dt><dd>${st.lastSync ? esc(calc.fmtTime(st.lastSync)) : '–'}</dd></div>
          <div><dt>${t('Modifications en attente')}</dt><dd>${pending}</dd></div>
        </dl>
        ${st.error ? `<p class="error-text">${esc(st.error)}</p>` : ''}
        <div class="row-actions">
          <button class="btn primary" data-sync>${icon('sync')}<span>${t('Synchroniser maintenant')}</span></button>
          <button class="btn" data-out>${t('Se déconnecter')}</button>
        </div>
      </section>
      <p class="block-sub">${t('La synchro se lance automatiquement à l’ouverture de l’app et quelques secondes après chaque modification. Hors connexion, tout reste enregistré sur l’appareil et part dès le retour du réseau.')}</p>
      <form class="block form" data-password>
        <h2 class="block-title">${t('Changer le mot de passe')}</h2>
        <label class="field"><span>${t('Nouveau mot de passe')}</span><input type="password" name="pw1" autocomplete="new-password" minlength="10" required>
          <small>${t('10 caractères minimum. Le plus simple : laisse ton gestionnaire de mots de passe en générer un.')}</small></label>
        <label class="field"><span>${t('Confirme le mot de passe')}</span><input type="password" name="pw2" autocomplete="new-password" minlength="10" required></label>
        <button class="btn" type="submit">${t('Changer le mot de passe')}</button>
      </form>`;
    } else {
      body = `<form class="block form" data-login>
        <p>${t('Connecte-toi avec le compte créé dans Supabase. Tu ne le fais qu’une fois par appareil : la connexion reste active ensuite.')}</p>
        <label class="field"><span>${t('Adresse email')}</span><input type="email" name="email" autocomplete="username" autocapitalize="off" required value="${esc(email)}"></label>
        <label class="field"><span>${t('Mot de passe')}</span><input type="password" name="password" autocomplete="current-password" required></label>
        <button class="btn primary" type="submit">${t('Se connecter')}</button>
      </form>`;
    }
    view.innerHTML = `${ctx.pageHead(t('Compte et synchronisation'), { back: '/plus' })}${body}`;
  }

  view.addEventListener('submit', async (e) => {
    if (!e.target.matches('[data-password]')) return;
    e.preventDefault();
    const f = formData(e.target);
    if (f.pw1 !== f.pw2) {
      toast(t('Les deux mots de passe ne sont pas identiques.'), { kind: 'error' });
      return;
    }
    if (f.pw1.length < 10) {
      toast(t('Le mot de passe doit faire au moins 10 caractères.'), { kind: 'error' });
      return;
    }
    const btn = e.target.querySelector('[type=submit]');
    btn.disabled = true;
    try {
      await sync.changePassword(f.pw1);
      e.target.reset();
      toast(t('Mot de passe changé. Les autres appareils restent connectés.'));
    } catch (err) {
      const m = err?.message || String(err);
      let msg = m;
      if (/different from the old/i.test(m)) msg = t('Le nouveau mot de passe doit être différent de l’ancien.');
      else if (/reauthenticat|recent/i.test(m)) msg = t('Supabase demande une reconnexion récente : déconnecte-toi, reconnecte-toi, puis réessaie.');
      else if (/weak|short|characters/i.test(m)) msg = t('Mot de passe refusé par Supabase : trop faible.');
      else if (/fetch|network/i.test(m)) msg = t('Pas de connexion au serveur. Réessaie avec du réseau.');
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
      toast(t('Connecté. Synchronisation en cours…'));
      draw();
    } catch (err) {
      const m = err?.message || String(err);
      let msg = m;
      if (/invalid login credentials/i.test(m)) msg = t('Email ou mot de passe incorrect.');
      else if (/not confirmed/i.test(m)) msg = t('Compte non confirmé : recrée-le dans Supabase en cochant « Auto Confirm User ».');
      else if (/rate limit|too many/i.test(m)) msg = t('Trop de tentatives rapprochées. Attends quelques minutes.');
      else if (/fetch|network/i.test(m)) msg = t('Pas de connexion au serveur. Vérifie le réseau et l’adresse dans config.js.');
      toast(msg, { kind: 'error', duration: 6000 });
      btn.disabled = false;
    }
  });

  view.addEventListener('click', async (e) => {
    if (e.target.closest('[data-sync]')) sync.syncNow();
    if (e.target.closest('[data-out]')) {
      const pending = store.pendingCount();
      const ok = await confirmSheet(t('Se déconnecter'), pending
        ? tp(pending, 'Attention : {n} modification n’a pas encore été envoyée et sera perdue. Les données de cet appareil seront effacées.', 'Attention : {n} modifications n’ont pas encore été envoyées et seront perdues. Les données de cet appareil seront effacées.')
        : t('Les données seront effacées de cet appareil. Elles restent dans ton compte et reviendront à la prochaine connexion.'), { ok: t('Se déconnecter'), danger: true });
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
  const opt = (v, cur, label) => `<option value="${v}" ${cur === v ? 'selected' : ''}>${label}</option>`;
  view.innerHTML = `
    ${ctx.pageHead(t('Réglages'), { back: '/plus' })}
    <form class="form block" data-form>
      <h2 class="block-title">${t('Langue')}</h2>
      <label class="field"><span>${t('Langue de l’app')}</span><select name="lang">
        ${opt('auto', s.lang, t('Comme l’appareil'))}
        ${opt('fr', s.lang, 'Français')}
        ${opt('en', s.lang, 'English')}
      </select>
        <small>${t('Les noms d’exercices et de programmes déjà créés ne changent pas. Les nouveaux sont créés dans la langue choisie.')}</small></label>
      <h2 class="block-title">${t('Séance')}</h2>
      <label class="field"><span>${t('Repos par défaut (secondes)')}</span><input name="rest" inputmode="numeric" value="${s.rest}"></label>
      <label class="switch"><input type="checkbox" name="showRir" ${s.showRir ? 'checked' : ''}><span>${t('Afficher la colonne RIR')}<small>${t('Répétitions en réserve : combien de reps tu aurais encore pu faire. 0 = échec.')}</small></span></label>
      <label class="switch"><input type="checkbox" name="sound" ${s.sound ? 'checked' : ''}><span>${t('Son à la fin du repos')}<small>${t('Sur iPhone, le son ne joue que si l’app est au premier plan et le mode silencieux désactivé.')}</small></span></label>
      <label class="switch"><input type="checkbox" name="wakeLock" ${s.wakeLock ? 'checked' : ''}><span>${t('Garder l’écran allumé pendant la séance')}</span></label>
      <h2 class="block-title">${t('Barre et disques')}</h2>
      <label class="field"><span>${t('Poids de barre par défaut (kg)')}</span><input name="bar" inputmode="decimal" value="${numInput(s.bar)}">
        <small>${t('Utilisé pour les exercices à la barre sans poids de barre précisé. Chaque exercice peut avoir sa propre barre : Plus > Exercices > Modifier.')}</small></label>
      <label class="field"><span>${t('Disques disponibles (kg, séparés par des espaces)')}</span><input name="plates" value="${esc(s.plates.map((p) => numInput(p)).join(' '))}">
        <small>${t('Sert à afficher les disques à charger de chaque côté pour les exercices à la barre.')}</small></label>
      <h2 class="block-title">${t('Affichage')}</h2>
      <label class="field"><span>${t('Thème')}</span><select name="theme">
        ${opt('auto', s.theme, t('Comme l’appareil'))}
        ${opt('light', s.theme, t('Clair'))}
        ${opt('dark', s.theme, t('Sombre'))}
      </select></label>
      <p class="fine">${t('Les réglages sont propres à chaque appareil.')}</p>
    </form>`;
  view.addEventListener('change', () => {
    const f = formData(view.querySelector('[data-form]'));
    const plates = f.plates.split(/[\s;]+/).map(calc.parseNum).filter((x) => x > 0);
    const langChanged = f.lang !== (calc.settings().lang || 'auto');
    calc.saveSettings({
      lang: f.lang,
      rest: Math.max(5, Math.round(calc.parseNum(f.rest) || 120)),
      showRir: f.showRir,
      sound: f.sound,
      wakeLock: f.wakeLock,
      bar: calc.parseNum(f.bar) ?? 20,
      plates: plates.length ? plates : calc.DEFAULT_SETTINGS.plates,
      theme: f.theme,
    });
    ctx.applyTheme();
    if (langChanged) {
      ctx.applyLang();
      return;
    }
    toast(t('Réglages enregistrés.'), { duration: 1500 });
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
    ${ctx.pageHead(t('Sauvegarde'), { back: '/plus' })}
    <section class="block">
      <h2 class="block-title">${t('Exporter')}</h2>
      <p>${t('Le fichier JSON contient tout : exercices, programmes, séances et pesées. Garde-le dans tes fichiers ou ton cloud, en plus de la synchro.')}</p>
      <div class="row-actions">
        <button class="btn primary" data-json>${t('Exporter en JSON')}</button>
        <button class="btn" data-csv>${t('Exporter les séries en CSV')}</button>
      </div>
      <p class="fine">${t('Le CSV (séparateur point-virgule) s’ouvre directement dans Excel.')}</p>
    </section>
    <section class="block">
      <h2 class="block-title">${t('Importer')}</h2>
      <p>${t('Importe un fichier JSON exporté depuis Fonte. Les données sont fusionnées : rien n’est supprimé, et la version la plus récente de chaque élément est gardée.')}</p>
      <label class="btn file-btn">${t('Choisir un fichier JSON')}<input type="file" accept="application/json,.json" data-import hidden></label>
    </section>`;

  view.addEventListener('click', async (e) => {
    const stamp = calc.localDay();
    if (e.target.closest('[data-json]')) {
      const out = { app: 'fonte', version: 1, exported_at: new Date().toISOString() };
      for (const tb of Object.keys(store.TABLES)) {
        out[tb] = store.all(tb).map((r) => {
          const o = {};
          for (const c of store.TABLES[tb].columns) if (c !== 'user_id') o[c] = r[c] ?? null;
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
            const n = (v) => (v == null ? '' : numInput(Math.round(v * 100) / 100));
            const mode = calc.itemMode(it, ex);
            rows.push([day, w.name, ex?.name || it.name, ex?.muscle || '', i + 1, s.warmup ? t('oui') : t('non'),
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
      if (data.app !== 'fonte') throw new Error(t('Ce fichier ne vient pas de Fonte.'));
      let n = 0;
      for (const tb of Object.keys(store.TABLES)) if (Array.isArray(data[tb])) n += store.importRows(tb, data[tb]);
      toast(n ? tp(n, '{n} élément importé.', '{n} éléments importés.') : t('Rien de nouveau dans ce fichier.'));
    } catch (err) {
      toast(t('Import impossible : {msg}', { msg: err.message }), { kind: 'error', duration: 6000 });
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
// Noms de fichiers des vidéos anglaises (docs/tutos/en/)
const TUTO_FILES = {
  en: {
    '1-programme-tout-fait': '1-ready-made-program',
    '2-faire-une-seance': '2-log-a-workout',
    '3-minuteur-hiit': '3-hiit-timer',
    '4-progression': '4-progress',
    '5-video-de-reference': '5-reference-video',
  },
};

export function renderHelp(view, ctx) {
  view.innerHTML = `
    ${ctx.pageHead(t('Aide et tutoriels'), { back: '/plus' })}
    <p class="block-sub">${t('Des vidéos de moins d’une minute, sans son. Il faut une connexion pour les regarder la première fois.')}</p>
    <div class="list">${TUTOS.map(([id, title, desc]) => `
      <button class="list-row" data-tuto="${id}"><span class="tuto-thumb">${icon('play')}</span>
        <span class="list-main">${esc(t(title))}<small>${esc(t(desc))}</small></span>${icon('chevron', 'row-chevron')}</button>`).join('')}
    </div>
    <section class="block soft">
      <p>${t('Pour voir comment faire un exercice, touche <strong>Voir la technique</strong> sous son nom pendant une séance. Tu peux aussi enregistrer ta propre vidéo de référence dans la fiche de l’exercice (<strong>Plus > Exercices</strong>).')}</p>
    </section>`;
  view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tuto]');
    if (!b) return;
    const [id, titleFr] = TUTOS.find((x) => x[0] === b.dataset.tuto);
    const title = t(titleFr);
    const dir = lang() === 'en' ? 'docs/tutos/en' : 'docs/tutos';
    openSheet({
      title,
      body: `<video class="tuto-video" src="${dir}/${TUTO_FILES[lang()]?.[id] || id}.mp4" autoplay muted loop playsinline controls preload="auto"
        aria-label="${esc(t('Tutoriel : {title}', { title }))}"></video>`,
    });
  });
}
