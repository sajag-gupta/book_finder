/**
 * Refreshes data/trending.json from Hardcover's official GraphQL API (books most read over the last
 * 30 days). Only titles and authors are stored (facts), and the site credits Hardcover wherever it
 * shows them. Hardcover's terms allow aggregate data with attribution; they forbid using users'
 * libraries or reviews, and training language models on the data, so this does neither.
 *
 *   npm run trending
 *
 * Needs HARDCOVER_TOKEN. Also prints trending books missing from our catalogue, as candidates to add.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify } from '../src/shared/slug.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const { HARDCOVER_TOKEN } = process.env;
if (!HARDCOVER_TOKEN) {
  console.error('Set HARDCOVER_TOKEN (from hardcover.app account settings, API) first.');
  process.exit(1);
}

async function graphql(query) {
  const response = await fetch('https://api.hardcover.app/v1/graphql', {
    method: 'POST',
    headers: {
      Authorization: /^bearer /i.test(HARDCOVER_TOKEN)
        ? HARDCOVER_TOKEN
        : `Bearer ${HARDCOVER_TOKEN}`,
      'Content-Type': 'application/json',
      'User-Agent': 'BookFinder/0.1 (trending refresh)',
    },
    body: JSON.stringify({ query }),
  });
  if (!response.ok) throw new Error(`Hardcover API ${response.status}`);
  const body = await response.json();
  if (body.errors) throw new Error(body.errors[0].message);
  return body.data;
}

const day = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const range = { from: day(-30), to: day(0) };

const { books_trending: trending } = await graphql(
  `{ books_trending(from: "${range.from}", to: "${range.to}", limit: 40) { ids error } }`,
);
if (trending.error || !trending.ids?.length) {
  throw new Error(`No trending data: ${trending.error ?? 'empty result'}`);
}

const { books } = await graphql(
  `{ books(where: { id: { _in: ${JSON.stringify(trending.ids)} } }) { id title contributions(limit: 1) { author { name } } } }`,
);
const byId = new Map(books.map((b) => [b.id, b]));
const entries = trending.ids
  .map((id) => byId.get(id))
  .filter(Boolean)
  .map((b) => ({ title: b.title, author: b.contributions?.[0]?.author?.name ?? '' }));

writeFileSync(
  join(root, 'data', 'trending.json'),
  `${JSON.stringify(
    {
      source: 'Hardcover',
      url: 'https://hardcover.app/trending/month',
      range,
      fetchedAt: new Date().toISOString(),
      entries,
    },
    null,
    2,
  )}\n`,
);

const catalogue = new Set(
  JSON.parse(readFileSync(join(root, 'data', 'catalogue', 'catalogue.json'), 'utf8')).map((b) =>
    slugify(b.title),
  ),
);
const missing = entries.filter((e) => !catalogue.has(slugify(e.title.split(':')[0])));
console.log(`Saved ${entries.length} trending books (${range.from} to ${range.to}).`);
console.log(`${missing.length} are not in the catalogue yet:`);
for (const e of missing) console.log(`  ${e.title} (${e.author})`);
