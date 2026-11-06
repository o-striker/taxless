// Landing page savings counter (2026-11-06). The pure logic behind the split-flap board and the
// /api/savings-counter function. The browser only parses, formats, and animates one number and
// one date; Postgres decides whether the figure is current.
//
// TZ is set before the module loads so formatAsOfDate is proven not to shift the calendar day
// for a visitor west of UTC (new Date('2026-11-06') would render November 5 there).
process.env.TZ = 'America/Los_Angeles';

import test from 'node:test';
import assert from 'node:assert/strict';

const {
  parseCounterResponse, parseCounterRow, tileDigits, commaPositions, countUpValues, formatAsOfDate,
} = await import('../lib/savings-counter.js');
const { fetchCurrentCounter } = await import('../api/savings-counter.js');

test('parseCounterResponse: one current row becomes floored whole dollars', () => {
  assert.deepEqual(
    parseCounterResponse([{ as_of_date: '2026-11-06', total_estimated_savings: 1284560.75 }]),
    { asOfDate: '2026-11-06', totalDollars: 1284560 },
  );
});

test('parseCounterResponse: a numeric string total is accepted', () => {
  assert.equal(
    parseCounterResponse([{ as_of_date: '2026-11-06', total_estimated_savings: '1284560.00' }]).totalDollars,
    1284560,
  );
});

test('parseCounterResponse: bad shapes fall back (null)', () => {
  assert.equal(parseCounterResponse([]), null);
  assert.equal(parseCounterResponse(null), null);
  assert.equal(parseCounterResponse('<html>'), null);
  assert.equal(parseCounterResponse([{ as_of_date: '2026-11-06', total_estimated_savings: 0 }]), null);
  assert.equal(parseCounterResponse([{ as_of_date: '2026-11-06', total_estimated_savings: 0.4 }]), null);
  assert.equal(parseCounterResponse([{ as_of_date: 'nope', total_estimated_savings: 5 }]), null);
  assert.equal(parseCounterResponse([{ as_of_date: '2026-11-06', total_estimated_savings: 'abc' }]), null);
  assert.equal(parseCounterResponse([{ as_of_date: '2026-11-06', total_estimated_savings: Infinity }]), null);
});

test('parseCounterRow: the single object the landing endpoint returns', () => {
  assert.deepEqual(
    parseCounterRow({ as_of_date: '2026-11-06', total_estimated_savings: 42 }),
    { asOfDate: '2026-11-06', totalDollars: 42 },
  );
  assert.equal(parseCounterRow(undefined), null);
});

test('tileDigits: zero-padded to the digit count of the total', () => {
  assert.deepEqual(tileDigits(1284560, 0), ['0', '0', '0', '0', '0', '0', '0']);
  assert.deepEqual(tileDigits(1284560, 4321), ['0', '0', '0', '4', '3', '2', '1']);
});

test('tileDigits: the board grows a tile when the total needs another digit', () => {
  assert.equal(tileDigits(12345678, 12345678).length, 8);
  assert.equal(tileDigits(9999999, 0).length, 7);
});

test('commaPositions: a comma before every third tile from the right', () => {
  assert.deepEqual(commaPositions(7), [1, 4]);
  assert.deepEqual(commaPositions(3), []);
  assert.deepEqual(commaPositions(4), [1]);
  assert.deepEqual(commaPositions(9), [3, 6]);
});

test('countUpValues: starts at 0, ends exactly on the total, never decreases', () => {
  const values = countUpValues(1284560);
  assert.equal(values.length, 23); // ceil(1200 / 55) + 1
  assert.equal(values[0], 0);
  assert.equal(values.at(-1), 1284560);
  for (let i = 1; i < values.length; i++) assert.ok(values[i] >= values[i - 1], `step ${i} decreased`);
});

test('countUpValues: a tiny total still ends exactly on it', () => {
  const values = countUpValues(7);
  assert.equal(values.at(-1), 7);
  for (let i = 1; i < values.length; i++) assert.ok(values[i] >= values[i - 1]);
});

