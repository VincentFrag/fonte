// Petits outils d'interface : échappement HTML, feuilles modales, confirmations, notifications.
import { t } from './i18n.js';

export function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const ICONS = {
  seance: '<path d="M3 10v4M6.5 7.5v9M17.5 7.5v9M21 10v4M6.5 12h11"/>',
  historique: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  progres: '<path d="M4 19V5M4 19h16M8 15l4-4 3 3 5-6"/>',
  poids: '<path d="M5 20h14l-1.5-11h-11z"/><circle cx="12" cy="6" r="2.2"/>',
  plus: '<circle cx="5.5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="18.5" cy="12" r="1.2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  add: '<path d="M12 5v14M5 12h14"/>',
  more: '<circle cx="12" cy="5.5" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="12" cy="18.5" r="1.2"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chevron: '<path d="M9 5l7 7-7 7"/>',
  sync: '<path d="M20 11a8 8 0 0 0-14.3-4.6L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.6L20 16M20 20v-4h-4"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  trash: '<path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  play: '<path d="M8 5.5v13l10.5-6.5z"/>',
  pause: '<path d="M8.5 5.5v13M15.5 5.5v13"/>',
  skip: '<path d="M6 5.5l9 6.5-9 6.5zM18 5.5v13"/>',
};

export function icon(name, cls = '') {
  return `<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

// ---------- Feuille modale ----------
let sheetStack = [];

export function openSheet({ title, body, actions = [], onMount, wide = false }) {
  return new Promise((resolve) => {
    const wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = `
      <div class="sheet-backdrop" data-close></div>
      <div class="sheet ${wide ? 'sheet-wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
        <header class="sheet-head">
          <h2 id="sheet-title">${esc(title)}</h2>
          <button class="icon-btn" data-close aria-label="${esc(t('Fermer'))}">${icon('close')}</button>
        </header>
        <div class="sheet-body">${body || ''}</div>
        ${actions.length ? `<footer class="sheet-actions">${actions
          .map((a, i) => `<button class="btn ${a.kind || ''}" data-action="${i}" type="${a.submit ? 'submit' : 'button'}">${esc(a.label)}</button>`)
          .join('')}</footer>` : ''}
      </div>`;
    document.body.appendChild(wrap);
    const prevFocus = document.activeElement;
    const close = (value) => {
      wrap.classList.add('closing');
      setTimeout(() => wrap.remove(), 160);
      sheetStack = sheetStack.filter((s) => s !== api);
      document.removeEventListener('keydown', onKey);
      if (prevFocus && prevFocus.focus) prevFocus.focus({ preventScroll: true });
      resolve(value);
    };
    const api = { el: wrap, close };
    sheetStack.push(api);
    const onKey = (e) => {
      if (e.key === 'Escape' && sheetStack[sheetStack.length - 1] === api) close(null);
    };
    document.addEventListener('keydown', onKey);
    wrap.addEventListener('click', async (e) => {
      if (e.target.closest('[data-close]')) return close(null);
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const a = actions[Number(btn.dataset.action)];
      if (!a) return;
      if (a.handler) {
        const res = await a.handler(wrap, api);
        if (res === false) return;
        return close(res === undefined ? a.value ?? true : res);
      }
      close(a.value ?? true);
    });
    if (onMount) onMount(wrap, api);
    requestAnimationFrame(() => {
      wrap.classList.add('open');
      const first = wrap.querySelector('[autofocus]') || wrap.querySelector('.sheet-head button');
      if (first) first.focus({ preventScroll: true });
    });
  });
}

export function confirmSheet(title, message, { ok = t('Confirmer'), danger = false } = {}) {
  return openSheet({
    title,
    body: `<p class="sheet-text">${esc(message)}</p>`,
    actions: [
      { label: t('Annuler'), value: false },
      { label: ok, kind: danger ? 'danger' : 'primary', value: true },
    ],
  }).then(Boolean);
}

// Menu d'actions simple. items : [{label, value, danger}]
export function menuSheet(title, items) {
  return openSheet({
    title,
    body: `<div class="menu-list">${items
      .map((it, i) => `<button class="menu-item ${it.danger ? 'is-danger' : ''}" data-menu="${i}">${it.icon ? icon(it.icon) : ''}<span>${esc(it.label)}</span></button>`)
      .join('')}</div>`,
    onMount(el, api) {
      el.addEventListener('click', (e) => {
        const b = e.target.closest('[data-menu]');
        if (b) api.close(items[Number(b.dataset.menu)].value);
      });
    },
  });
}

// ---------- Notifications ----------
export function toast(message, { action, onAction, duration = 3500, kind = '' } = {}) {
  let host = $('#toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    document.body.appendChild(host);
  }
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.innerHTML = `<span>${esc(message)}</span>${action ? `<button class="toast-btn">${esc(action)}</button>` : ''}`;
  host.appendChild(t);
  const remove = () => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 200);
  };
  if (action) t.querySelector('button').addEventListener('click', () => { remove(); onAction?.(); });
  if (duration) setTimeout(remove, duration);
  return remove;
}

// Lecture d'un formulaire
export function formData(root) {
  const out = {};
  for (const el of root.querySelectorAll('input[name], select[name], textarea[name]')) {
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else out[el.name] = el.value;
  }
  return out;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
