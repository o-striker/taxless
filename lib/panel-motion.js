// Product panel motion on the landing page: the pure logic, kept apart from the DOM so it can be
// tested in Node. The panels show fixed sample figures; nothing here computes a tax amount, it only
// animates a number from one known value to another.

export function formatDollars(amount) {
  return '$' + Math.round(amount).toLocaleString('en-US');
}

export function parseDollars(text) {
  return Number(String(text).replace(/[^0-9]/g, ''));
}

// Cubic ease out, so a count-up runs fast at first and settles on the final figure.
export function easedDollars(from, to, progress) {
  const clamped = Math.min(1, Math.max(0, progress));
  const eased = 1 - Math.pow(1 - clamped, 3);
  return Math.round(from + (to - from) * eased);
}

// Hero loading layer, copied from the beta compute screen. Phase 0 to 2 is the step in progress;
// phase 3 means every step is done; phase -1 is the reset state before the panel plays.
export function computeStepStates(phase, stepCount) {
  return Array.from({ length: stepCount }, (_, i) => (i < phase ? 'done' : i === phase ? 'active' : 'waiting'));
}

const BAR_PERCENT_BY_PHASE = [22, 58, 92, 100];

export function computeBarPercent(phase) {
  return phase < 0 ? 0 : BAR_PERCENT_BY_PHASE[Math.min(phase, BAR_PERCENT_BY_PHASE.length - 1)];
}

// A panel plays once half of it is on screen. A panel taller than twice the screen (heavy zoom, short
// windows) can never be half visible, so half the screen covered by it counts too.
export function isHalfVisible({ intersectionRatio, visibleHeight, viewportHeight }) {
  return intersectionRatio >= 0.5 || (visibleHeight > 0 && visibleHeight >= viewportHeight * 0.5);
}
