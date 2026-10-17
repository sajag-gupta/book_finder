/**
 * Adds Hardcover's aggregate facts to each book: rating and rating count, readers, page count, series
 * (name, position, total), moods and reader-reported content warnings. Written to data/hardcover.json.
 *
 *   npm run enrich            fetch books not enriched yet (resumable)
 *   npm run enrich -- --refresh   refetch everything
 *
 * About 1 request per book at Hardcover's rate limit (roughly 10 minutes for 550 books). Credit
 * Hardcover wherever this data is shown. No descriptions or reviews are stored.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchBooks } from './hardcover-client.js';
import { pickHardcover } from '../src/review/checks.js';
import { summarise } from '../src/shared/hardcover.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'data', 'hardcover.json');
const refresh = process.argv.includes('--refresh');

const books = readdirSync(join(root, 'data', 'books'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(root, 'data', 'books', f), 'utf8')));

const state = existsSync(out)
  ? JSON.parse(readFileSync(out, 'utf8'))
  : { source: 'Hardcover', url: 'https://hardcover.app', fetchedAt: null, books: {} };

const todo = books.filter((b) => refresh || !state.books[b.slug]);
console.log(`${todo.length} of ${books.length} books to enrich`);

let done = 0;
let missed = 0;
for (const book of todo) {
  const docs = await searchBooks(`${book.title} ${book.author}`, { perPage: 8 });
  const doc = pickHardcover(book, docs);
  if (doc) state.books[book.slug] = summarise(doc);
  else missed++;
  done++;
  if (done % 10 === 0) {
    state.fetchedAt = new Date().toISOString();
    writeFileSync(out, `${JSON.stringify(state, null, 1)}\n`);
    console.log(`${done}/${todo.length} (${missed} not found)`);
  }
}
state.fetchedAt = new Date().toISOString();
writeFileSync(out, `${JSON.stringify(state, null, 1)}\n`);
console.log(
  `Done: ${Object.keys(state.books).length} books enriched, ${missed} not found on Hardcover.`,
);
