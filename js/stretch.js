// Étirements sur demande : une courte routine guidée, composée selon les muscles travaillés.
// Chaque étirement se tient 30 secondes (de chaque côté quand il se fait d'un côté à la fois).
import * as store from './store.js';
import * as calc from './calc.js';
import { esc, icon } from './ui.js';
import { t, tp, lang, dn } from './i18n.js';

export const HOLD = 30; // secondes par étirement (et par côté)
const READY = 8; // mise en place avant chaque étirement
const SWITCH = 5; // changement de côté
const MAX = 8;

// Ordre de la routine : debout d'abord, puis au sol.
// side : true si l'étirement se fait d'un côté puis de l'autre.
const STRETCHES = [
  {
    id: 'chest', side: true,
    fr: ['Pectoraux contre un mur', 'Avant-bras contre un mur ou un montant de porte, coude à hauteur d’épaule. Avance doucement le buste jusqu’à sentir l’étirement dans la poitrine.'],
    en: ['Wall chest stretch', 'Forearm against a wall or door frame, elbow at shoulder height. Gently step forward until you feel the stretch in your chest.'],
  },
  {
    id: 'shoulder', side: true,
    fr: ['Épaule, bras croisé', 'Passe un bras tendu devant la poitrine et rapproche-le avec l’autre main, au-dessus du coude. Garde l’épaule basse.'],
    en: ['Cross-body shoulder stretch', 'Bring one straight arm across your chest and pull it closer with the other hand, above the elbow. Keep the shoulder down.'],
  },
  {
    id: 'triceps', side: true,
    fr: ['Triceps derrière la tête', 'Lève un bras, plie le coude pour poser la main entre les omoplates. Avec l’autre main, pousse doucement le coude vers l’arrière.'],
    en: ['Overhead triceps stretch', 'Raise one arm and bend the elbow so your hand rests between your shoulder blades. Gently push the elbow back with the other hand.'],
  },
  {
    id: 'biceps', side: true,
    fr: ['Biceps contre un mur', 'Main à plat contre un mur, bras tendu à hauteur d’épaule, pouce vers le haut. Tourne lentement le buste du côté opposé.'],
    en: ['Wall biceps stretch', 'Palm flat on a wall, arm straight at shoulder height, thumb up. Slowly turn your chest away from the wall.'],
  },
  {
    id: 'forearm', side: true,
    fr: ['Avant-bras et poignet', 'Bras tendu devant toi, paume vers le haut. Avec l’autre main, tire doucement les doigts vers le bas.'],
    en: ['Forearm and wrist stretch', 'Arm straight in front of you, palm up. Gently pull your fingers down with the other hand.'],
  },
  {
    id: 'lats', side: true,
    fr: ['Grand dorsal', 'Attrape un support à hauteur de hanche d’une main, recule les hanches et laisse le bras et le flanc s’allonger.'],
    en: ['Lat stretch', 'Hold a support at hip height with one hand, push your hips back and let your arm and side lengthen.'],
  },
  {
    id: 'calf', side: true,
    fr: ['Mollets contre un mur', 'Mains au mur, une jambe tendue derrière, talon au sol. Plie la jambe avant jusqu’à sentir l’étirement dans le mollet arrière.'],
    en: ['Wall calf stretch', 'Hands on the wall, one leg straight behind you, heel down. Bend the front knee until you feel the stretch in the back calf.'],
  },
  {
    id: 'quad', side: true,
    fr: ['Quadriceps debout', 'Debout, attrape ta cheville et rapproche le talon des fesses. Genoux côte à côte, bassin légèrement basculé vers l’avant. Tiens-toi à un mur si besoin.'],
    en: ['Standing quad stretch', 'Standing, hold your ankle and bring the heel toward your glutes. Knees together, hips slightly tucked. Hold a wall if needed.'],
  },
  {
    id: 'hipflexor', side: true,
    fr: ['Fente basse, hanche en avant', 'Un genou au sol, l’autre pied devant. Serre les fessiers et avance doucement le bassin jusqu’à sentir l’avant de la hanche s’étirer.'],
    en: ['Kneeling hip flexor stretch', 'One knee on the floor, the other foot in front. Squeeze your glutes and gently push your hips forward until you feel the front of the hip stretch.'],
  },
  {
    id: 'hamstring', side: true,
    fr: ['Ischios assis', 'Assis, une jambe tendue, l’autre pliée. Penche-toi vers le pied de la jambe tendue, dos droit, sans forcer.'],
    en: ['Seated hamstring stretch', 'Seated, one leg straight, the other bent. Lean toward the foot of the straight leg, back straight, without forcing.'],
  },
  {
    id: 'glute', side: true,
    fr: ['Fessier allongé', 'Sur le dos, pose une cheville sur le genou opposé, puis ramène les deux jambes vers toi en tenant la cuisse.'],
    en: ['Figure-four glute stretch', 'On your back, cross one ankle over the opposite knee, then pull both legs toward you by holding the thigh.'],
  },
  {
    id: 'twist', side: true,
    fr: ['Torsion allongée', 'Sur le dos, ramène un genou plié de l’autre côté du corps, épaules au sol, regard du côté opposé.'],
    en: ['Supine twist', 'On your back, bring one bent knee across your body, shoulders on the floor, looking the other way.'],
  },
  {
    id: 'child', side: false,
    fr: ['Posture de l’enfant', 'À genoux, assieds-toi sur les talons, puis allonge les bras loin devant toi, front vers le sol. Respire lentement.'],
    en: ['Child’s pose', 'Kneeling, sit back on your heels and reach your arms far forward, forehead toward the floor. Breathe slowly.'],
  },
  {
    id: 'cobra', side: false,
    fr: ['Cobra', 'Allongé sur le ventre, mains sous les épaules. Pousse doucement pour relever le buste, hanches au sol, épaules basses.'],
    en: ['Cobra stretch', 'Lying face down, hands under your shoulders. Gently push up to lift your chest, hips on the floor, shoulders down.'],
  },
];

