// Which paths the new-parents password gate applies to. Kept separate from the
// middleware so it can be unit tested without the @vercel/edge runtime.
// Only /new-parents and paths under it are ever gated; the gate page itself is
// excluded so the middleware rewrite cannot loop.
export const GATED_PREFIX = '/new-parents';
export const GATE_PAGE_PATH = '/new-parents/gate';

export function isGatedPath(pathname) {
  if (typeof pathname !== 'string') return false;
  if (pathname !== GATED_PREFIX && !pathname.startsWith(GATED_PREFIX + '/')) return false;
  if (pathname === GATE_PAGE_PATH || pathname === GATE_PAGE_PATH + '.html') return false;
  return true;
}
