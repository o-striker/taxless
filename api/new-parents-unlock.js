import { createHash, timingSafeEqual } from 'node:crypto';
import { mintToken } from '../lib/token.js';

// Hash both sides so timingSafeEqual always gets equal-length buffers.
function passwordMatches(candidate, actual) {
  const a = createHash('sha256').update(String(candidate)).digest();
  const b = createHash('sha256').update(String(actual)).digest();
  return timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false });
  const password = process.env.GATE_PASSWORD;
  const secret = process.env.GATE_SECRET;
  if (!password || !secret) return res.status(500).json({ ok: false });
  const body = req.body || {};
  if (body.ack !== true) return res.status(400).json({ ok: false, error: 'ack-required' });
  if (typeof body.password !== 'string' || body.password.length === 0 ||
      body.password.length > 200 || !passwordMatches(body.password, password)) {
    return res.status(401).json({ ok: false });
  }
  const token = await mintToken(secret);
  // Session cookie (no Max-Age): the gate comes back when the browser closes.
  // Path-scoped so it is only ever sent for /new-parents requests.
  res.setHeader('Set-Cookie',
    `new_parents_gate=${token}; Path=/new-parents; HttpOnly; Secure; SameSite=Lax`);
  return res.status(200).json({ ok: true });
}
