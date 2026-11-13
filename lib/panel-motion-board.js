// Product panel motion on the landing page: the browser side. Each drawn panel plays once when half
// of it is on screen, then rests on the same final state the static HTML shows. The head script adds
// the "motion" class to <html> only when motion is allowed; without that class this file does nothing
// and the CSS leaves the static page alone.
import { formatDollars, parseDollars, easedDollars, computeStepStates, computeBarPercent, isHalfVisible } from './panel-motion.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function countUp(el, from, to, ms) {
  return new Promise((resolve) => {
    const start = performance.now();
    const frame = (now) => {
      const progress = (now - start) / ms;
      el.textContent = formatDollars(easedDollars(from, to, progress));
      progress < 1 ? requestAnimationFrame(frame) : resolve();
    };
    requestAnimationFrame(frame);
  });
}

// Restart a one-shot CSS animation on an element that may already have played it.
function replayClass(el, name) {
  el.classList.remove(name);
  void el.offsetWidth;
  el.classList.add(name);
}

const CHECK_MARK = '<span class="check"><svg viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg></span>';
const STEP_MARKS = { done: CHECK_MARK, active: '<span class="spin"></span>', waiting: '<span class="dot"></span>' };

// Hero: the beta compute screen, then the strategies slide in and their amounts and the total count up.
function heroPanel(root) {
  const hero = root.querySelector('.shot');
  const total = hero.querySelector('.app-total strong');
  const pill = hero.querySelector('.app-total em');
  const rows = [...hero.querySelectorAll('.strat')];
  const amounts = rows.map((row) => parseDollars(row.querySelector('.amt').textContent));
  const steps = [...hero.querySelectorAll('.compute-step')];
  const bar = hero.querySelector('.compute-bar div');

  const setPhase = (phase) => {
    computeStepStates(phase, steps.length).forEach((state, i) => {
      const step = steps[i];
      if (step.dataset.state === state) return;
      step.dataset.state = state;
      step.classList.toggle('done', state === 'done');
      step.classList.toggle('active', state === 'active');
      step.querySelector('.compute-mark').innerHTML = STEP_MARKS[state];
    });
    bar.style.width = computeBarPercent(phase) + '%';
  };

  return {
    el: hero,
    reset() {
      setPhase(-1);
      total.textContent = formatDollars(0);
      rows.forEach((row) => { row.querySelector('.amt').textContent = formatDollars(0); });
    },
    async play() {
      // Same cadence as the beta compute screen, shortened: about 0.9 seconds a step, then every
      // step checks off, the bar fills, and the layer fades to reveal the results.
      for (const phase of [0, 1, 2, 3]) {
        setPhase(phase);
        await wait(phase < 3 ? 900 : 500);
      }
      hero.classList.add('loaded');
      await wait(300);
      let running = 0;
      for (let i = 0; i < rows.length; i++) {
        rows[i].classList.add('in');
        countUp(rows[i].querySelector('.amt'), 0, amounts[i], 700);
        countUp(total, running, running + amounts[i], 700);
        running += amounts[i];
        await wait(380);
      }
      await wait(450);
      pill.classList.add('in');
    },
  };
}

// Step 1: a pointer taps each pressed answer in turn. It never clicks and never changes aria-pressed:
// until it reaches an answer, CSS only draws that answer as unpressed (class "shown" lifts that),
// so the intake banner and analytics only ever see the visitor's own taps. A real tap stops it.
function intakePanel(root) {
  const panel = root.getElementById('intakePanel');
  const cursor = panel.querySelector('.fake-cursor');
  const groups = [...panel.querySelectorAll('.opts')];
  const answers = groups.map((group) => group.querySelector('[aria-pressed="true"]'));
  let visitorTapped = false;
  panel.addEventListener('click', (e) => {
    if (!e.target.closest('.opt')) return;
    visitorTapped = true;
    panel.classList.add('played');
    cursor.style.opacity = '0';
  }, true);

  const pointAt = (button) => {
    const panelBox = panel.getBoundingClientRect();
    const box = button.getBoundingClientRect();
    cursor.style.transform = `translate(${box.left - panelBox.left + box.width * 0.6}px, ${box.top - panelBox.top + box.height * 0.55}px)`;
  };

  return {
    el: panel,
    reset() {},
    async play() {
      if (visitorTapped) return;
      cursor.style.transition = 'none';
      cursor.style.transform = `translate(${panel.clientWidth - 40}px, ${panel.clientHeight - 30}px)`;
      void cursor.offsetWidth;
      cursor.style.transition = '';
      cursor.style.opacity = '1';
      await wait(250);
      for (const answer of answers) {
        if (visitorTapped) return;
        pointAt(answer);
        await wait(700);
        if (visitorTapped) return;
        replayClass(cursor, 'tap');
        answer.classList.add('shown');
        replayClass(answer, 'pulse');
        await wait(450);
      }
      await wait(300);
      panel.classList.add('played');
      cursor.style.opacity = '0';
    },
  };
}

// Step 2: the rows appear one at a time, the estimated difference counts up, then the citation.
function mathPanel(root) {
  const panel = root.getElementById('mathPanel');
  const rows = [...panel.querySelectorAll('.row')];
  const totalCell = panel.querySelector('.row.total span:last-child');
  const totalValue = parseDollars(totalCell.textContent);
  const cite = panel.querySelector('cite');
  return {
    el: panel,
    reset() { totalCell.textContent = formatDollars(0); },
    async play() {
      for (const row of rows) {
        row.classList.add('in');
        if (row === totalCell.parentElement) await countUp(totalCell, 0, totalValue, 800);
        await wait(380);
      }
      cite.classList.add('in');
    },
  };
}

// Step 3: the rows appear at "Next", then each status changes to its final value.
function checklistPanel(root) {
  const panel = root.getElementById('checklistPanel');
  const rows = [...panel.querySelectorAll('.row')];
  const setText = (status, text) => {
    [...status.childNodes].filter((n) => n.nodeType === Node.TEXT_NODE).forEach((n) => n.remove());
    status.append(text);
  };
  return {
    el: panel,
    reset() {
      rows.forEach((row) => {
        const status = row.querySelector('.status');
        status.classList.remove('done');
        setText(status, 'Next');
      });
    },
    async play() {
      for (const row of rows) {
        row.classList.add('in');
        await wait(300);
      }
      await wait(300);
      for (const row of rows) {
        const status = row.querySelector('.status');
        if (status.dataset.final === 'Next') continue;
        setText(status, status.dataset.final);
        if (status.querySelector('svg')) status.classList.add('done');
        replayClass(status, 'pop');
        await wait(550);
      }
    },
  };
}

export function startPanelMotion(root) {
  if (!root.documentElement.classList.contains('motion')) return;
  window.panelMotionStarted = true;
  const panels = [heroPanel(root), intakePanel(root), mathPanel(root), checklistPanel(root)];
  panels.forEach((panel) => panel.reset());
  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    const visible = isHalfVisible({
      intersectionRatio: entry.intersectionRatio,
      visibleHeight: entry.intersectionRect.height,
      viewportHeight: entry.rootBounds ? entry.rootBounds.height : window.innerHeight,
    });
    if (!visible) return;
    observer.unobserve(entry.target);
    panels.find((panel) => panel.el === entry.target).play();
  }), { threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] });
  panels.forEach((panel) => observer.observe(panel.el));
}
