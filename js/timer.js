// Minuteur d'intervalles : Tabata, circuits HIIT, gainage.
// Enchaîne effort / récup à partir de l'exercice choisi et coche les séries au fil de l'eau.
// Le temps est calculé à partir d'horodatages : il reste juste si l'écran se verrouille.
import * as store from './store.js';
import * as calc from './calc.js';
import { icon } from './ui.js';
import { t, dn } from './i18n.js';

const isTimed = (it) => calc.itemMode(it, store.getAny('exercises', it.exercise_id)) === 'duree';
const nameOf = (it) => dn(store.getAny('exercises', it.exercise_id)?.name || it.name) || t('Exercice');

// Construit la suite d'étapes à partir de l'exercice startUid (inclus) jusqu'à la fin de la séance.
export function buildSteps(w, startUid) {
  const items = w.items;
  let i = Math.max(0, items.findIndex((it) => it.uid === startUid));
  const steps = [];
  while (i < items.length) {
    const it = items[i];
    if (!isTimed(it)) {
      i++;
      continue;
    }
    if (it.circuit) {
      // Exercices voisins en circuit : on tourne entre eux, tour après tour
      const group = [];
      while (i < items.length && isTimed(items[i]) && items[i].circuit) group.push(items[i++]);
      const todo = group.map((g) => g.sets.filter((s) => !s.done && !s.warmup && s.t > 0));
      const rounds = Math.max(0, ...todo.map((l) => l.length));
      for (let r = 0; r < rounds; r++) {
        group.forEach((g, gi) => {
          const set = todo[gi][r];
          if (!set) return;
          steps.push({ kind: 'work', item: g, set, dur: set.t, round: r + 1, rounds, circuit: true });
          const endOfRound = gi === group.length - 1;
          steps.push({ kind: 'rest', dur: endOfRound ? g.rest_sec ?? 60 : g.int_rest ?? 15 });
        });
      }
    } else {
      const todo = it.sets.filter((s) => !s.done && !s.warmup && s.t > 0);
      todo.forEach((set, k) => {
        steps.push({ kind: 'work', item: it, set, dur: set.t, round: k + 1, rounds: todo.length });
        const last = k === todo.length - 1;
        steps.push({ kind: 'rest', dur: last ? it.rest_sec ?? 60 : it.int_rest ?? it.rest_sec ?? 30 });
      });
      i++;
    }
  }
  while (steps.length && steps[steps.length - 1].kind === 'rest') steps.pop();
  const out = [{ kind: 'ready', dur: 5 }, ...steps.filter((s) => s.dur > 0)];
  // Pour chaque étape, la prochaine phase d'effort (affichée en « Ensuite »)
  for (let k = 0; k < out.length; k++) out[k].next = out.slice(k + 1).find((s) => s.kind === 'work') || null;
  return out;
}

