// Point d'entrée : navigation, rendu des écrans, minuteur de repos, maintien de l'écran allumé.
import * as store from './store.js';
import * as sync from './sync.js';
import * as calc from './calc.js';
import { esc, icon, $, toast } from './ui.js';
import { renderSeance, renderWorkoutEdit } from './views/workout.js';
import { renderHistory, renderHistoryDetail } from './views/history.js';
import { renderProgress, renderExerciseProgress } from './views/progress.js';
import { renderBody } from './views/body.js';
import {
  renderMore, renderExercises, renderTemplates, renderTemplateEdit,
  renderAccount, renderSettings, renderBackup,
} from './views/more.js';

const APP_VERSION = '1.0.2';

const routes = [
  [/^\/seance$/, renderSeance, 'seance'],
  [/^\/historique$/, renderHistory, 'historique'],
  [/^\/historique\/([\w-]+)$/, renderHistoryDetail, 'historique'],
  [/^\/historique\/([\w-]+)\/modifier$/, renderWorkoutEdit, 'historique'],
  [/^\/progres$/, renderProgress, 'progres'],
  [/^\/progres\/([\w-]+)$/, renderExerciseProgress, 'progres'],
  [/^\/poids$/, renderBody, 'poids'],
  [/^\/plus$/, renderMore, 'plus'],
  [/^\/exercices$/, renderExercises, 'plus'],
  [/^\/programmes$/, renderTemplates, 'plus'],
  [/^\/programmes\/([\w-]+)$/, renderTemplateEdit, 'plus'],
  [/^\/compte$/, renderAccount, 'plus'],
  [/^\/reglages$/, renderSettings, 'plus'],
  [/^\/sauvegarde$/, renderBackup, 'plus'],
];

const NAV = [
  ['seance', 'Séance'],
  ['historique', 'Historique'],
  ['progres', 'Progrès'],
  ['poids', 'Poids'],
  ['plus', 'Plus'],
];

let cleanups = [];
let pendingRender = false;
let currentPath = null;

// ---------- Contexte partagé avec les écrans ----------
export const ctx = {
  version: APP_VERSION,
  go(path) {
    if (location.hash === `#${path}`) render();
    else location.hash = path;
  },
  render: () => render(),
  applyTheme: () => applyTheme(),
  onCleanup(fn) {
    cleanups.push(fn);
  },
  pageHead,
  rest: null, // défini plus bas
  wake: null,
};

function syncLabel(s) {
  const pending = store.pendingCount();
  switch (s.status) {
    case 'local': return ['is-local', 'Sur cet appareil'];
    case 'signedout': return ['is-warn', 'Non connecté'];
    case 'syncing': return ['is-busy', 'Synchro…'];
    case 'offline': return ['is-warn', pending ? `Hors ligne, ${pending} en attente` : 'Hors ligne'];
    case 'error': return ['is-error', 'Erreur de synchro'];
    default: return ['is-ok', pending ? `${pending} en attente` : 'Synchronisé'];
  }
}

function syncPill() {
  const [cls, label] = syncLabel(sync.state);
  return `<a class="sync-pill ${cls}" href="#/compte" data-sync-pill><span class="dot"></span><span class="sync-text">${esc(label)}</span></a>`;
}

function pageHead(title, { back = null, actions = '', sub = '' } = {}) {
  return `<header class="page-head">
    ${back ? `<a class="icon-btn back" href="#${back}" aria-label="Retour">${icon('back')}</a>` : ''}
    <div class="page-title"><h1>${esc(title)}</h1>${sub ? `<p class="page-sub">${sub}</p>` : ''}</div>
    <div class="head-actions">${actions}${syncPill()}</div>
  </header>`;
}

function updateSyncPills() {
  const [cls, label] = syncLabel(sync.state);
  for (const el of document.querySelectorAll('[data-sync-pill]')) {
    el.className = `sync-pill ${cls}`;
    el.querySelector('.sync-text').textContent = label;
  }
}

