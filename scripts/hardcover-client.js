/** Minimal Hardcover GraphQL client for our scripts: polite rate limiting plus retry on 429. */
import { setTimeout as sleep } from 'node:timers/promises';

const token = process.env.HARDCOVER_TOKEN;
if (!token) {
  console.error('Set HARDCOVER_TOKEN in .env first (hardcover.app, account settings, API).');
  process.exit(1);
}
const auth = /^bearer /i.test(token) ? token : `Bearer ${token}`;

// Hardcover allows about 60 requests a minute per token.
const GAP_MS = 1100;

async function graphql(query) {
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const response = await fetch('https://api.hardcover.app/v1/graphql', {
        method: 'POST',
        headers: {
          Authorization: auth,
          'Content-Type': 'application/json',
          'User-Agent': 'BookFinder/0.1',
        },
        body: JSON.stringify({ query }),
      });
      await sleep(GAP_MS);
      if (response.status === 429 || response.status >= 500) {
        await sleep(5000 * (attempt + 1));
        continue;
      }
      if (!response.ok) throw new Error(`Hardcover API ${response.status}`);
      const body = await response.json();
      if (body.errors) throw new Error(body.errors[0].message);
      return body.data;
    } catch (error) {
      if (attempt === 3) throw error;
      await sleep(3000 * (attempt + 1));
    }
  }
  throw new Error('Hardcover API unavailable');
}

/** Search documents for a text query. `sort` is a Typesense expression such as "users_count:desc". */
export async function searchBooks(text, { perPage = 5, page = 1, sort } = {}) {
  const sortArg = sort ? `, sort: ${JSON.stringify(sort)}` : '';
  const data = await graphql(
    `{ search(query: ${JSON.stringify(text)}, query_type: "Book", per_page: ${perPage}, page: ${page}${sortArg}) { results } }`,
  );
  return (data.search.results.hits ?? []).map((hit) => hit.document);
}