export function runIntervals(ctx, w, startUid, { onStep, onEnd }) {
  const steps = buildSteps(w, startUid);
  if (steps.length <= 1) return;

  const el = document.createElement('div');
  el.className = 'timer-wrap';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', t('Minuteur d’intervalles'));
  el.innerHTML = `
    <div class="timer-top">
      <span class="timer-round" data-round></span>
      <button class="timer-close" data-stop>${t('Arrêter')}</button>
    </div>
    <div class="timer-main">
      <p class="timer-phase" data-phase></p>
      <p class="timer-ex" data-ex></p>
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

  let idx = 0;
  let stepStart = Date.now();
  let pausedAt = null;
  let lastSecond = null;
  let finished = false;
  const $ = (s) => el.querySelector(s);

  const describe = (st) => {
    if (!st) return '';
    return `${nameOf(st.item)}${st.rounds > 1 ? `, ${t(st.circuit ? 'tour {r}/{n}' : 'série {r}/{n}', { r: st.round, n: st.rounds })}` : ''}`;
  };

  function paint() {
    const st = steps[idx];
    el.dataset.phase = st.kind;
    $('[data-phase]').textContent = t({ ready: 'Prépare-toi', work: 'Effort', rest: 'Récup' }[st.kind]);
    $('[data-ex]').textContent = st.kind === 'work' ? nameOf(st.item) : st.next ? t('Ensuite : {name}', { name: nameOf(st.next.item) }) : '';
    $('[data-round]').textContent = st.kind === 'work' && st.rounds > 1 ? t(st.circuit ? 'Tour {r} / {n}' : 'Série {r} / {n}', { r: st.round, n: st.rounds }) : '';
    const after = st.kind === 'work' ? steps.slice(idx + 1).find((s) => s.kind === 'work') : null;
    $('[data-next]').textContent = st.kind === 'work' ? (after ? t('Après : {what}', { what: describe(after) }) : t('Dernier effort')) : '';
  }

  function completeStep(st) {
    if (st.kind === 'work' && st.set && !st.skipped) {
      st.set.done = true;
      st.set.at = new Date().toISOString();
      onStep?.();
    }
  }

  function end(done) {
    if (finished) return;
    finished = true;
    clearInterval(tick);
    document.removeEventListener('visibilitychange', onVis);
    if (done) {
      ctx.sound?.done();
      el.dataset.phase = 'done';
      $('[data-phase]').textContent = t('Terminé');
      $('[data-ex]').textContent = t('Bien joué.');
      $('[data-time]').textContent = '';
      $('[data-next]').textContent = '';
      $('[data-round]').textContent = '';
      $('.timer-actions').hidden = true;
      setTimeout(close, 1800);
    } else {
      close();
    }
  }

  function close() {
    el.remove();
    document.body.classList.remove('timer-open');
    onEnd?.();
  }

  function frame() {
    if (finished || pausedAt) return;
    let now = Date.now();
    // Rattrapage : si l'app a été mise en arrière-plan, on avance d'autant d'étapes que nécessaire
    while (now - stepStart >= steps[idx].dur * 1000) {
      completeStep(steps[idx]);
      stepStart += steps[idx].dur * 1000;
      idx++;
      lastSecond = null;
      if (idx >= steps.length) return end(true);
      const st = steps[idx];
      if (now - stepStart < 1000) {
        if (st.kind === 'work') ctx.sound?.go();
        else ctx.sound?.rest();
        if (navigator.vibrate) navigator.vibrate(st.kind === 'work' ? [120, 60, 120] : 200);
      }
      paint();
      now = Date.now();
    }
    const st = steps[idx];
    const left = st.dur - (now - stepStart) / 1000;
    const sec = Math.ceil(left);
    $('[data-time]').textContent = sec >= 60 ? calc.fmtClock(sec) : String(sec);
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
    if (e.target.closest('[data-pause]')) {
      const b = e.target.closest('[data-pause]');
      if (pausedAt) {
        stepStart += Date.now() - pausedAt;
        pausedAt = null;
        b.innerHTML = `${icon('pause')}<span>${t('Pause')}</span>`;
        el.classList.remove('is-paused');
      } else {
        pausedAt = Date.now();
        b.innerHTML = `${icon('play')}<span>${t('Reprendre')}</span>`;
        el.classList.add('is-paused');
      }
      return;
    }
    if (e.target.closest('[data-skip]')) {
      // Passer : l'étape en cours est considérée comme terminée
      if (pausedAt) {
        stepStart += Date.now() - pausedAt;
        pausedAt = null;
        el.classList.remove('is-paused');
        el.querySelector('[data-pause]').innerHTML = `${icon('pause')}<span>${t('Pause')}</span>`;
      }
      // Un effort passé n'est pas coché ; une récup passée enchaîne simplement
      if (steps[idx].kind === 'work') steps[idx].skipped = true;
      stepStart = Date.now() - steps[idx].dur * 1000;
      frame();
    }
  });

  paint();
  const tick = setInterval(frame, 200);
  frame();
  el.querySelector('[data-pause]').focus({ preventScroll: true });
}

