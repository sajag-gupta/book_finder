import { isValidIsbn13, normalizeIsbn } from '../../../src/shared/isbn.js';
import { buildStoreUrl } from '../../../src/shared/links.js';
import { affiliateIds, getStore } from '../../../src/shared/registry.js';
import { clickRecord, logClick } from '../../../src/shared/clicks.js';

const HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};

/** GET /go/<store>/<isbn13>[?q=<search hint>]: log the click, then 302 to the retailer. */
export async function onRequestGet({ params, request, env, waitUntil }) {
  const store = getStore(params.store);
  const isbn13 = normalizeIsbn(params.isbn);
  if (!store || !isValidIsbn13(isbn13)) {
    return new Response('Not found', { status: 404, headers: HEADERS });
  }

  const params2 = new URL(request.url).searchParams;
  const query = params2.get('q') ?? '';
  // Amazon's Associates rules do not allow affiliate links in email, so links from the newsletter
  // (marked utm_medium=email) go to Amazon without our tag.
  const ids =
    store.id === 'amazon' && params2.get('utm_medium') === 'email'
      ? { ...affiliateIds, amazon_tag: '' }
      : affiliateIds;
  const { url, affiliate } = buildStoreUrl(store, { isbn13, query }, ids);

  waitUntil(logClick(env.DB, clickRecord(request, { storeId: store.id, isbn13, affiliate })));
  return new Response(null, { status: 302, headers: { ...HEADERS, Location: url } });
}