// ---------- Rendu ----------
function render() {
  const path = (location.hash.replace(/^#/, '') || '/seance').split('?')[0];
  const main = $('#main');
  for (const fn of cleanups) {
    try { fn(); } catch (e) { console.error(e); }
  }
  cleanups = [];
  pendingRender = false;

  let match = null;
  for (const [re, fn, tab] of routes) {
    const m = path.match(re);
    if (m) {
      match = { fn, tab, params: m.slice(1) };
      break;
    }
  }
  if (!match) {
    location.hash = '/seance';
    return;
  }
  for (const a of document.querySelectorAll('[data-nav]')) {
    if (a.dataset.nav === match.tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  if (match.tab !== 'seance') wake.disable();
  const view = document.createElement('div');
  view.className = 'view';
  main.replaceChildren(view);
  const samePage = currentPath === path;
  currentPath = path;
  try {
    match.fn(view, ctx, ...match.params);
  } catch (e) {
    console.error(e);
    view.innerHTML = `${pageHead('Erreur')}<p class="empty">Cet écran n'a pas pu s'afficher : ${esc(e.message)}</p>`;
  }
  if (!samePage) window.scrollTo(0, 0);
}

// Re-rendu après une synchro, sans interrompre une saisie en cours.
function renderWhenIdle() {
  const a = document.activeElement;
  if (a && a.matches('input, textarea, select') && $('#main').contains(a)) {
    if (pendingRender) return;
    pendingRender = true;
    a.addEventListener('blur', () => setTimeout(() => pendingRender && render(), 50), { once: true });
    return;
  }
  if (document.querySelector('.sheet-wrap')) {
    pendingRender = true;
    return;
  }
  render();
}

// ---------- Minuteur de repos ----------
const REST_KEY = 'fonte-rest';
let audioCtx = null;

function unlockAudio() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {}
}

function beep() {
  if (!calc.settings().sound || !audioCtx) return;
  try {
    const t0 = audioCtx.currentTime;
    [0, 0.22, 0.44].forEach((d, i) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = 'sine';
      o.frequency.value = i === 2 ? 1175 : 880;
      g.gain.setValueAtTime(0.0001, t0 + d);
      g.gain.exponentialRampToValueAtTime(0.35, t0 + d + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + d + 0.18);
      o.connect(g).connect(audioCtx.destination);
      o.start(t0 + d);
      o.stop(t0 + d + 0.2);
    });
  } catch {}
}

const rest = {
  state: null, // {endsAt, duration}
  tick: null,
  start(seconds) {
    if (!seconds) return;
    this.state = { endsAt: Date.now() + seconds * 1000, duration: seconds };
    localStorage.setItem(REST_KEY, JSON.stringify(this.state));
    this.loop();
  },
  add(sec) {
    if (!this.state) return;
    this.state.endsAt += sec * 1000;
    this.state.duration = Math.max(1, this.state.duration + sec);
    localStorage.setItem(REST_KEY, JSON.stringify(this.state));
    this.draw();
  },
  stop() {
    this.state = null;
    localStorage.removeItem(REST_KEY);
    clearInterval(this.tick);
    this.tick = null;
    this.draw();
  },
  restore() {
    try {
      const s = JSON.parse(localStorage.getItem(REST_KEY) || 'null');
      if (s && s.endsAt > Date.now() - 5000) {
        this.state = s;
        this.loop();
      }
    } catch {}
  },
  loop() {
    clearInterval(this.tick);
    this.tick = setInterval(() => this.draw(), 250);
    this.draw();
  },
  draw() {
    const bar = $('#rest-bar');
    if (!this.state) {
      bar.hidden = true;
      bar.classList.remove('is-over');
      return;
    }
    const left = (this.state.endsAt - Date.now()) / 1000;
    bar.hidden = false;
    if (left <= 0) {
      if (!bar.classList.contains('is-over')) {
        bar.classList.add('is-over');
        beep();
        if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
        $('.rest-time', bar).textContent = 'Repos terminé';
        setTimeout(() => {
          if (this.state && this.state.endsAt <= Date.now()) this.stop();
        }, 6000);
      }
      return;
    }
    bar.classList.remove('is-over');
    $('.rest-time', bar).textContent = calc.fmtClock(left);
    $('.rest-progress', bar).style.transform = `scaleX(${Math.max(0, Math.min(1, left / this.state.duration))})`;
  },
};
ctx.rest = rest;

// ---------- Écran allumé pendant la séance ----------
const wake = {
  lock: null,
  want: false,
  async enable() {
    this.want = true;
    if (!calc.settings().wakeLock || !('wakeLock' in navigator) || this.lock) return;
    try {
      this.lock = await navigator.wakeLock.request('screen');
      this.lock.addEventListener('release', () => { this.lock = null; });
    } catch {}
  },
  disable() {
    this.want = false;
    if (this.lock) this.lock.release().catch(() => {});
    this.lock = null;
  },
};
ctx.wake = wake;

// ---------- Thème ----------
function applyTheme() {
  const t = calc.settings().theme;
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = t;
}

// ---------- Service worker (hors ligne + mises à jour) ----------
function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  let updating = false;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const ask = (worker) => {
      toast('Nouvelle version disponible.', {
        action: 'Mettre à jour',
        duration: 0,
        onAction: () => {
          updating = true;
          worker.postMessage('skipWaiting');
        },
      });
    };
    if (reg.waiting && navigator.serviceWorker.controller) ask(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) ask(w);
      });
    });
    setInterval(() => reg.update().catch(() => {}), 60 * 60 * 1000);
  }).catch((e) => console.warn('SW', e));
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded || !updating) return;
    reloaded = true;
    location.reload();
  });
}

