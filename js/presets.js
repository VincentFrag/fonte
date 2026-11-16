// Programmes tout faits. L'ajout crée les séances types et seulement les exercices manquants.
import * as store from './store.js';
import * as calc from './calc.js';
import { t, lang, registerNames, registerKnown } from './i18n.js';

// Exercices du catalogue : nom français → [groupe musculaire, type, nom anglais]
const EXERCISES = Object.fromEntries(calc.CATALOG.map(([fr, muscle, equipment, en]) => [fr, [muscle, equipment, en]]));

// Raccourcis d'écriture
const R = (ex, sets, min, max, rest) => ({ ex, sets, rep_min: min, rep_max: max, rest_sec: rest });
const T = (ex, sets, t, rest, int_rest = null, circuit = false) => ({ ex, sets, target_t: t, int_rest, rest_sec: rest, circuit });
const C = (ex) => ({ ex, sets: 1, rest_sec: 120 });

export const PROGRAMS = [
  {
    id: 'fullbody',
    family: 'muscu',
    name: 'Full body débutant',
    summary: '3 séances par semaine, en alternant A et B',
    description: 'Tout le corps à chaque séance, avec les mouvements de base. Idéal pour démarrer ou reprendre : progression régulière, peu de temps sur place.',
    templates: [
      { name: 'Full body A', items: [R('Squat', 3, 8, 12, 120), R('Développé couché', 3, 8, 12, 120), R('Rowing barre', 3, 8, 12, 120), R('Élévations latérales', 3, 12, 15, 60), R('Crunch à la poulie', 3, 12, 15, 60)] },
      { name: 'Full body B', items: [R('Soulevé de terre jambes tendues', 3, 8, 12, 120), R('Développé militaire', 3, 8, 12, 120), R('Tirage vertical', 3, 8, 12, 90), R('Fentes haltères', 3, 10, 12, 90), R('Curl marteau', 3, 10, 12, 60)] },
    ],
  },
  {
    id: '5x5',
    family: 'muscu',
    name: 'Force 5×5',
    summary: '3 séances par semaine, en alternant A et B',
    description: 'Peu d’exercices, des charges lourdes, 5 séries de 5. Dès que les 5 × 5 passent, l’app propose la charge suivante.',
    templates: [
      { name: '5×5 A', items: [R('Squat', 5, 5, 5, 180), R('Développé couché', 5, 5, 5, 180), R('Rowing barre', 5, 5, 5, 150)] },
      { name: '5×5 B', items: [R('Squat', 5, 5, 5, 180), R('Développé militaire', 5, 5, 5, 180), R('Soulevé de terre', 1, 5, 5, 180)] },
    ],
  },
  {
    id: 'upperlower',
    family: 'muscu',
    name: 'Haut / Bas',
    summary: '4 séances par semaine',
    description: 'Haut du corps et bas du corps en alternance, deux fois par semaine chacun. Un bon équilibre entre force et volume.',
    templates: [
      { name: 'Haut A', items: [R('Développé couché', 4, 6, 8, 150), R('Rowing barre', 4, 6, 8, 150), R('Développé militaire', 3, 8, 10, 120), R('Tirage vertical', 3, 8, 10, 90), R('Curl barre', 3, 10, 12, 60), R('Extension triceps à la poulie', 3, 10, 12, 60)] },
      { name: 'Bas A', items: [R('Squat', 4, 6, 8, 180), R('Soulevé de terre jambes tendues', 3, 8, 10, 150), R('Presse à cuisses', 3, 10, 12, 120), R('Leg curl', 3, 10, 12, 90), R('Mollets debout', 4, 12, 15, 60)] },
      { name: 'Haut B', items: [R('Développé incliné haltères', 4, 8, 10, 120), R('Tractions', 4, 6, 10, 120), R('Développé militaire haltères', 3, 8, 12, 90), R('Tirage horizontal', 3, 10, 12, 90), R('Élévations latérales', 3, 12, 15, 60), R('Barre au front', 3, 10, 12, 60)] },
      { name: 'Bas B', items: [R('Soulevé de terre', 3, 5, 5, 180), R('Fentes haltères', 3, 10, 12, 90), R('Hip thrust', 3, 8, 12, 120), R('Leg extension', 3, 12, 15, 60), R('Crunch à la poulie', 3, 12, 15, 60)] },
    ],
  },
  {
    id: 'ppl3',
    family: 'muscu',
    name: 'Push / Pull / Legs (3 jours)',
    summary: '3 séances par semaine',
    description: 'Poussée (pecs, épaules, triceps), tirage (dos, biceps) et jambes. Chaque groupe est travaillé une fois par semaine, avec du volume.',
    templates: [
      { name: 'Push', items: [R('Développé couché', 4, 6, 10, 150), R('Développé militaire', 3, 8, 10, 120), R('Développé incliné haltères', 3, 8, 12, 90), R('Élévations latérales', 3, 12, 15, 60), R('Extension triceps à la poulie', 3, 10, 12, 60), R('Dips', 3, 8, 12, 90)] },
      { name: 'Pull', items: [R('Tractions', 4, 6, 10, 120), R('Rowing barre', 4, 6, 10, 120), R('Tirage horizontal', 3, 10, 12, 90), R('Face pull', 3, 12, 15, 60), R('Curl barre', 3, 8, 12, 60), R('Curl marteau', 3, 10, 12, 60)] },
      { name: 'Legs', items: [R('Squat', 4, 6, 10, 180), R('Soulevé de terre jambes tendues', 3, 8, 10, 150), R('Presse à cuisses', 3, 10, 12, 120), R('Leg curl', 3, 10, 12, 90), R('Mollets debout', 4, 12, 15, 60)] },
    ],
  },
  {
    id: 'ppl6',
    family: 'muscu',
    name: 'Push / Pull / Legs (6 jours)',
    summary: '6 séances par semaine, deux variantes A et B',
    description: 'Le cycle Push, Pull, Legs fait deux fois par semaine, avec des exercices différents en A et en B. Pour un niveau intermédiaire, avec une bonne récupération.',
    templates: [
      { name: 'Push A', items: [R('Développé couché', 4, 6, 8, 150), R('Développé militaire', 3, 8, 10, 120), R('Développé incliné haltères', 3, 8, 12, 90), R('Élévations latérales', 3, 12, 15, 60), R('Extension triceps à la poulie', 3, 10, 12, 60)] },
      { name: 'Pull A', items: [R('Tractions', 4, 6, 10, 120), R('Rowing barre', 4, 6, 8, 150), R('Face pull', 3, 12, 15, 60), R('Curl barre', 3, 8, 12, 60)] },
      { name: 'Legs A', items: [R('Squat', 4, 6, 8, 180), R('Soulevé de terre jambes tendues', 3, 8, 10, 150), R('Leg curl', 3, 10, 12, 90), R('Mollets debout', 4, 12, 15, 60)] },
      { name: 'Push B', items: [R('Développé militaire', 4, 6, 8, 150), R('Développé incliné haltères', 4, 8, 10, 120), R('Écarté à la poulie', 3, 12, 15, 60), R('Élévations latérales', 4, 12, 15, 60), R('Barre au front', 3, 10, 12, 60)] },
      { name: 'Pull B', items: [R('Soulevé de terre', 3, 5, 5, 180), R('Tirage vertical', 4, 8, 12, 90), R('Rowing haltère', 3, 10, 12, 90), R('Oiseau haltères', 3, 12, 15, 60), R('Curl marteau', 3, 10, 12, 60)] },
      { name: 'Legs B', items: [R('Presse à cuisses', 4, 10, 12, 120), R('Fentes haltères', 3, 10, 12, 90), R('Hip thrust', 3, 8, 12, 120), R('Leg extension', 3, 12, 15, 60), R('Leg curl', 3, 10, 12, 60)] },
    ],
  },
  {
    id: 'split5',
    family: 'muscu',
    name: 'Split par groupe musculaire',
    summary: '5 séances par semaine',
    description: 'Un groupe musculaire par jour, avec beaucoup de volume sur chacun. Demande de la régularité : chaque muscle n’est travaillé qu’une fois par semaine.',
    templates: [
      { name: 'Jour pecs', items: [R('Développé couché', 4, 8, 10, 150), R('Développé incliné haltères', 4, 8, 12, 120), R('Écarté à la poulie', 3, 12, 15, 60), R('Dips', 3, 8, 12, 90)] },
      { name: 'Jour dos', items: [R('Tractions', 4, 6, 10, 120), R('Rowing barre', 4, 8, 10, 120), R('Tirage horizontal', 3, 10, 12, 90), R('Tirage vertical', 3, 10, 12, 90)] },
      { name: 'Jour épaules', items: [R('Développé militaire', 4, 8, 10, 150), R('Élévations latérales', 4, 12, 15, 60), R('Oiseau haltères', 3, 12, 15, 60), R('Face pull', 3, 12, 15, 60)] },
      { name: 'Jour bras', items: [R('Curl barre', 4, 8, 12, 90), R('Barre au front', 4, 8, 12, 90), R('Curl marteau', 3, 10, 12, 60), R('Extension triceps à la poulie', 3, 10, 12, 60)] },
      { name: 'Jour jambes', items: [R('Squat', 4, 6, 10, 180), R('Presse à cuisses', 3, 10, 12, 120), R('Soulevé de terre jambes tendues', 3, 8, 10, 150), R('Leg curl', 3, 10, 12, 90), R('Mollets debout', 4, 12, 15, 60)] },
    ],
  },
  {
    id: 'pdc',
    family: 'muscu',
    name: 'Poids du corps / maison',
    summary: '3 séances par semaine, en alternant A et B',
    description: 'Sans matériel, à part une barre de traction. Tu peux ajouter du lest quand les répétitions deviennent faciles.',
    templates: [
      { name: 'Poids du corps A', items: [R('Pompes', 4, 8, 15, 90), R('Tractions', 4, 5, 10, 120), R('Squat bulgare', 3, 8, 12, 90), R('Dips', 3, 6, 12, 90), T('Planche', 3, 45, 60)] },
      { name: 'Poids du corps B', items: [R('Pompes', 4, 8, 15, 90), R('Rowing inversé', 4, 8, 12, 90), R('Fentes au poids du corps', 3, 10, 15, 90), R('Pont fessier', 3, 12, 20, 60), T('Hollow hold', 3, 30, 60)] },
    ],
  },
  {
    id: 'tabata',
    family: 'cardio',
    name: 'HIIT Tabata',
    summary: '4 exercices, 8 × 20 s d’effort et 10 s de récup chacun',
    description: 'Le format Tabata : 20 secondes à fond, 10 secondes de récup, 8 fois de suite, puis 1 minute de pause avant l’exercice suivant. Environ 20 minutes, minuteur compris.',
    templates: [
      { name: 'Tabata', items: [T('Burpees', 8, 20, 60, 10), T('Mountain climbers', 8, 20, 60, 10), T('Jumping jacks', 8, 20, 60, 10), T('Squats sautés', 8, 20, 60, 10)] },
    ],
  },
  {
    id: 'hiit',
    family: 'cardio',
    name: 'HIIT circuit',
    summary: '5 exercices enchaînés, 40 s d’effort et 20 s de récup, 3 tours',
    description: 'Les exercices s’enchaînent en circuit, avec 1 minute de pause entre les tours. Environ 16 minutes, minuteur compris.',
    templates: [
      { name: 'HIIT circuit', items: [T('Burpees', 3, 40, 60, 20, true), T('Squats sautés', 3, 40, 60, 20, true), T('Mountain climbers', 3, 40, 60, 20, true), T('Fentes sautées', 3, 40, 60, 20, true), T('Montées de genoux', 3, 40, 60, 20, true)] },
    ],
  },
  {
    id: 'cardio',
    family: 'cardio',
    name: 'Cardio continu',
    summary: 'Course, vélo, rameur ou elliptique',
    description: 'Une séance qui propose les quatre activités : remplis celle que tu as faite (durée et distance), les autres disparaissent à la fin de la séance. L’app calcule l’allure et la vitesse.',
    templates: [
      { name: 'Cardio', items: [C('Course à pied'), C('Vélo'), C('Rameur'), C('Elliptique')] },
    ],
  },
  {
    id: 'core',
    family: 'cardio',
    name: 'Gainage et abdos',
    summary: '4 exercices, environ 15 minutes',
    description: 'Gainage en durée et relevés de jambes. Le minuteur enchaîne les efforts et les repos pour toi. Pour la planche latérale, fais chaque côté à tour de rôle.',
    templates: [
      { name: 'Gainage', items: [T('Planche', 3, 45, 60, 30), T('Planche latérale', 4, 30, 60, 15), T('Hollow hold', 3, 30, 60, 30), R('Relevés de jambes', 3, 10, 15, 60)] },
    ],
  },
];

