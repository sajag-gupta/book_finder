import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadData } from '../src/site/data.js';
import { createContext } from '../src/site/context.js';
import { IMPACT_SNIPPET, IMPACT_TAG } from '../src/site/impact.js';
import { bookPage, homePage } from '../src/site/pages.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
const data = loadData(root);
const ctx = createContext({
  data,
  site: { name: 'Test', url: 'https://example.test', preview: false, includeDrafts: true },
});

const csp = headers.match(/Content-Security-Policy: (.*)/)[1];
const directive = (name) => csp.split(';').find((d) => d.trim().startsWith(`${name} `)) ?? '';

test('the Impact tag is on the home page only', () => {
  assert.ok(homePage(ctx).includes(IMPACT_TAG));
  assert.ok(!bookPage(ctx, ctx.bySlug.get('dune')).includes('impactcdn.com'));
});

test('the Impact tag is in the head, verbatim, as Impact instructs', () => {
  const html = homePage(ctx);
  const head = html.slice(0, html.indexOf('</head>'));
  assert.ok(head.includes('P-A7985227-bca6-48cf-a5ea-591508e934b01.js'));
  assert.ok(head.includes("impactStat('transformLinks');impactStat('trackImpression');"));
});

test('the CSP allows exactly this inline script by hash, so editing it fails until the hash is updated', () => {
  const hash = `sha256-${createHash('sha256').update(IMPACT_SNIPPET).digest('base64')}`;
  assert.ok(directive('script-src').includes(`'${hash}'`), 'script-src carries the snippet hash');
});

test('the CSP stays tight: no unsafe-inline, and only Impact hosts were added', () => {
  assert.ok(!csp.includes('unsafe-inline'));
  assert.ok(!csp.includes('unsafe-eval'));
  assert.ok(directive('script-src').includes('https://utt.impactcdn.com'));
  assert.ok(!directive('script-src').includes('*'), 'no wildcard script sources');
  assert.match(directive('default-src'), /'self'$/);
});
