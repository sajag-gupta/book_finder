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

test('production hides draft books and anything that points at them', () => {
  const prod = createContext({ data: ctx.data, site: { ...site, includeDrafts: false } });
  assert.equal(prod.published.length, 0);
  assert.equal(booksLikePage(prod, dune).includes('/books/the-name-of-the-wind/'), false);
});
