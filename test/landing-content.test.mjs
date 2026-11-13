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

test('form confirmation and consent line', () => {
  assert.ok(body.includes('<div class="success-title">Received</div>'));
  assert.ok(body.includes('<div class="success-body">We\'ll be in touch.</div>'));
  assert.ok(body.includes('By submitting, you agree to our'));
  assert.ok(!body.includes('By joining') && !body.includes("You're in."));
});

test('intake panel answers are real buttons grouped by question', () => {
  const panel = body.slice(body.indexOf('id="intakePanel"'), body.indexOf('class="step flip"'));
  assert.ok(body.includes('id="intakePanel"'));
  assert.ok(!panel.includes('role="img"'));
  assert.equal((panel.match(/role="group"/g) || []).length, 2);
  assert.equal((panel.match(/<button type="button" class="opt/g) || []).length, 7);
  assert.equal((panel.match(/aria-pressed="true"/g) || []).length, 2);
});

test('intake banner: hidden without JavaScript, sends people to the email form, tracks only an event name', () => {
  assert.match(body, /<div class="intake-banner"[^>]*hidden/);
  assert.ok(body.includes('Ready to try it with your numbers?'));
  assert.ok(html.includes('landing_intake_banner_cta'));
  // Regression (2026-11-09): the general click tracker sent each answer's text ("IRA", "Neither")
  // as the click target. Every answer button now carries its own data-umami-event, which that
  // tracker skips and which Umami records as the bare event name, with no properties.
  const panel = body.slice(body.indexOf('id="intakePanel"'), body.indexOf('class="step flip"'));
  const answers = panel.match(/<button type="button" class="opt[^>]*>/g) || [];
  assert.equal(answers.length, 7);
  for (const tag of answers) {
    assert.ok(tag.includes('data-umami-event="intake_panel_click"'), tag);
    assert.ok(!tag.includes('data-umami-event-'), tag);
  }
  assert.ok(html.includes("if (e.target.closest('[data-umami-event]')) return;"));
  assert.ok(!html.includes("umami.track('intake_panel_click'"));
});

// Product panel motion (2026-11-13): each drawn panel plays once on scroll, then rests on the
// figures above. The hero opens on the beta compute screen. Motion itself is checked live.
test('hero loading layer carries the beta compute screen copy, hidden from screen readers', () => {
  const layer = body.slice(body.indexOf('class="app-loading"'), body.indexOf('class="strat"'));
  assert.ok(layer.length > 0 && body.includes('class="app-loading"'));
  assert.ok(layer.includes('aria-hidden="true"'));
  for (const s of ['Crunching your numbers', 'Modeling thousands of options.', 'Reading your financial context',
    'Applying federal and state tax rules', 'Running through thousands of scenarios',
    'Calculations use tax brackets and tax code.']) assert.ok(layer.includes(s), s);
  // Andrew shortened the third step on 2026-11-13; the beta still says "...with your financial context".
  assert.ok(!layer.includes('scenarios with your financial context'));
});

test('panel motion falls back to the static page', () => {
  const head = html.slice(0, html.indexOf('<body'));
  assert.ok(head.includes("matchMedia('(prefers-reduced-motion: reduce)')"));
  assert.ok(head.includes("'IntersectionObserver' in window"));
  assert.match(html, /import\('\/lib\/panel-motion-board\.js'\)[\s\S]*?\.catch\(\(\) => document\.documentElement\.classList\.remove\('motion'\)\)/);
  assert.ok(!html.includes('mockupReplay'));
});

test('static checklist keeps its final statuses', () => {
  for (const s of ['data-final="Done">', 'data-final="Reminder set">', 'data-final="Next">']) assert.ok(body.includes(s), s);
});

test('the animated pointer never clicks, so the intake banner and analytics see only real taps', () => {
  const driver = readFileSync(new URL('../lib/panel-motion-board.js', import.meta.url), 'utf8');
  assert.ok(driver.includes('fake-cursor'));
  assert.ok(!driver.includes('.click(') && !driver.includes('dispatchEvent'));
});

test('panel motion has a timer fallback when module scripts never run', () => {
  // Regression (2026-11-13, found in review of this branch): the .catch above can't fire if the
  // module script itself fails or the browser can't run modules, which would leave the hero on its
  // loading layer. The head script drops html.motion unless the driver reports it started.
  const head = html.slice(0, html.indexOf('<body'));
  assert.match(head, /setTimeout\([\s\S]*?window\.panelMotionStarted[\s\S]*?classList\.remove\('motion'\)/);
  const driver = readFileSync(new URL('../lib/panel-motion-board.js', import.meta.url), 'utf8');
  assert.ok(driver.includes('window.panelMotionStarted = true'));
  // The driver loads from its own module script, so a counter failure can't stop it.
  assert.match(html, /<script type="module">\s*\/\/ Product panel motion[\s\S]*?import\('\/lib\/panel-motion-board\.js'\)/);
});
