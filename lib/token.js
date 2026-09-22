// Gate-cookie token for retriever.tax/new-parents. Shared by the edge
// middleware (verify) and the unlock function (mint). Web Crypto only so it
// runs on both runtimes unchanged. Rotating GATE_SECRET invalidates every
// outstanding cookie.
const PAYLOAD = 'new-parents-gate-v1';

async function hmacHex(secret) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(PAYLOAD));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function mintToken(secret) {
  return hmacHex(secret);
}

export async function verifyToken(secret, token) {
  if (typeof secret !== 'string' || secret.length === 0) return false;
  if (typeof token !== 'string' || token.length !== 64) return false;
  const expected = await hmacHex(secret);
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  return diff === 0;
}
