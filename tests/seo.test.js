import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadData } from '../src/site/data.js';
import { layout } from '../src/site/layout.js';
import { bookPage, createContext, feelPairPage, feelPairs } from '../src/site/pages.js';
import { pageCount, pageHref, pager } from '../src/site/components.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const site = {
  name: 'Test Site',
  url: 'https://example.test',
  preview: false,
  includeDrafts: true,
};
const ctx = createContext({ data: loadData(root), site });

const ld = (html) =>
  JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'];
const title = (html) => html.match(/<title>(.*?)<\/title>/)[1];

test('long lists are split into crawlable pages', () => {
  assert.equal(pageCount(0), 1);
  assert.equal(pageCount(60), 1);
  assert.equal(pageCount(61), 2);
  assert.equal(pageHref('/genres/fantasy/', 1), '/genres/fantasy/');
  assert.equal(pageHref('/genres/fantasy/', 3), '/genres/fantasy/page/3/');
  const nav = pager('/books/', 5, 20);
  assert.ok(nav.includes('href="/books/page/4/"') && nav.includes('rel="next"'));
  assert.ok(nav.includes('aria-current="page">5<'));
  assert.equal(pager('/books/', 1, 1), '', 'no pager for a single page');
});

test('the site name joins the title only when it still fits in a result', () => {
  const page = (t) =>
    layout({ site, title: t, description: 'd', path: '/x/', body: '', breadcrumbs: [['X']] });
  assert.equal(title(page('Short')), 'Short | Test Site');
  const long = 'A title that is already close to the sixty character limit';
  assert.equal(title(page(long)), long);
});

test('pages carry one JSON-LD graph with an ordered breadcrumb trail', () => {
  const html = layout({
    site,
    title: 'T',
    description: 'd',
    path: '/genres/x/',
    body: '',
    breadcrumbs: [['Genres', '/genres/'], ['X']],
  });
  const crumbs = ld(html).find((n) => n['@type'] === 'BreadcrumbList');
  assert.deepEqual(
    crumbs.itemListElement.map((i) => [i.position, i.name]),
    [
      [1, 'Home'],
      [2, 'Genres'],
      [3, 'X'],
    ],
  );
  assert.equal(crumbs.itemListElement[2].item, undefined, 'the current page has no link');
  assert.equal(html.match(/application\/ld\+json/g).length, 1);
});

test('a book page answers the common questions in text and in matching FAQ markup', () => {
  const book = ctx.bySlug.get('dune');
  const html = bookPage(ctx, book);
  const graph = ld(html);
  assert.ok(graph.some((n) => n['@type'] === 'Book' && n.isbn === book.isbn13));
  const faq = graph.find((n) => n['@type'] === 'FAQPage');
  assert.ok(faq.mainEntity.length >= 5);
  for (const q of faq.mainEntity) {
    assert.ok(html.includes(`<dt>${q.name}</dt>`), `question is visible: ${q.name}`);
  }
  assert.ok(title(html).length <= 70);
  assert.match(html, /<meta name="robots" content="index, follow, max-image-preview:large/);
});

test('feeling pages open with a visible answer that names real books', () => {
  const { feeling, want } = feelPairs(ctx)[0];
  const html = feelPairPage(ctx, feeling, want);
  const answer = html.match(/id="answer-h">.*?<\/h2><p>(.*?)<\/p>/s)[1];
  assert.match(answer, /^Try /);
  const faq = ld(html).find((n) => n['@type'] === 'FAQPage');
  assert.equal(
    faq.mainEntity[0].acceptedAnswer.text.replace(/&#39;/g, "'"),
    answer.replace(/&#39;/g, "'"),
  );
});