// Groupe musculaire → étirements utiles
const FOR_MUSCLE = {
  'Pectoraux': ['chest', 'shoulder'],
  'Dos': ['lats', 'child', 'twist'],
  'Épaules': ['shoulder', 'chest'],
  'Biceps': ['biceps', 'forearm'],
  'Triceps': ['triceps'],
  'Avant-bras': ['forearm'],
  'Quadriceps': ['quad', 'hipflexor'],
  'Ischios': ['hamstring', 'glute'],
  'Fessiers': ['glute', 'hipflexor'],
  'Mollets': ['calf'],
  'Abdos': ['cobra', 'twist'],
  'Corps entier': ['quad', 'hamstring', 'hipflexor', 'chest'],
  'Cardio': ['calf', 'quad', 'hamstring', 'hipflexor'],
};

const FULL_BODY = ['chest', 'shoulder', 'lats', 'quad', 'hipflexor', 'hamstring', 'glute', 'child'];

const byId = new Map(STRETCHES.map((s) => [s.id, s]));
const label = (s) => (lang() === 'en' ? s.en : s.fr);
export const stretchName = (s) => label(s)[0];
export const stretchHow = (s) => label(s)[1];

// Routine adaptée à une séance : les muscles les plus travaillés passent en premier.
export function routineFor(workout) {
  const score = new Map();
  for (const it of workout?.items || []) {
    const ex = store.getAny('exercises', it.exercise_id);
    const n = it.sets.filter((x) => x.done && !x.warmup).length;
    if (!n) continue;
    (FOR_MUSCLE[ex?.muscle] || []).forEach((id, rank) => {
      score.set(id, (score.get(id) || 0) + n / (rank + 1));
    });
  }
  let ids = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, MAX).map(([id]) => id);
  // Trop peu d'étirements : on complète, en commençant par le bas du corps et le dos
  for (const id of ['hamstring', 'glute', 'child', 'lats', 'chest', 'shoulder', 'quad', 'hipflexor']) if (ids.length < 4 && !ids.includes(id)) ids.push(id);
  const order = STRETCHES.map((s) => s.id);
  ids.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return ids.map((id) => byId.get(id));
}

export const fullBodyRoutine = () => FULL_BODY.map((id) => byId.get(id));

// Durée totale, en secondes, mises en place comprises
export function routineSeconds(list) {
  return list.reduce((n, s) => n + READY + (s.side ? HOLD * 2 + SWITCH : HOLD), 0);
}

export function routineMinutes(list) {
  return Math.max(1, Math.round(routineSeconds(list) / 60));
}

