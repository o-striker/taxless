// Umami analytics coverage for the public pages. Regression for 2026-11-08: privacy and terms
// pages had no tracker, and with no domain filter, design-tool previews, Vercel preview deploys,
// and localhost were counted as production traffic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const WEBSITE_ID = '734b31b9-670c-4a86-adf6-1338f62a15c1';
const PAGES = ['index.html', 'privacy.html', 'terms.html'];

function umamiTags(file) {
  const html = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  return html.match(/<script[^>]*cloud\.umami\.is\/script\.js[^>]*>/g) || [];
}

for (const page of PAGES) {
  test(`${page} loads the Umami tracker exactly once`, () => {
    assert.equal(umamiTags(page).length, 1);
  });

  test(`${page} tracks only the production domains`, () => {
    const [tag] = umamiTags(page);
    assert.ok(tag.includes(`data-website-id="${WEBSITE_ID}"`), 'website id');
    assert.ok(tag.includes('data-domains="retriever.tax,www.retriever.tax"'), 'domain filter');
    assert.ok(tag.includes('data-exclude-hash="true"'), 'hash excluded');
  });
}
