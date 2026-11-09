// Landing page content and structure, pinned to the decisions Andrew made on the refresh
// mockup (2026-11-06 to 2026-11-09). Reads index.html as text; look and motion are checked live.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const body = html.slice(html.indexOf('<body'));

function faqLdQuestions() {
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  return ld['@graph'].find((node) => node['@type'] === 'FAQPage').mainEntity;
}

test('no pre-launch language', () => {
  for (const phrase of ['Coming Summer 2026', 'launching', 'spot in the beta opens', 'fifteen minutes', 'Join the beta', 'Get updates'])
    assert.ok(!html.includes(phrase), phrase);
});

test('five-minute claim is consistent', () => {
  assert.ok(body.includes('Three steps. About five minutes.'));
  assert.ok(body.includes('5 min to plan'));
});

test('headline and subline', () => {
  assert.ok(body.includes('Your grad school years are an opportunity.<br>Use them.'));
  assert.ok(body.includes('Retriever models thousands of scenarios to show the tax strategies that may apply to you.'));
  assert.ok(!html.includes('fit your situation'));
});

test('chips: no IRS-cited claim, financial education instead', () => {
  assert.ok(!html.includes('IRS-cited'));
  assert.ok(body.includes('Financial education'));
});

test('every call to action says Get early access', () => {
  assert.ok(!html.includes('Get beta access'));
  assert.ok((body.match(/Get early access/g) || []).length >= 3);
});

test('form error paths restore the submit label it started with', () => {
  const labels = [...html.matchAll(/submitBtn\.textContent = '([^']+)'/g)].map((m) => m[1]).filter((l) => l !== 'Sending...');
  assert.ok(labels.length >= 2);
  assert.deepEqual([...new Set(labels)], ['Get early access']);
});

test('one email form, in the hero, after the counter band', () => {
  assert.equal((html.match(/id="emailInput"/g) || []).length, 1);
  assert.ok(body.indexOf('class="counter-band"') < body.indexOf('id="heroForm"'));
  assert.ok(!html.includes('signup-band'));
  assert.ok(!html.includes('id="betaCheck"'));
});

test('payload keeps the Formspree inbox keys and tags the source', () => {
  assert.ok(html.includes('https://formspree.io/f/mykoyeey'));
  for (const key of ["beta_participation: 'yes'", "source: 'hero'", "name: ''", "phone: ''", "interest: ''"]) assert.ok(html.includes(key), key);
});

test('live savings counter still mounts into the band, with the static fallback styled for dark green', () => {
  assert.ok(html.includes("startSavingsCounter(document.querySelector('.counter-band .trust-main'))"));
  const band = body.slice(body.indexOf('class="counter-band"'), body.indexOf('id="heroForm"'));
  assert.ok(band.includes('class="trust-main"'));
  assert.ok(band.includes('$2,000'));
  for (const selector of ['.counter-band .trust-label', '.counter-band .trust-amount', '.counter-band .trust-disclaimer', '.counter-band .flap-tile', '.counter-band .counter-as-of'])
    assert.ok(html.includes(selector + ' {') || html.includes(selector + ',') || html.includes(selector + ' .'), selector);
});

test('sections in order', () => {
  const order = ['class="counter-band"', 'id="heroForm"', 'id="how-it-works"', 'id="strategies"', 'id="faq"', '<footer'].map((s) => body.indexOf(s));
  assert.ok(order.every((i) => i > 0) && order.every((v, i) => i === 0 || v > order[i - 1]), order.join(','));
});

test('panel math is internally consistent', () => {
  // 32,000 x 12% = 3,840; 32,000 x 24% = 7,680; difference 3,840; hero total = 3,840 + 1,870 + 1,050
  for (const value of ['$32,000', '$3,840', '$7,680', '$1,870', '$1,050', '$6,760']) assert.ok(body.includes(value), value);
  assert.ok(!body.includes('$7,760') && !body.includes('$3,920'));
});

test('every product panel carries an illustrative caption', () => {
  assert.ok((body.match(/class="(shot|mini)[ "]/g) || []).length >= 4);
  // One caption under the hero panel, one under the three how-it-works panels.
  assert.ok(body.includes('class="shot-caption">Illustrative example with sample data.'));
  assert.ok(body.includes('class="steps-caption">Illustrative examples with sample data.'));
});

test('step 3 checklist rows are status, not commands', () => {
  for (const command of ['Open a Roth IRA', 'Convert $32,000 before', 'Sell lots under']) assert.ok(!body.includes(command), command);
});

test('strategy section: no dollar figures, no citations, may and can wording', () => {
  const block = body.slice(body.indexOf('id="strategies"'), body.indexOf('id="faq"'));
  assert.ok(!/\$\d/.test(block));
  assert.ok(!block.includes('IRC'));
  assert.ok(block.includes('What Retriever looks for'));
  assert.ok(block.includes('0% federal capital gains'));
  assert.ok(block.includes('0% federal bracket'));
});

test('no testimonials and no data-handling claims', () => {
  for (const s of ['id="reviews"', "I don't get any of these strategies", 'never sold', 'Never sold']) assert.ok(!html.includes(s), s);
});

test('frequently asked questions: counter question last, CPA line, no nonresident sentence, visible list matches JSON-LD', () => {
  const visible = [...body.matchAll(/<summary>([^<]+)<\/summary>/g)].map((m) => m[1].replace(/&#39;|&apos;/g, "'"));
  const ld = faqLdQuestions();
  assert.deepEqual(visible, ld.map((q) => q.name));
  assert.equal(visible[visible.length - 1], 'What is the estimated savings counter?');
  const whoBuilt = ld.find((q) => q.name.startsWith('Who built this')).acceptedAnswer.text;
  assert.ok(whoBuilt.startsWith('No. '));
  assert.ok(whoBuilt.endsWith('No one on the team is a CPA or tax preparer.'));
  assert.ok(body.includes('No one on the team is a CPA or tax preparer.'));
  assert.ok(!html.includes('nonresident alien'));
});

test('sticky call to action is hidden without JavaScript and returns to the hero form', () => {
  assert.match(body, /<div class="sticky-top"[^>]*hidden/);
  assert.match(body, /<div class="sticky-bar"[^>]*hidden/);
  assert.ok(body.includes('Retriever is live for Grad Students'));
  assert.ok(html.includes('landing_sticky_cta'));
  assert.ok(html.includes("getElementById('heroForm')"));
});