// ---------- Suivi « étirements faits » (sur cet appareil) ----------
const DONE_KEY = 'fonte-stretched';
function doneList() {
  try { return JSON.parse(localStorage.getItem(DONE_KEY) || '[]'); } catch { return []; }
}
export function stretchedAfter(workoutId) {
  return Boolean(workoutId) && doneList().includes(workoutId);
}
function markStretched(workoutId) {
  if (!workoutId) return;
  try {
    const l = doneList().filter((x) => x !== workoutId);
    l.push(workoutId);
    localStorage.setItem(DONE_KEY, JSON.stringify(l.slice(-300)));
  } catch {}
}

// Bloc affiché sous une séance terminée
export function stretchBlockHtml(w) {
  const list = routineFor(w);
  const done = stretchedAfter(w.id);
  return `<section class="block stretch-block">
    <div class="stretch-text">
      <h2 class="block-title">${t('Étirements')}${done ? ` <span class="tag done-tag">${icon('check')}${t('faits')}</span>` : ''}</h2>
      <p>${esc(tp(list.length, '{n} étirement adapté à cette séance, environ {m} min.', '{n} étirements adaptés à cette séance, environ {m} min.', { m: routineMinutes(list) }))}</p>
      <p class="stretch-list">${esc(list.map(stretchName).join(', '))}</p>
    </div>
    <button class="btn ${done ? '' : 'primary'}" data-stretch>${icon('play')}<span>${done ? t('Recommencer') : t('Commencer')}</span></button>
  </section>`;
}

// ---------- Déroulé guidé ----------
export function openStretches(ctx, list, { workoutId = null, onEnd } = {}) {
  if (!list.length) return;
  const steps = [];
  list.forEach((s, i) => {
    steps.push({ kind: 'ready', s, dur: READY, index: i });
    if (s.side) {
      steps.push({ kind: 'hold', s, dur: HOLD, side: 1, index: i });
      steps.push({ kind: 'switch', s, dur: SWITCH, index: i });
      steps.push({ kind: 'hold', s, dur: HOLD, side: 2, index: i });
    } else {
      steps.push({ kind: 'hold', s, dur: HOLD, index: i });
    }
  });

  const el = document.createElement('div');
  el.className = 'timer-wrap stretch-wrap';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', t('Étirements'));
  el.innerHTML = `
    <div class="timer-top">
      <span class="timer-round" data-round></span>
      <button class="timer-close" data-stop>${t('Arrêter')}</button>
    </div>
    <div class="timer-main">
      <p class="timer-phase" data-phase></p>
      <p class="timer-ex" data-ex></p>
      <p class="stretch-how" data-how></p>
      <p class="timer-time" data-time aria-live="off"></p>
      <div class="timer-bar"><span data-bar></span></div>
      <p class="timer-next" data-next></p>
    </div>
    <div class="timer-actions">
      <button class="timer-btn-big" data-pause>${icon('pause')}<span>${t('Pause')}</span></button>
      <button class="timer-btn-big ghost" data-skip>${icon('skip')}<span>${t('Passer')}</span></button>
    </div>`;
  document.body.appendChild(el);
  document.body.classList.add('timer-open');
  ctx.wake?.enable();

  let idx = 0;
  let stepStart = Date.now();
  let pausedAt = null;
  let lastSecond = null;
  let finished = false;
  const $ = (q) => el.querySelector(q);

  function paint() {
    const st = steps[idx];
    el.dataset.phase = st.kind === 'hold' ? 'hold' : 'ready';
    const sideTxt = st.side ? (st.side === 1 ? t('Premier côté') : t('Second côté')) : '';
    $('[data-phase]').textContent = st.kind === 'ready' ? t('Mets-toi en place') : st.kind === 'switch' ? t('Change de côté') : sideTxt || t('Tiens la position');
    $('[data-ex]').textContent = stretchName(st.s);
    $('[data-how]').textContent = stretchHow(st.s);
    $('[data-round]').textContent = t('{i} / {n}', { i: st.index + 1, n: list.length });
    const next = list[st.index + 1];
    $('[data-next]').textContent = st.kind === 'hold' && (!st.s.side || st.side === 2) ? (next ? t('Ensuite : {name}', { name: stretchName(next) }) : t('Dernier étirement')) : '';
  }

  function end(done) {
    if (finished) return;
    finished = true;
    clearInterval(tick);
    document.removeEventListener('visibilitychange', onVis);
    if (done) {
      markStretched(workoutId);
      ctx.sound?.done();
      el.dataset.phase = 'done';
      $('[data-phase]').textContent = t('Terminé');
      $('[data-ex]').textContent = t('Bien joué.');
      for (const q of ['[data-how]', '[data-time]', '[data-next]', '[data-round]']) $(q).textContent = '';
      $('.timer-actions').hidden = true;
      setTimeout(close, 1800);
    } else close();
  }

  function close() {
    el.remove();
    document.body.classList.remove('timer-open');
    onEnd?.();
  }

  function frame() {
    if (finished || pausedAt) return;
    let now = Date.now();
    while (now - stepStart >= steps[idx].dur * 1000) {
      stepStart += steps[idx].dur * 1000;
      idx++;
      lastSecond = null;
      if (idx >= steps.length) return end(true);
      if (now - stepStart < 1000) {
        const k = steps[idx].kind;
        if (k === 'hold') ctx.sound?.go();
        else ctx.sound?.rest();
        if (navigator.vibrate) navigator.vibrate(k === 'hold' ? [120, 60, 120] : 200);
      }
      paint();
      now = Date.now();
    }
    const st = steps[idx];
    const left = st.dur - (now - stepStart) / 1000;
    const sec = Math.ceil(left);
    $('[data-time]').textContent = String(sec);
    $('[data-bar]').style.transform = `scaleX(${Math.max(0, Math.min(1, left / st.dur))})`;
    if (sec !== lastSecond) {
      if (sec <= 3 && sec >= 1 && lastSecond !== null) ctx.sound?.tick();
      lastSecond = sec;
    }
  }

  const onVis = () => {
    if (document.visibilityState === 'visible') {
      ctx.wake?.enable();
      frame();
    }
  };
  document.addEventListener('visibilitychange', onVis);

  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-stop]')) return end(false);
    const pb = e.target.closest('[data-pause]');
    if (pb) {
      if (pausedAt) {
        stepStart += Date.now() - pausedAt;
        pausedAt = null;
        pb.innerHTML = `${icon('pause')}<span>${t('Pause')}</span>`;
        el.classList.remove('is-paused');
      } else {
        pausedAt = Date.now();
        pb.innerHTML = `${icon('play')}<span>${t('Reprendre')}</span>`;
        el.classList.add('is-paused');
      }
      return;
    }
    if (e.target.closest('[data-skip]')) {
      if (pausedAt) {
        stepStart += Date.now() - pausedAt;
        pausedAt = null;
        el.classList.remove('is-paused');
        el.querySelector('[data-pause]').innerHTML = `${icon('pause')}<span>${t('Pause')}</span>`;
      }
      stepStart = Date.now() - steps[idx].dur * 1000;
      frame();
    }
  });

  paint();
  const tick = setInterval(frame, 200);
  frame();
  el.querySelector('[data-pause]').focus({ preventScroll: true });
}

