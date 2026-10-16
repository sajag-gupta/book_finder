import { handleBook } from '../../src/shared/book-api.js';

/** GET /api/book?isbn=...: facts about any book through Open Library. */
export const onRequestGet = ({ request, env, waitUntil }) =>
  handleBook(request, env, { cache: caches.default, waitUntil });
