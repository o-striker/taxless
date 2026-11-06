// Savings counter board: fetches the public figure and, only when it is current, swaps the hero
// strip's static "$2,000+" for a split-flap board that counts up once and stops. Any failure
// leaves the static markup untouched. Approved behavior (Andrew, 2026-11-06): counts up in order,
// never random digits; about 1.2 seconds, updated on every screen refresh; leading tiles start at
// 0 on dark tiles; the board has as many tiles as the total has digits.
import {
  parseCounterRow, tileDigits, commaPositions, countUpValueAt, flipDecision, formatAsOfDate, formatDollars,
} from './savings-counter.js';

const DURATION_MILLISECONDS = 1200;
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

function halves(top, bottom) {
  return `<span class="flap-half flap-top"><b>${top}</b></span><span class="flap-half flap-bottom"><b>${bottom}</b></span>`;
}

// Each tile remembers its digit and when its current flip ends. A flip shows the old digit's top
// half folding down over the new digit; a change mid-flip updates the digit in place.
function renderTile(tile, state, digit, now) {
  if (!Number.isFinite(now)) { // settle: no flip, just the digit
    tile.innerHTML = halves(digit, digit);
    state.digit = digit;
    state.flipping = false;
    return;
  }
  const decision = flipDecision(state.digit, digit, now, state.flipEndsAt);
  if (decision.startFlip) {
    tile.innerHTML = halves(digit, state.digit) +
      `<span class="flap-half flap-top flap-fold"><b>${state.digit}</b></span>`;
    state.flipping = true;
  } else if (state.flipping && now >= state.flipEndsAt) {
    tile.innerHTML = halves(digit, digit);
    state.flipping = false;
  } else if (state.digit !== digit) {
    // Mid-flip change: the new digit replaces what the fold reveals.
    tile.querySelector('.flap-top b').textContent = digit;
    if (!state.flipping) tile.innerHTML = halves(digit, digit);
  }
  state.digit = digit;
  state.flipEndsAt = decision.flipEndsAt;
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
  const states = tiles.map(() => ({ digit: '0', flipEndsAt: 0, flipping: false }));
  const show = (value, now) => {
    tileDigits(counter.totalDollars, value).forEach((digit, index) => renderTile(tiles[index], states[index], digit, now));
  };
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    show(counter.totalDollars, Infinity);
    return;
  }
  let start = null;
  const frame = (now) => {
    if (start === null) start = now;
    const elapsed = now - start;
    show(countUpValueAt(counter.totalDollars, elapsed, DURATION_MILLISECONDS), now);
    if (elapsed < DURATION_MILLISECONDS) {
      requestAnimationFrame(frame);
    } else {
      // Settle every tile on its final digit once the last flips finish.
      setTimeout(() => show(counter.totalDollars, Infinity), 60);
    }
  };
  requestAnimationFrame(frame);
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
  tiles.forEach((tile) => { tile.innerHTML = halves('0', '0'); });
}
