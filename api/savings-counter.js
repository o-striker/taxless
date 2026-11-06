import { parseCounterResponse } from '../lib/savings-counter.js';

// GET /api/savings-counter: the public estimated savings figure for the landing page and the
// demo at retriever.tax/demo (same origin, so the demo bundle never names Supabase).
//   200 { as_of_date, total_estimated_savings } while the daily figure is current
//   204 when there is no current figure (the page keeps its static "$2,000+")
// Postgres decides "current" (current_savings_counter). Cached at the edge for five minutes so
// visitors do not each reach Supabase; errors are never cached.

const SUPABASE_URL = 'https://lbfyeqmxgnlomssaznbu.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QvZCCQbci4DeNJRzWzNA6g_oIwdrcED'; // browser-safe
const EDGE_CACHE = 'public, s-maxage=300, stale-while-revalidate=60';

export async function fetchCurrentCounter(fetchImplementation, timeoutMilliseconds = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMilliseconds);
  try {
    const response = await fetchImplementation(`${SUPABASE_URL}/rest/v1/rpc/current_savings_counter`, {
      method: 'POST',
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
      body: '{}',
      signal: controller.signal,
    });
    if (!response.ok) return { kind: 'error' };
    const counter = parseCounterResponse(await response.json());
    if (!counter) return { kind: 'none' };
    return {
      kind: 'current',
      body: { as_of_date: counter.asOfDate, total_estimated_savings: counter.totalDollars },
    };
  } catch (_error) {
    return { kind: 'error' };
  } finally {
    clearTimeout(timer);
  }
}

export default async function handler(request, response) {
  const result = await fetchCurrentCounter(globalThis.fetch);
  if (result.kind === 'current') {
    return response.setHeader('Cache-Control', EDGE_CACHE).status(200).json(result.body);
  }
  if (result.kind === 'none') {
    return response.setHeader('Cache-Control', EDGE_CACHE).status(204).end();
  }
  return response.setHeader('Cache-Control', 'no-store').status(204).end();
}
