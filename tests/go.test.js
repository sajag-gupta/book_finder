import { test } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestGet } from '../functions/go/[store]/[isbn].js';

const ISBN = '9780441013593';

function call(store, isbn, { query = '', headers = {}, db } = {}) {
  const pending = [];
  const request = new Request(`https://example.test/go/${store}/${isbn}${query}`, { headers });
  const run = onRequestGet({
    params: { store, isbn },
    request,
    env: { DB: db },
    waitUntil: (p) => pending.push(p),
  });
  return run.then(async (response) => {
    await Promise.all(pending);
    return response;
  });
}

function fakeDb() {
  const calls = [];
  return {
    calls,
    prepare: (sql) => ({
      bind: (...args) => ({
        run: async () => {
          calls.push({ sql, args });
        },
      }),
    }),
  };
}

test('redirects to the store and logs the click', async () => {
  const db = fakeDb();
  const response = await call('amazon', ISBN, {
    db,
    headers: { Referer: 'https://example.test/books/dune/?secret=1' },
  });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('Location'), `https://www.amazon.com/s?k=${ISBN}&i=stripbooks`);
  assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.equal(db.calls.length, 1);
  assert.deepEqual(db.calls[0].args, ['amazon', ISBN, 0, 'example.test', null]);
});

test('404s for an unknown store or a bad ISBN, and never logs', async () => {
  const db = fakeDb();
  assert.equal((await call('nope', ISBN, { db })).status, 404);
  assert.equal((await call('amazon', '9780441013594', { db })).status, 404);
  assert.equal((await call('amazon', 'javascript:alert(1)', { db })).status, 404);
  assert.equal(db.calls.length, 0);
});

test('the search hint is encoded and cannot change the destination host', async () => {
  const response = await call('kobo', ISBN, { query: '?q=' + encodeURIComponent('x#@evil.test/') });
  const location = new URL(response.headers.get('Location'));
  // Kobo goes through the Rakuten tracker; the real destination travels encoded in murl.
  assert.equal(location.host, 'click.linksynergy.com');
  assert.equal(location.searchParams.get('mid'), '37217');
  assert.equal(new URL(location.searchParams.get('murl')).host, 'www.kobo.com');
});

test('a failing click log never breaks the redirect', async () => {
  const db = {
    prepare: () => ({
      bind: () => ({
        run: async () => {
          throw new Error('d1 down');
        },
      }),
    }),
  };
  const response = await call('amazon', ISBN, { db });
  assert.equal(response.status, 302);
});

test('works without a database binding', async () => {
  assert.equal((await call('amazon', ISBN)).status, 302);
});