// ---------- Démarrage ----------
function shell() {
  const nav = NAV.map(([id, label]) => `<a href="#/${id}" data-nav="${id}">${icon(id)}<span>${label}</span></a>`).join('');
  document.body.innerHTML = `
    <a class="skip" href="#main">Aller au contenu</a>
    <div class="app">
      <nav class="nav" aria-label="Navigation principale">
        <div class="brand" aria-hidden="true"><span class="brand-mark"></span>Fonte</div>
        ${nav}
      </nav>
      <main id="main" tabindex="-1"></main>
    </div>
    <div id="rest-bar" class="rest-bar" hidden>
      <div class="rest-progress"></div>
      <span class="rest-label">Repos</span>
      <span class="rest-time" aria-live="off">0:00</span>
      <button class="rest-btn" data-rest="-15" aria-label="Retirer 15 secondes">−15</button>
      <button class="rest-btn" data-rest="15" aria-label="Ajouter 15 secondes">+15</button>
      <button class="rest-btn rest-skip" data-rest="stop">Passer</button>
    </div>`;
  $('#rest-bar').addEventListener('click', (e) => {
    const b = e.target.closest('[data-rest]');
    if (!b) return;
    if (b.dataset.rest === 'stop') rest.stop();
    else rest.add(Number(b.dataset.rest));
  });
}

async function start() {
  applyTheme();
  shell();
  try {
    await store.load();
  } catch (e) {
    $('#main').innerHTML = `<div class="view"><p class="empty">Le stockage local est indisponible (${esc(e.message)}). Vérifie que la navigation privée est désactivée.</p></div>`;
    return;
  }
  window.addEventListener('hashchange', render);
  window.addEventListener('pointerdown', unlockAudio, { passive: true });
  store.onChange((d) => {
    if (d.silent) return;
    if (d.remote || d.wipe) renderWhenIdle();
  });
  sync.onStatus(updateSyncPills);
  store.onChange(() => updateSyncPills());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      rest.draw();
      if (wake.want) wake.enable();
    }
  });
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => {
    if (Math.abs(window.innerWidth - lastW) < 40) return;
    lastW = window.innerWidth;
    if (document.querySelector('.chart-wrap, .chart-empty')) renderWhenIdle();
  });
  rest.restore();
  render();
  registerSW();
  sync.init().catch((e) => console.error(e));
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
}

start();