// ---------- Écran Plus > Étirements ----------
export function renderStretches(view, ctx) {
  const done = calc.finishedWorkouts();
  const last = done[done.length - 1] || null;
  const recent = last && Date.now() - Date.parse(last.ended_at || last.started_at) < 2 * 86400000 ? last : null;
  const after = recent ? routineFor(recent) : null;
  const full = fullBodyRoutine();
  const card = (key, title, sub, list) => `<section class="stretch-card">
      <h2 class="block-title">${esc(title)}</h2>
      <p class="block-sub">${esc(sub)}</p>
      <ol class="stretch-ol">${list.map((s) => `<li><strong>${esc(stretchName(s))}</strong><span>${esc(s.side ? t('{s} s de chaque côté', { s: HOLD }) : t('{s} s', { s: HOLD }))}</span></li>`).join('')}</ol>
      <button class="btn primary block" data-run="${key}">${icon('play')}<span>${esc(t('Commencer, environ {n} min', { n: routineMinutes(list) }))}</span></button>
    </section>`;
  view.innerHTML = `
    ${ctx.pageHead(t('Étirements'), { back: '/plus' })}
    <p class="block-sub">${t('Une courte routine guidée : chaque étirement se tient 30 secondes, de chaque côté si besoin. Étire-toi sans à-coups, jusqu’à une tension confortable, jamais jusqu’à la douleur.')}</p>
    ${after ? card('after', t('Après ta dernière séance'), t('{name}, {when}', { name: dn(recent.name) || t('Séance'), when: calc.relDays(recent.started_at) }), after) : ''}
    ${card('full', t('Routine corps entier'), t('Tous les grands groupes musculaires.'), full)}`;
  view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-run]');
    if (!b) return;
    if (b.dataset.run === 'after') openStretches(ctx, after, { workoutId: recent.id });
    else openStretches(ctx, full);
  });
}