test('formatAsOfDate: the calendar day as written, for a visitor west of UTC', () => {
  assert.equal(formatAsOfDate('2026-11-06'), 'November 6, 2026');
  assert.equal(formatAsOfDate('2026-01-01'), 'January 1, 2026');
});

// --- /api/savings-counter -------------------------------------------------------------------

function respond(status, body) {
  return Promise.resolve(new Response(body === undefined ? null : JSON.stringify(body), { status }));
}

test('fetchCurrentCounter: posts to the public function with the publishable key', async () => {
  const calls = [];
  await fetchCurrentCounter((url, init) => {
    calls.push({ url, init });
    return respond(200, []);
  });
  assert.equal(calls[0].url, 'https://lbfyeqmxgnlomssaznbu.supabase.co/rest/v1/rpc/current_savings_counter');
  assert.equal(calls[0].init.method, 'POST');
  assert.equal(calls[0].init.headers.apikey, 'sb_publishable_QvZCCQbci4DeNJRzWzNA6g_oIwdrcED');
  assert.equal(calls[0].init.body, '{}');
});

test('fetchCurrentCounter: a current row is returned as the public body', async () => {
  const result = await fetchCurrentCounter(() =>
    respond(200, [{ as_of_date: '2026-11-06', total_estimated_savings: 1284560.75 }]));
  assert.deepEqual(result, {
    kind: 'current', body: { as_of_date: '2026-11-06', total_estimated_savings: 1284560 },
  });
});

test('fetchCurrentCounter: no current row is "none"', async () => {
  assert.deepEqual(await fetchCurrentCounter(() => respond(200, [])), { kind: 'none' });
});

test('fetchCurrentCounter: a Supabase error status or a thrown fetch is "error"', async () => {
  assert.deepEqual(await fetchCurrentCounter(() => respond(500, { message: 'down' })), { kind: 'error' });
  assert.deepEqual(await fetchCurrentCounter(() => Promise.reject(new Error('offline'))), { kind: 'error' });
});

test('fetchCurrentCounter: a request slower than the timeout is "error"', async () => {
  const neverAnswers = (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('aborted')));
  });
  assert.deepEqual(await fetchCurrentCounter(neverAnswers, 20), { kind: 'error' });
});

test('handler: 200 with a five-minute edge cache, 204 when none, 204 no-store on error', async () => {
  const { default: handler } = await import('../api/savings-counter.js');
  function fakeResponse() {
    const sent = { headers: {} };
    const response = {
      setHeader: (name, value) => { sent.headers[name] = value; return response; },
      status: (code) => { sent.status = code; return response; },
      json: (body) => { sent.body = body; return response; },
      end: () => response,
    };
    return { response, sent };
  }
  const realFetch = globalThis.fetch;
  try {
    globalThis.fetch = () => respond(200, [{ as_of_date: '2026-11-06', total_estimated_savings: 10 }]);
    let { response, sent } = fakeResponse();
    await handler({ method: 'GET' }, response);
    assert.equal(sent.status, 200);
    assert.deepEqual(sent.body, { as_of_date: '2026-11-06', total_estimated_savings: 10 });
    assert.equal(sent.headers['Cache-Control'], 'public, s-maxage=300, stale-while-revalidate=60');

    globalThis.fetch = () => respond(200, []);
    ({ response, sent } = fakeResponse());
    await handler({ method: 'GET' }, response);
    assert.equal(sent.status, 204);
    assert.equal(sent.headers['Cache-Control'], 'public, s-maxage=300, stale-while-revalidate=60');

    globalThis.fetch = () => respond(500, {});
    ({ response, sent } = fakeResponse());
    await handler({ method: 'GET' }, response);
    assert.equal(sent.status, 204);
    assert.equal(sent.headers['Cache-Control'], 'no-store');
  } finally {
    globalThis.fetch = realFetch;
  }
});