registerNames(Object.entries(EXERCISES).map(([fr, v]) => [fr, v[2]]));
registerKnown(PROGRAMS.flatMap((p) => p.templates.map((tpl) => tpl.name)));

export function programExercises(p) {
  return [...new Set(p.templates.flatMap((tpl) => tpl.items.map((i) => i.ex)))];
}

// Nom d'un exercice du catalogue dans la langue de l'app
export function exLabel(fr) {
  return lang() === 'en' ? EXERCISES[fr]?.[2] || fr : fr;
}

// Cherche l'exercice chez l'utilisateur, sous son nom français ou anglais
export function findExercise(fr) {
  const names = new Set([fr, EXERCISES[fr]?.[2]].filter(Boolean).map((n) => n.toLowerCase()));
  const list = store.all('exercises');
  return list.find((e) => e.name.toLowerCase() === exLabel(fr).toLowerCase())
    || list.find((e) => names.has(e.name.toLowerCase())) || null;
}

// Renvoie l'exercice du catalogue chez l'utilisateur, en le créant s'il manque.
export function ensureExercise(fr) {
  const found = findExercise(fr);
  if (found) return found;
  const [muscle, equipment] = EXERCISES[fr] || ['Autre', 'autre'];
  return store.save('exercises', {
    id: store.uuid(), name: exLabel(fr), muscle, equipment,
    increment: ['duree', 'cardio'].includes(equipment) ? null : calc.defaultIncrement(equipment),
    notes: '',
  });
}

// Exercices du catalogue que l'utilisateur n'a pas encore (nom français)
export function catalogMissing() {
  return calc.CATALOG.map((r) => r[0]).filter((fr) => !findExercise(fr));
}

// Exercices du programme qui n'existent pas encore chez l'utilisateur
export function missingExercises(p) {
  return programExercises(p).filter((n) => !findExercise(n));
}

export function addProgram(p) {
  const ids = {};
  for (const fr of programExercises(p)) ids[fr] = ensureExercise(fr).id;
  const names = new Set(store.all('templates').map((x) => x.name.toLowerCase()));
  let position = store.all('templates').length;
  const created = [];
  for (const tpl of p.templates) {
    const base = t(tpl.name);
    let name = base;
    for (let k = 2; names.has(name.toLowerCase()); k++) name = `${base} (${k})`;
    names.add(name.toLowerCase());
    created.push(store.save('templates', {
      id: store.uuid(),
      name,
      position: position++,
      notes: '',
      items: tpl.items.map(({ ex, ...rest }) => ({ exercise_id: ids[ex], ...rest })),
    }));
  }
  return created;
}
