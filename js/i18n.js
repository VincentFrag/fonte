// Traduction de l'interface. Le texte français sert de clé : t('Séance') → 'Workout' en anglais.
// Les paramètres s'écrivent {nom} : t('{n} séries', { n: 3 }).
import EN from './i18n-en.js';

const SETTINGS_KEY = 'fonte-settings';
let current = null;

// Langue choisie dans les réglages ('auto', 'fr' ou 'en') ; « auto » suit la langue de l'appareil.
export function langSetting() {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}').lang || 'auto';
  } catch {
    return 'auto';
  }
}

export function detectLang() {
  const list = navigator.languages?.length ? navigator.languages : [navigator.language || 'fr'];
  return String(list[0] || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function lang() {
  if (!current) {
    const s = langSetting();
    current = s === 'fr' || s === 'en' ? s : detectLang();
  }
  return current;
}

// À appeler quand le réglage change
export function resetLang() {
  current = null;
  document.documentElement.lang = lang();
}

export function locale() {
  return lang() === 'fr' ? 'fr-FR' : 'en-GB';
}

export const decSep = () => (lang() === 'fr' ? ',' : '.');

// Nombre affiché dans un champ de saisie (séparateur décimal de la langue)
export function numInput(n) {
  return n == null ? '' : String(n).replace('.', decSep());
}

const missing = new Set();
if (typeof window !== 'undefined') window.__i18nMissing = missing;

function fill(s, params) {
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => (params[k] !== undefined && params[k] !== null ? String(params[k]) : m));
}

export function t(fr, params) {
  if (lang() === 'fr') return fill(fr, params);
  const en = EN[fr];
  if (en === undefined) {
    missing.add(fr);
    return fill(fr, params);
  }
  return fill(en, params);
}

// Pluriel : en français, 0 et 1 sont au singulier ; en anglais, seul 1 l'est.
export function tp(n, one, many, params = {}) {
  const singular = lang() === 'fr' ? Math.abs(n) < 2 : Math.abs(n) === 1;
  return t(singular ? one : many, { n, ...params });
}

// Traduction d'une valeur enregistrée en français (groupe musculaire…) sans signaler d'oubli
export function tv(fr) {
  if (lang() === 'fr' || !fr) return fr;
  return EN[fr] ?? fr;
}
