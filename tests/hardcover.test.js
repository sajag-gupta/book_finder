import { catalogIndex } from '../src/site/catalog.js';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadData } from '../src/site/data.js';
import { createContext } from '../src/site/context.js';
import { bookPage, browsePage } from '../src/site/pages.js';
import {
  cleanTitle,
  isNonfiction,
  ourGenres,
  primaryAuthor,
  sameBook,
  summarise,
} from '../src/shared/hardcover.js';

test('ourGenres maps Hardcover genres, keeps order, dedupes and caps at three', () => {
  assert.deepEqual(ourGenres(['Fantasy', 'Epic Fantasy', 'Classics', 'Adventure']), [
    'fantasy',
    'epic-fantasy',
    'classic',
  ]);
  assert.deepEqual(ourGenres(['Suspense', 'Thriller']), ['thriller']);
  assert.deepEqual(ourGenres(['Cooking', 'Home']), ['cookbooks']);
  assert.deepEqual(ourGenres(['Home', 'Weather']), []);
  assert.deepEqual(ourGenres(undefined), []);
});

test('isNonfiction recognises non-fiction genres', () => {
  assert.equal(isNonfiction(['Self Help', 'Psychology']), true);
  assert.equal(isNonfiction(['Fantasy']), false);
});

test('cleanTitle strips series, alternate titles and "A Novel"', () => {
  assert.equal(cleanTitle('Dune (Dune Chronicles #1)'), 'Dune');
  assert.equal(cleanTitle('Babel, or the Necessity of Violence'), 'Babel');
  assert.equal(cleanTitle('Station Eleven: A Novel'), 'Station Eleven');
  assert.equal(cleanTitle('The Hobbit, or There and Back Again'), 'The Hobbit');
  assert.equal(cleanTitle('Mistborn: The Final Empire'), 'Mistborn: The Final Empire');
});

test('sameBook matches the same book across title and author formats', () => {
  const b = (title, author) => ({ title, author });
  assert.ok(
    sameBook(
      b('The Hobbit, or There and Back Again', 'J.R.R. Tolkien'),
      b('The Hobbit', 'J. R. R. Tolkien'),
    ),
  );
  assert.ok(sameBook(b('Shōgun', 'James Clavell'), b('Shogun', 'James Clavell')));
  assert.ok(
    sameBook(b('The Three-Body Problem', 'Cixin Liu'), b('The Three-Body Problem', 'Liu Cixin')),
  );
  assert.ok(
    sameBook(
      b('Good Omens: The Nice and Accurate Prophecies of Agnes Nutter, Witch', 'Neil Gaiman'),
      b('Good Omens', 'Terry Pratchett and Neil Gaiman'),
    ),
  );
  assert.ok(
    sameBook(
      b('Mistborn: The Final Empire', 'Brandon Sanderson'),
      b('Mistborn: The Final Empire', 'Brandon Sanderson'),
    ),
  );
});

test('sameBook keeps sequels, other authors and different subtitles apart', () => {
  const b = (title, author) => ({ title, author });
  assert.ok(!sameBook(b('Dune', 'Frank Herbert'), b('Dune Messiah', 'Frank Herbert')));
  assert.ok(!sameBook(b('Dune', 'Frank Herbert'), b('Dune', 'Someone Else')));
  assert.ok(
    !sameBook(
      b('Mistborn: The Final Empire', 'Brandon Sanderson'),
      b('Mistborn: The Well of Ascension', 'Brandon Sanderson'),
    ),
  );
});

