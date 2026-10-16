import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadData, validateData } from '../src/site/data.js';
import { validateIssue } from '../src/email/issue.js';
import { renderIssue } from '../src/email/template.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const data = loadData(root);
const bySlug = new Map(data.books.map((b) => [b.slug, b]));
const reviewed = new Set(data.books.filter((b) => b.status === 'reviewed').map((b) => b.slug));
const site = { name: 'Test Site', url: 'https://example.test' };
const config = { postalAddress: '1 Example Street, Town', unsubscribeTag: '{{ unsubscribe_url }}' };
const ctx = { bySlug, moods: data.moods, site, config };

const issue = {
  date: '2026-10-23',
  subject: 'Three cozy reads',
  intro: 'A gentle week.',
  picks: [{ slug: 'legends-and-lattes' }, { slug: 'the-hobbit' }, { slug: 'dune' }],
  deal: null,
};

test('the committed issues are valid', () => {
  assert.deepEqual(validateData(data), []);
});

test('an issue needs exactly three distinct reviewed picks', () => {
  assert.deepEqual(validateIssue(issue, reviewed), []);
  assert.ok(
    validateIssue({ ...issue, picks: issue.picks.slice(0, 2) }, reviewed).some((e) =>
      e.includes('exactly 3'),
    ),
  );
  assert.ok(
    validateIssue(
      { ...issue, picks: [issue.picks[0], issue.picks[0], issue.picks[1]] },
      reviewed,
    ).some((e) => e.includes('twice')),
  );
  assert.ok(
    validateIssue(
      { ...issue, picks: [{ slug: 'ghost' }, issue.picks[1], issue.picks[2]] },
      reviewed,
    ).some((e) => e.includes('not a reviewed book')),
  );
});

test('a draft book cannot be a pick', () => {
  const onlyDune = new Set(['dune']);
  assert.ok(validateIssue(issue, onlyDune).some((e) => e.includes('legends-and-lattes')));
});

test('subject, intro and date are required and bounded', () => {
  const errors = validateIssue(
    { ...issue, subject: 'x'.repeat(61), intro: '', date: 'soon' },
    reviewed,
  );
  assert.ok(errors.some((e) => e.includes('60 characters')));
  assert.ok(errors.some((e) => e.includes('intro')));
  assert.ok(errors.some((e) => e.includes('date')));
});

test('a deal must name a known store and the date the price was checked', () => {
  const good = {
    slug: 'dune',
    store: 'kobo',
    headline: 'Dune ebook on sale',
    checkedOn: '2026-10-22',
  };
  assert.deepEqual(validateIssue({ ...issue, deal: good }, reviewed), []);
  const errors = validateIssue(
    { ...issue, deal: { ...good, store: 'nope', checkedOn: undefined } },
    reviewed,
  );
  assert.ok(errors.some((e) => e.includes('unknown')));
  assert.ok(errors.some((e) => e.includes('checkedOn')));
});

test('renders three picks with tracked absolute links, in HTML and text', () => {
  const { html, text, subject } = renderIssue(issue, ctx);
  assert.equal(subject, 'Three cozy reads');
  for (const slug of ['legends-and-lattes', 'the-hobbit', 'dune']) {
    const url = `https://example.test/books/${slug}/?utm_source=newsletter&utm_medium=email&utm_campaign=2026-10-23`;
    assert.ok(html.includes(url.replace(/&/g, '&amp;')), `${slug} link in html`);
    assert.ok(text.includes(url), `${slug} link in text`);
  }
  assert.ok(!html.includes("This week's deal"));
  assert.ok(html.includes('affiliate'));
  assert.ok(html.includes('1 Example Street, Town'));
});

test('renders a deal through the /go redirect with its check date', () => {
  const deal = {
    slug: 'dune',
    store: 'kobo',
    headline: 'Dune ebook',
    detail: 'Down this week.',
    checkedOn: '2026-10-22',
  };
  const { html, text } = renderIssue({ ...issue, deal }, ctx);
  assert.ok(html.includes("This week's deal"));
  assert.ok(html.includes('https://example.test/go/kobo/9780441013593'));
  assert.ok(html.includes('Price seen 2026-10-22'));
  assert.ok(text.includes('Prices change, so check the store.'));
});

test('escapes editor text so a stray character cannot break the email', () => {
  const { html } = renderIssue({ ...issue, intro: '<script>alert(1)</script> & more' }, ctx);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('warns when the address or unsubscribe settings are missing', () => {
  const { warnings } = renderIssue(issue, { ...ctx, config: {} });
  assert.equal(warnings.length, 2);
  assert.equal(renderIssue(issue, ctx).warnings.length, 0);
});
