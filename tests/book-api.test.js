import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handleBook, handleSearch } from '../src/shared/book-api.js';

const req = (path) => new Request(`https://example.test${path}`);
const body = (r) => r.json();

const doc = {
  title: 'Dune',
  author_name: ['Frank Herbert'],
  editions: { docs: [{ isbn: ['9780441013593'] }] },
  first_publish_year: 1965,
};
const okFetch = async () => new Response(JSON.stringify({ docs: [doc] }), { status: 200 });

function fakeCache() {
  const store = new Map();
  return {
    store,
    match: async (r) => store.get(r.url)?.clone(),
    put: async (r, res) => void store.set(r.url, res),
  };
}

test('search returns mapped results with a one-hour cache header', async () => {
  const res = await handleSearch(req('/api/search?q=dune'), {}, { fetchImpl: okFetch });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('Cache-Control'), 'public, max-age=3600');
  assert.equal((await body(res)).results[0].isbn13, '9780441013593');
});

test('search ignores empty and one-character queries without calling Open Library', async () => {
  const never = async () => {
    throw new Error('should not be called');
  };
  assert.deepEqual(
    await body(await handleSearch(req('/api/search?q='), {}, { fetchImpl: never })),
    { results: [] },
  );
  assert.deepEqual(
    await body(await handleSearch(req('/api/search?q=a'), {}, { fetchImpl: never })),
    { results: [] },
  );
});

test('search serves repeat queries from the edge cache', async () => {
  const cache = fakeCache();
  let calls = 0;
  const counting = async (...a) => {
    calls++;
    return okFetch(...a);
  };
  const waits = [];
  const options = { fetchImpl: counting, cache, waitUntil: (p) => waits.push(p) };
  await handleSearch(req('/api/search?q=dune'), {}, options);
  await Promise.all(waits);
  await handleSearch(req('/api/search?q=dune'), {}, options);
  assert.equal(calls, 1);
});

test('search degrades quietly when Open Library fails, and does not cache the failure', async () => {
  const cache = fakeCache();
  const failing = async () => {
    throw new Error('down');
  };
  const res = await handleSearch(
    req('/api/search?q=dune'),
    {},
    { fetchImpl: failing, cache, waitUntil: () => {} },
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await body(res), { results: [], degraded: true });
  assert.equal(res.headers.get('Cache-Control'), 'no-store');
});

test('book lookup returns facts, 404s for unknown or invalid ISBNs', async () => {
  const routes = {
    '/isbn/9780441013593.json': { title: 'Dune', number_of_pages: 528 },
  };
  const fetchImpl = async (url) => {
    const r = routes[new URL(url).pathname];
    return r ? new Response(JSON.stringify(r)) : new Response('', { status: 404 });
  };
  const ok = await handleBook(req('/api/book?isbn=9780441013593'), {}, { fetchImpl });
  assert.equal(ok.status, 200);
  assert.equal((await body(ok)).book.pages, 528);
  assert.equal(
    (await handleBook(req('/api/book?isbn=9780441013594'), {}, { fetchImpl })).status,
    404,
  );
  assert.equal(
    (await handleBook(req('/api/book?isbn=9781234567897'), {}, { fetchImpl })).status,
    404,
  );
  assert.equal((await handleBook(req('/api/book'), {}, { fetchImpl })).status, 404);
});

test('book lookup reports an upstream failure as 502', async () => {
  const failing = async () => {
    throw new Error('down');
  };
  assert.equal(
    (await handleBook(req('/api/book?isbn=9780441013593'), {}, { fetchImpl: failing })).status,
    502,
  );
});

test('empty search results are cached briefly, not for an hour', async () => {
  const none = async () => new Response(JSON.stringify({ docs: [] }), { status: 200 });
  const res = await handleSearch(req('/api/search?q=zzzz'), {}, { fetchImpl: none });
  assert.equal(res.headers.get('Cache-Control'), 'public, max-age=120');
});