test('summarise keeps only aggregate facts, trimmed and tidied', () => {
  const doc = {
    id: 446681,
    slug: 'dungeon-crawler-carl',
    rating: 4.335855576739752,
    ratings_count: 4196,
    users_count: 11579,
    pages: 465,
    description: 'A long blurb that we must never keep',
    featured_series: {
      position: 1,
      series: { name: 'Dungeon Crawler Carl', books_count: 10, primary_books_count: 7 },
    },
    moods: ['Adventurous', 'funny', 'Funny', 'dark'],
    content_warnings: ['Death', 'death', 'child death', '', 'Violence'],
  };
  const s = summarise(doc);
  assert.equal(s.rating, 4.3);
  assert.deepEqual(s.series, { name: 'Dungeon Crawler Carl', position: 1, total: 7 });
  assert.deepEqual(s.moods, ['Adventurous', 'Funny', 'Dark']);
  assert.deepEqual(s.contentWarnings, ['Death', 'Child death', 'Violence']);
  assert.ok(!('description' in s), 'free text is never stored');
  assert.equal(summarise({ id: 1, slug: 'x' }).series, null);
});

test('primaryAuthor ignores annotators and illustrators listed first', () => {
  const doc = {
    author_names: ['Philip Gooden', 'Charles Dickens'],
    contributions: [
      { contribution: 'Editor', author: { name: 'Philip Gooden' } },
      { contribution: 'Author', author: { name: 'Charles Dickens' } },
    ],
  };
  assert.equal(primaryAuthor(doc), 'Charles Dickens');
  assert.equal(primaryAuthor({ author_names: ['Only Name'] }), 'Only Name');
  assert.equal(primaryAuthor({}), null);
});

// ---------- Book page ----------
const data = loadData(fileURLToPath(new URL('..', import.meta.url)));
const site = { name: 'Test', url: 'https://example.test', preview: false, includeDrafts: true };
const withHc = (entry) =>
  createContext({
    data: { ...data, hardcover: { source: 'Hardcover', books: { piranesi: entry } } },
    site,
  });
const page = (ctx) => bookPage(ctx, ctx.bySlug.get('piranesi'));
const base = {
  id: 1,
  slug: 'piranesi-2020',
  rating: 4.3,
  ratingsCount: 4196,
  usersCount: 8080,
  pages: 272,
};

test('the book page credits Hardcover for ratings, pages and series', () => {
  const html = page(
    withHc({ ...base, series: { name: 'The Test Series', position: 2, total: 7 } }),
  );
  assert.ok(html.includes('<strong>4.3</strong>'));
  assert.ok(html.includes('4,196 ratings from Hardcover readers'));
  assert.ok(!/href="[^"]*hardcover\.app/i.test(html), 'no outbound link to Hardcover');
  assert.ok(html.includes('<dt>Pages</dt><dd>272</dd>'));
  assert.ok(html.includes('Book 2 of 7 in The Test Series'));
});

test('a rating from only a handful of readers is not shown', () => {
  const html = page(withHc({ ...base, ratingsCount: 5 }));
  assert.ok(!html.includes('class="rating"'));
});

test('without Hardcover data the page makes no claims it cannot back', () => {
  const ctx = createContext({ data: { ...data, hardcover: null }, site });
  const html = bookPage(ctx, ctx.bySlug.get('piranesi'));
  assert.ok(!html.includes('class="rating"'));
  assert.ok(!html.includes('<dt>Pages</dt>'));
  assert.ok(html.includes('Standalone'));
});

test('reader-reported warnings skip ones we already list and are escaped', () => {
  const html = page(
    withHc({
      ...base,
      contentWarnings: ['Death', 'Manipulation', 'Body horror', '<script>x</script>'],
    }),
  );
  assert.ok(html.includes('Also reported by Hardcover readers'));
  assert.ok(html.includes('Body horror'));
  assert.ok(!html.includes('<script>x</script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  const reported = html.slice(html.indexOf('Also reported by Hardcover readers'));
  assert.ok(
    !/>\s*Death\s*</.test(reported.slice(0, reported.indexOf('</section>'))),
    'Death is already in our list',
  );
});

test('browse offers a most-read sort and the catalogue index carries reader counts', () => {
  const ctx = withHc(base);
  assert.ok(browsePage(ctx).includes('<option value="popular">Most read on Hardcover</option>'));
  const piranesi = catalogIndex(ctx).books.find((b) => b.s === 'piranesi');
  assert.equal(piranesi.users, 8080);
});
