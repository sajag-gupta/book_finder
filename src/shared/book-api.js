/**
 * Request handlers for /api/search and /api/book, kept free of Cloudflare globals so they can be
 * unit-tested. `cache` is Workers' caches.default (or a fake in tests); `waitUntil` finishes the
 * cache write after the response is sent.
 */
import { lookupBook, searchBooks } from './openlibrary.js';

const json = (body, { status = 200, maxAge = 0 } = {}) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': maxAge ? `public, max-age=${maxAge}` : 'no-store' },
  });

async function cached(request, cache, waitUntil, produce) {
  const hit = cache ? await cache.match(request) : undefined;
  if (hit) return hit;
  const response = await produce();
  if (cache && response.status === 200) waitUntil?.(cache.put(request, response.clone()));
  return response;
}

/** GET /api/search?q=...  ->  { results: [{title, author, year, isbn13, coverId}] } */
export function handleSearch(request, env, { fetchImpl = fetch, cache, waitUntil } = {}) {
  const q = new URL(request.url).searchParams.get('q') ?? '';
  if (q.trim().length < 2) return json({ results: [] });
  return cached(request, cache, waitUntil, async () => {
    try {
      const results = await searchBooks(q, { fetchImpl, contact: env.OL_CONTACT });
      // An empty answer may be a hiccup upstream, so it is cached briefly; real results for an hour.
      return json({ results }, { maxAge: results.length ? 3600 : 120 });
    } catch {
      // Open Library is down or slow: say so quietly and let the page fall back to local results.
      return json({ results: [], degraded: true }, { status: 200 });
    }
  });
}

/** GET /api/book?isbn=...  ->  facts about one book, or 404 */
export function handleBook(request, env, { fetchImpl = fetch, cache, waitUntil } = {}) {
  const isbn = new URL(request.url).searchParams.get('isbn') ?? '';
  return cached(request, cache, waitUntil, async () => {
    try {
      const book = await lookupBook(isbn, { fetchImpl, contact: env.OL_CONTACT });
      return book
        ? json({ book }, { maxAge: 86400 })
        : json({ error: 'Not found' }, { status: 404 });
    } catch {
      return json({ error: 'Lookup unavailable' }, { status: 502 });
    }
  });
}
