import { catalogIndex } from '../src/site/catalog.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadData } from '../src/site/data.js';
import { createContext } from '../src/site/context.js';
import { matchTrending } from '../src/site/trending.js';
import { bookPage, browsePage, homePage, lookupPage, shelfPage } from '../src/site/pages.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const data = loadData(root);
const site = { name: 'Test', url: 'https://example.test', preview: false, includeDrafts: true };
const fullCtx = (trending) => createContext({ data: { ...data, trending }, site });

const pub = [
  { slug: 'dune', title: 'Dune', author: 'Frank Herbert' },
  { slug: 'dune-messiah', title: 'Dune Messiah', author: 'Frank Herbert' },
  {
    slug: 'mistborn-the-final-empire',
    title: 'Mistborn: The Final Empire',
    author: 'Brandon Sanderson',
  },
];

test('trending keeps Hardcover order and links only books we publish', () => {
  const entries = [
    { title: 'Mistborn: The Final Empire', author: 'Brandon Sanderson' },
    { title: 'Some Unlisted Book', author: 'Nobody' },
    { title: 'Dune', author: 'Frank Herbert' },
  ];
  assert.deepEqual(
    matchTrending(entries, pub).map((b) => b.slug),
    ['mistborn-the-final-empire', 'dune'],
  );
});

test('trending does not confuse a sequel or a different author with the book', () => {
  assert.deepEqual(matchTrending([{ title: 'Dune', author: 'Someone Else' }], pub), []);
  assert.deepEqual(
    matchTrending([{ title: 'Dune Messiah', author: 'Frank Herbert' }], pub).map((b) => b.slug),
    ['dune-messiah'],
  );
  assert.deepEqual(matchTrending(undefined, pub), []);
});

test('trending ignores repeats and subtitles', () => {
  const entries = [
    { title: 'Dune: Deluxe Edition', author: 'Frank Herbert' },
    { title: 'Dune', author: 'Frank Herbert' },
  ];
  assert.equal(matchTrending(entries, pub).length, 1);
});

test('the home page shows trending only when enough trending books are on the site', () => {
  const some = data.books.slice(0, 6).map((b) => ({ title: b.title, author: b.author }));
  const url = 'https://hardcover.app/trending/month';
  const withSome = homePage(fullCtx({ source: 'Hardcover', url, entries: some }));
  assert.ok(withSome.includes('Trending now'));
  assert.ok(withSome.includes('according to Hardcover readers'));
  assert.ok(!withSome.includes('hardcover.app'), 'trending credits Hardcover without linking');
  assert.ok(!homePage(fullCtx(null)).includes('Trending now'));
});

test('book pages offer a shelf panel and hideable content warnings', () => {
  const ctx = fullCtx(null);
  const html = bookPage(ctx, ctx.bySlug.get('dune'));
  assert.ok(html.includes('data-shelf-panel data-slug="dune"'));
  assert.ok(html.includes('role="slider"'));
  assert.ok(html.includes('data-cw-toggle'));
  assert.ok(html.includes('<script type="module" src="/assets/book.js">'));
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  assert.ok(!emoji.test(html), 'no emoji on the page');
});

test('the shelf page supports import and backup and carries genre names safely', () => {
  const html = shelfPage(fullCtx(null));
  assert.ok(
    html.includes('data-import') && html.includes('data-export') && html.includes('data-restore'),
  );
  const json = html.match(/<script type="application\/json" id="genre-names">(.*?)<\/script>/)[1];
  assert.equal(JSON.parse(json).fantasy, 'Fantasy');
  assert.ok(html.includes('noindex'));
});

test('the lookup page is a noindex shell with the store list and format titles embedded', () => {
  const html = lookupPage(fullCtx(null));
  assert.ok(html.includes('data-lookup') && html.includes('noindex'));
  assert.ok(html.includes('<script type="module" src="/assets/lookup.js">'));
  const stores = JSON.parse(html.match(/id="stores">(.*?)<\/script>/)[1]);
  assert.ok(stores.some((s) => s.id === 'libby' && s.kind === 'library'));
  assert.ok(
    stores.every((s) => !('plain' in s) && !('affiliate' in s)),
    'no URL templates or IDs leak to the page',
  );
  const titles = JSON.parse(html.match(/id="format-titles">(.*?)<\/script>/)[1]);
  assert.equal(titles.library, 'Borrow free');
});

test('the browse page can show books beyond the catalogue, and the index lists every ISBN', () => {
  const ctx = fullCtx(null);
  const html = browsePage(ctx);
  assert.ok(html.includes('data-remote') && html.includes('data-remote-list'));
  const index = catalogIndex(ctx);
  assert.equal(index.books.length, ctx.published.length);
  assert.ok(index.books.every((b) => /^97[89]\d{10}$/.test(b.i)));
});
