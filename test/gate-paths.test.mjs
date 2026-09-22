import test from 'node:test';
import assert from 'node:assert/strict';
import { isGatedPath, GATE_PAGE_PATH } from '../lib/gate-paths.js';

test('the new-parents page and everything under it is gated', () => {
  assert.equal(isGatedPath('/new-parents'), true);
  assert.equal(isGatedPath('/new-parents/'), true);
  assert.equal(isGatedPath('/new-parents/index.html'), true);
  assert.equal(isGatedPath('/new-parents/anything/else'), true);
});

test('the gate page itself is never gated (no redirect loop)', () => {
  assert.equal(isGatedPath(GATE_PAGE_PATH), false);
  assert.equal(isGatedPath('/new-parents/gate'), false);
  assert.equal(isGatedPath('/new-parents/gate.html'), false);
});

test('every other retriever.tax path is untouched', () => {
  for (const p of ['/', '/index.html', '/demo', '/demo/anything', '/privacy', '/terms',
                   '/robots.txt', '/sitemap.xml', '/llms.txt', '/retriever-logo.png',
                   '/api/new-parents-unlock', '/new-parents-other', '/newparents']) {
    assert.equal(isGatedPath(p), false, p);
  }
});
