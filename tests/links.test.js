import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStoreUrl, goPath } from '../src/shared/links.js';
import { allStores, getStore, affiliateIds } from '../src/shared/registry.js';

const ISBN = '9780441013593';

test('the shipped config sends Kobo traffic to the US program, not Brazil', () => {
  const { url, affiliate } = buildStoreUrl(
    getStore('kobo'),
    { isbn13: ISBN, query: 'Dune Frank Herbert' },
    affiliateIds,
  );
  assert.equal(affiliate, true);
  const u = new URL(url);
  assert.equal(u.hostname, 'click.linksynergy.com');
  assert.equal(u.searchParams.get('mid'), '37217');
  assert.ok(u.searchParams.get('murl').startsWith('https://www.kobo.com/us/'));
});

test('uses the plain URL when affiliate IDs are missing', () => {
  const result = buildStoreUrl(
    getStore('bookshop'),
    { isbn13: ISBN },
    { awin_publisher_id: '777' },
  );
  assert.deepEqual(result, { url: `https://bookshop.org/book/${ISBN}`, affiliate: false });
});

test('uses the Awin template once the account and the program are both set', () => {
  const ids = { awin_publisher_id: '777', awin_bookshop_mid: '92005' };
  const result = buildStoreUrl(getStore('bookshop'), { isbn13: ISBN }, ids);
  assert.equal(result.affiliate, true);
  assert.equal(
    result.url,
    `https://www.awin1.com/cread.php?awinmid=92005&awinaffid=777&ued=${encodeURIComponent(`https://bookshop.org/book/${ISBN}`)}`,
  );
});

test('Libro.fm stays a plain link until its Awin program is approved', () => {
  const store = getStore('librofm');
  const query = 'Dune Frank Herbert';
  assert.equal(
    buildStoreUrl(store, { isbn13: ISBN, query }, { awin_publisher_id: '777' }).affiliate,
    false,
  );
  const approved = buildStoreUrl(
    store,
    { isbn13: ISBN, query },
    { awin_publisher_id: '777', awin_librofm_mid: '25361' },
  );
  assert.equal(approved.affiliate, true);
  assert.ok(
    approved.url.startsWith('https://www.awin1.com/cread.php?awinmid=25361&awinaffid=777&ued='),
  );
  assert.ok(
    approved.url.includes(encodeURIComponent('https://libro.fm/search?q=Dune%20Frank%20Herbert')),
  );
});

test('requires every ID, not just one (Kobo needs partner and merchant)', () => {
  const store = getStore('kobo');
  const partial = buildStoreUrl(store, { isbn13: ISBN, query: 'Dune' }, { kobo_partner_id: 'abc' });
  assert.equal(partial.affiliate, false);

  const full = buildStoreUrl(
    store,
    { isbn13: ISBN, query: 'Dune' },
    { kobo_partner_id: 'abc', kobo_merchant_id: '37217' },
  );
  assert.equal(full.affiliate, true);
  assert.ok(full.url.startsWith('https://click.linksynergy.com/deeplink?id=abc&mid=37217&murl='));
  assert.ok(full.url.includes(encodeURIComponent('https://www.kobo.com/us/en/search?query=Dune')));
});

test('URL-encodes the search hint and cannot inject a new host', () => {
  const { url } = buildStoreUrl(getStore('kobo'), {
    isbn13: ISBN,
    query: 'x&y=1#"><script>',
  });
  assert.ok(url.startsWith('https://www.kobo.com/'));
  assert.ok(!url.includes('<'));
  assert.ok(!url.includes('#'));
});

test('falls back to the ISBN when no search hint is given', () => {
  const { url } = buildStoreUrl(getStore('kobo'), { isbn13: ISBN });
  assert.ok(url.endsWith(`query=${ISBN}`));
});

test('every configured store builds a plain URL without throwing', () => {
  for (const store of allStores) {
    const { url } = buildStoreUrl(store, { isbn13: ISBN, query: 'Dune' });
    assert.ok(url.startsWith('https://'), `${store.id} -> ${url}`);
  }
});

test('goPath builds the first-party redirect path', () => {
  assert.equal(goPath('kobo', ISBN), `/go/kobo/${ISBN}`);
  assert.equal(goPath('kobo', ISBN, 'Dune & more'), `/go/kobo/${ISBN}?q=Dune%20%26%20more`);
});
