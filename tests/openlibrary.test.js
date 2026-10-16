import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupe,
  lookupBook,
  mapBook,
  mapSearchDoc,
  pickIsbn13,
  searchBooks,
} from '../src/shared/openlibrary.js';

const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

test('pickIsbn13 prefers English-registrant ISBNs and drops invalid ones', () => {
  assert.equal(
    pickIsbn13(['9783161484100', '9780441013593', '0441013597', 'junk']),
    '9780441013593',
  );
  assert.equal(pickIsbn13(['9783161484100']), '9783161484100');
  assert.equal(pickIsbn13(['9780441013594', '12345']), null);
  assert.equal(pickIsbn13(undefined), null);
});

test('mapSearchDoc needs a title and a usable ISBN', () => {
  const doc = {
    title: 'Dune',
    author_name: ['Frank Herbert'],
    first_publish_year: 1965,
    editions: { docs: [{ isbn: ['9780441013593'], cover_i: 12 }] },
  };
  assert.deepEqual(mapSearchDoc(doc), {
    title: 'Dune',
    author: 'Frank Herbert',
    year: 1965,
    isbn13: '9780441013593',
    coverId: 12,
  });
  assert.equal(mapSearchDoc({ ...doc, editions: { docs: [] } }), null);
  // Regression: translations' ISBNs on the work must never be used (an Urdu Sapiens once was).
  assert.equal(
    mapSearchDoc({ title: 'Sapiens', isbn: ['9781716994982'], language: ['urd', 'eng'] }),
    null,
  );
  assert.equal(mapSearchDoc({ ...doc, title: '' }), null);
});

test('dedupe keeps one result per title and author', () => {
  const r = [
    { title: 'Dune', author: 'Frank Herbert', isbn13: '1' },
    { title: 'DUNE', author: 'frank herbert', isbn13: '2' },
    { title: 'Dune Messiah', author: 'Frank Herbert', isbn13: '3' },
  ];
  assert.deepEqual(
    dedupe(r).map((x) => x.isbn13),
    ['1', '3'],
  );
});

test('mapBook builds facts, trims subjects and takes the first real cover', () => {
  const book = mapBook({
    edition: {
      title: 'Dune',
      number_of_pages: 528,
      publishers: ['Ace'],
      covers: [-1, 99],
      publish_date: 'August 2005',
    },
    work: { first_publish_date: '1965', subjects: ['Fiction', 'x'.repeat(60), 42] },
    authors: ['Frank Herbert', undefined],
  });
  assert.deepEqual(book, {
    title: 'Dune',
    subtitle: null,
    authors: ['Frank Herbert'],
    year: 1965,
    pages: 528,
    publisher: 'Ace',
    subjects: ['Fiction'],
    coverId: 99,
  });
});

test('searchBooks queries Open Library with an identifying User-Agent', async () => {
  let seen;
  const results = await searchBooks('dune', {
    contact: 'me@example.com',
    fetchImpl: async (url, init) => {
      seen = { url, init };
      return json({
        docs: [
          {
            title: 'Dune',
            author_name: ['Frank Herbert'],
            editions: { docs: [{ isbn: ['9780441013593'] }] },
          },
          { title: 'No ISBN' },
        ],
      });
    },
  });
  assert.equal(results.length, 1);
  assert.ok(seen.url.startsWith('https://openlibrary.org/search.json?q=dune%20language%3Aeng'));
  assert.match(seen.init.headers['User-Agent'], /me@example\.com/);
});

test('searchBooks ignores tiny queries and survives an Open Library outage', async () => {
  const never = async () => {
    throw new Error('should not be called');
  };
  assert.deepEqual(await searchBooks('a', { fetchImpl: never }), []);
  assert.deepEqual(
    await searchBooks('dune', { fetchImpl: async () => new Response('', { status: 503 }) }),
    [],
  );
});

test('lookupBook joins edition, work and author names', async () => {
  const routes = {
    '/isbn/9780441013593.json': {
      title: 'Dune',
      number_of_pages: 528,
      works: [{ key: '/works/OL893415W' }],
    },
    '/works/OL893415W.json': {
      title: 'Dune',
      first_publish_date: '1965',
      subjects: ['Science fiction'],
      authors: [{ author: { key: '/authors/OL79034A' } }],
    },
    '/authors/OL79034A.json': { name: 'Frank Herbert' },
  };
  const book = await lookupBook('978-0-441-01359-3', {
    fetchImpl: async (url) => {
      const route = routes[new URL(url).pathname];
      return route ? json(route) : new Response('', { status: 404 });
    },
  });
  assert.equal(book.isbn13, '9780441013593');
  assert.deepEqual(book.authors, ['Frank Herbert']);
  assert.equal(book.year, 1965);
  assert.equal(book.pages, 528);
});

test('lookupBook rejects bad ISBNs and unknown books, and never follows odd keys', async () => {
  const never = async () => {
    throw new Error('should not be called');
  };
  assert.equal(await lookupBook('9780441013594', { fetchImpl: never }), null);
  assert.equal(await lookupBook('not-an-isbn', { fetchImpl: never }), null);
  assert.equal(
    await lookupBook('9780441013593', { fetchImpl: async () => new Response('', { status: 404 }) }),
    null,
  );

  const requested = [];
  await lookupBook('9780441013593', {
    fetchImpl: async (url) => {
      requested.push(new URL(url).pathname);
      if (url.includes('/isbn/'))
        return json({
          title: 'Dune',
          works: [{ key: '/../../evil' }],
          authors: [{ key: '/authors/OL1A/../x' }],
        });
      return json({});
    },
  });
  assert.deepEqual(requested, ['/isbn/9780441013593.json'], 'untrusted keys are not fetched');
});
