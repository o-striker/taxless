import test from 'node:test';
import assert from 'node:assert/strict';
import { mintToken, verifyToken } from '../lib/token.js';

test('minted token is 64-char hex and verifies with the same secret', async () => {
  const t = await mintToken('s3cret');
  assert.match(t, /^[0-9a-f]{64}$/);
  assert.equal(await verifyToken('s3cret', t), true);
});

test('token minted with a different secret fails verification', async () => {
  const t = await mintToken('other-secret');
  assert.equal(await verifyToken('s3cret', t), false);
});

test('garbage tokens fail closed', async () => {
  assert.equal(await verifyToken('s3cret', ''), false);
  assert.equal(await verifyToken('s3cret', null), false);
  assert.equal(await verifyToken('s3cret', undefined), false);
  assert.equal(await verifyToken('s3cret', 'a'.repeat(64)), false);
  assert.equal(await verifyToken('s3cret', 'a'.repeat(63)), false);
});
