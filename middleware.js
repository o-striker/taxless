import { next, rewrite } from '@vercel/edge';
import { verifyToken } from './lib/token.js';
import { isGatedPath, GATE_PAGE_PATH } from './lib/gate-paths.js';

// The matcher limits this middleware to retriever.tax/new-parents and paths
// under it. No other retriever.tax URL ever invokes it.
export const config = {
  matcher: ['/new-parents', '/new-parents/:path*'],
};

function getCookie(req, name) {
  const header = req.headers.get('cookie') || '';
  for (const part of header.split(/;\s*/)) {
    const eq = part.indexOf('=');
    if (eq > 0 && part.slice(0, eq) === name) return part.slice(eq + 1);
  }
  return null;
}

export default async function middleware(req) {
  const url = new URL(req.url);
  if (!isGatedPath(url.pathname)) return next();
  const secret = process.env.GATE_SECRET;
  const token = getCookie(req, 'new_parents_gate');
  // verifyToken fails closed on a missing secret or bad token.
  if (await verifyToken(secret, token)) return next();
  return rewrite(new URL(GATE_PAGE_PATH, req.url));
}
