// Savings counter board: fetches the public figure and, only when it is current, swaps the hero
// strip's static "$2,000+" for a split-flap board that counts up once and stops. Any failure
// leaves the static markup untouched. Approved behavior (Andrew, 2026-11-06): counts up in order,
// never random digits; about 1.2 seconds; leading tiles start at 0 on dark tiles; the board has
// as many tiles as the total has digits.
import {
  parseCounterRow, tileDigits, commaPositions, countUpValues, formatAsOfDate, formatDollars,
} from './savings-counter.js';

const STEP_MILLISECONDS = 55;
const FLIP_MILLISECONDS = 45;
const FETCH_TIMEOUT_MILLISECONDS = 3000;

async function loadCounter() {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MILLISECONDS);
  try {
    const response = await fetch('/api/savings-counter', { signal: controller.signal });
    if (response.status !== 200) return null;
    return parseCounterRow(await response.json());
  } catch (_error) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setTile(tile, digit, previous, animate) {
  const halves = (top, bottom) =>
    `<span class="flap-half flap-top"><b>${top}</b></span><span class="flap-half flap-bottom"><b>${bottom}</b></span>`;
  if (!animate || previous === undefined || previous === digit) {
    tile.innerHTML = halves(digit, digit);
    return;
  }
  tile.innerHTML = halves(digit, previous) +
    `<span class="flap-half flap-top flap-fold"><b>${previous}</b></span>`;
  setTimeout(() => { tile.innerHTML = halves(digit, digit); }, FLIP_MILLISECONDS);
}

function buildBoard(counter) {
  const digitCount = String(counter.totalDollars).length;
  const commas = new Set(commaPositions(digitCount));
  const board = element('div', 'flap-board');
  board.setAttribute('role', 'img');
  board.setAttribute('aria-label', formatDollars(counter.totalDollars));
  board.appendChild(element('span', 'flap-symbol', '$')).setAttribute('aria-hidden', 'true');
  const tiles = [];
  for (let index = 0; index < digitCount; index++) {
    if (commas.has(index)) board.appendChild(element('span', 'flap-symbol', ',')).setAttribute('aria-hidden', 'true');
    const tile = element('span', 'flap-tile');
    tile.setAttribute('aria-hidden', 'true');
    tiles.push(tile);
    board.appendChild(tile);
  }
  return { board, tiles };
}

function play(counter, tiles) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let shown = [];
  const show = (value, animate) => {
    const digits = tileDigits(counter.totalDollars, value);
    digits.forEach((digit, index) => setTile(tiles[index], digit, shown[index], animate));
    shown = digits;
  };
  if (reduceMotion) {
    show(counter.totalDollars, false);
    return;
  }
  const values = countUpValues(counter.totalDollars);
  show(values[0], false);
  values.slice(1).forEach((value, index) => {
    setTimeout(() => show(value, true), (index + 1) * STEP_MILLISECONDS);
  });
}

export async function startSavingsCounter(container) {
  if (!container) return;
  const counter = await loadCounter();
  if (!counter) return;

  const { board, tiles } = buildBoard(counter);
  const block = element('div', 'counter-block');
  block.appendChild(element('div', 'trust-label', 'Estimated savings modeled so far'));
  block.appendChild(board);
  block.appendChild(element('div', 'counter-as-of', `As of ${formatAsOfDate(counter.asOfDate)}`));
  block.appendChild(element('div', 'trust-disclaimer',
    "Sum of each user's latest estimate, based on the information they entered. " +
    'Estimates, not savings realized. Not a guarantee.'));
  container.replaceChildren(block);

  // Play once, when the strip is on screen.
  if (!('IntersectionObserver' in window)) {
    play(counter, tiles);
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((entry) => entry.isIntersecting)) {
      observer.disconnect();
      play(counter, tiles);
    }
  }, { threshold: 0.4 });
  observer.observe(board);
  // Tiles show 0 until the count starts.
  tiles.forEach((tile) => setTile(tile, '0', undefined, false));
}
