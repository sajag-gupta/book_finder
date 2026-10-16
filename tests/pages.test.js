import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadData } from '../src/site/data.js';
import { bookPage, booksLikePage, createContext, homePage } from '../src/site/pages.js';
import { esc } from '../src/site/html.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const site = {
  name: 'Test Site',
  url: 'https://example.test',
  preview: false,
  includeDrafts: true,
};
const ctx = createContext({ data: loadData(root), site });
const dune = ctx.bySlug.get('dune');

test('esc neutralises HTML', () => {
  assert.equal(esc('<script>"a" & \'b\''), '&lt;script&gt;&quot;a&quot; &amp; &#39;b&#39;');
});

test('book page routes every store button through /go and shows the library row first', () => {
  const html = bookPage(ctx, dune);
  assert.ok(html.includes('/go/libby/9780441013593'));
  assert.ok(html.includes('/go/bookshop/9780441013593'));
  assert.ok(!html.includes('https://bookshop.org'), 'no direct retailer links on the page');
  assert.ok(html.indexOf('Borrow free') < html.indexOf('Print, new'));
});

test('paid links are marked sponsored, library links are not', () => {
  const html = bookPage(ctx, dune);
  assert.match(html, /href="\/go\/bookshop\/[^"]+" rel="sponsored nofollow noopener"/);
  assert.match(html, /href="\/go\/libby\/[^"]+" rel="nofollow noopener"/);
});

test('book page carries structured data and a canonical URL', () => {
  const html = bookPage(ctx, dune);
  assert.ok(html.includes('"@type":"Book"'));
  assert.ok(html.includes('<link rel="canonical" href="https://example.test/books/dune/">'));
});

test('preview builds are noindex, production builds are not', () => {
  assert.ok(
    homePage(createContext({ data: ctx.data, site: { ...site, preview: true } })).includes(
      'noindex',
    ),
  );
  assert.ok(!homePage(ctx).includes('noindex'));
});

test('price feeds keep the store object and mark the lowest price', () => {
  const data = {
    ...ctx.data,
    offers: {
      9780441013593: [
        { store: 'bookshop', price: 12.5, currency: 'USD' },
        { store: 'abebooks', price: 6, currency: 'USD' },
      ],
    },
  };
  const html = bookPage(createContext({ data, site }), dune);
  assert.ok(html.includes('$6.00'));
  assert.ok(html.includes('$12.50'));
  assert.equal(html.match(/Lowest price/g).length, 1);
  assert.ok(html.indexOf('AbeBooks') < html.indexOf('ThriftBooks'), 'priced offer sorts first');
  assert.ok(html.includes('/go/abebooks/9780441013593'));
});

// Synthetic data, so these tests do not depend on which real books have been reviewed.
const allDrafts = {
  ...ctx.data,
  books: ctx.data.books.map((book) => ({ ...book, status: 'draft' })),
};

test('empty production home page has no dead search box', () => {
  const prod = createContext({ data: allDrafts, site: { ...site, includeDrafts: false } });
  const html = homePage(prod);
  assert.ok(!html.includes('id="q"'));
  assert.ok(html.includes('Check back soon'));
});

test('production hides draft books and anything that points at them', () => {
  const prod = createContext({ data: allDrafts, site: { ...site, includeDrafts: false } });
  assert.equal(prod.published.length, 0);
  assert.equal(booksLikePage(prod, dune).includes('/books/the-name-of-the-wind/'), false);

  // One reviewed book: only it is published, and pairings to drafts are dropped.
  const mixed = {
    ...allDrafts,
    books: allDrafts.books.map((b) => (b.slug === 'dune' ? { ...b, status: 'reviewed' } : b)),
  };
  const partial = createContext({ data: mixed, site: { ...site, includeDrafts: false } });
  assert.deepEqual(
    partial.published.map((b) => b.slug),
    ['dune'],
  );
  assert.equal(partial.pairings(partial.bySlug.get('dune')).length, 0);
});
