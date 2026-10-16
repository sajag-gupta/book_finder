import { handleSearch } from '../../src/shared/book-api.js';

/** GET /api/search?q=...: find any book through Open Library (see src/shared/book-api.js). */
export const onRequestGet = ({ request, env, waitUntil }) =>
  handleSearch(request, env, { cache: caches.default, waitUntil });
