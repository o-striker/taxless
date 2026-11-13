// Landing page panel motion (2026-11-13). The pure logic behind the product panel animations:
// dollar formatting for the count-ups, and the step and bar states of the hero's loading layer,
// copied from the beta compute screen ("Crunching your numbers").
import test from 'node:test';
import assert from 'node:assert/strict';

const { formatDollars, parseDollars, easedDollars, computeStepStates, computeBarPercent } = await import('../lib/panel-motion.js');

test('formatDollars and parseDollars round trip', () => {
  assert.equal(formatDollars(6760), '$6,760');
  assert.equal(formatDollars(0), '$0');
  assert.equal(parseDollars('$32,000'), 32000);
  assert.equal(parseDollars(formatDollars(3840)), 3840);
});

test('easedDollars starts, ends, and clamps', () => {
  assert.equal(easedDollars(0, 3840, 0), 0);
  assert.equal(easedDollars(0, 3840, 1), 3840);
  assert.equal(easedDollars(0, 3840, 1.5), 3840);
  assert.equal(easedDollars(3840, 5710, -1), 3840);
  assert.ok(easedDollars(0, 1000, 0.5) > 500); // ease out runs ahead of linear
  assert.ok(Number.isInteger(easedDollars(0, 1000, 0.37)));
});

test('computeStepStates walks the three beta steps', () => {
  assert.deepEqual(computeStepStates(-1, 3), ['waiting', 'waiting', 'waiting']);
  assert.deepEqual(computeStepStates(0, 3), ['active', 'waiting', 'waiting']);
  assert.deepEqual(computeStepStates(2, 3), ['done', 'done', 'active']);
  assert.deepEqual(computeStepStates(3, 3), ['done', 'done', 'done']);
});

test('computeBarPercent matches the beta cadence', () => {
  assert.deepEqual([-1, 0, 1, 2, 3].map(computeBarPercent), [0, 22, 58, 92, 100]);
});
