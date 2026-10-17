/**
 * Finds the most-read fiction on Hardcover that our catalogue lacks, so no popular book is missing.
 *
 *   npm run discover -- 150            list the 150 most-read missing books
 *   npm run discover -- 150 --write    also append them to data/catalogue/catalogue.json
 *   npm run discover -- 4400 --pages=700 --min-ratings=60 --write    go deeper for a bigger catalogue
 *
 * Only titles, authors, years and genres are used (facts). Each new book then goes through the same
 * pipeline as the rest: ISBN lookup, our own written record, and the two-source fact check.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchBooks } from './hardcover-client.js';
import { isValidIsbn13 } from '../src/shared/isbn.js';
import {
  cleanTitle,
  isNonfiction,
  ourGenres,
  primaryAuthor,
  sameBook,
} from '../src/shared/hardcover.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const file = join(root, 'data', 'catalogue', 'catalogue.json');
const want = Number(process.argv.find((a) => /^\d+$/.test(a)) ?? 150);
const write = process.argv.includes('--write');
const flag = (name, fallback) =>
  Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
// The search returns 25 books a page, so 5,000 books takes about 200 pages; raise --pages to go deeper.
const maxPages = flag('pages', 60);
const minRatings = flag('min-ratings', 100);

const catalogue = JSON.parse(readFileSync(file, 'utf8'));
const have = [...catalogue];

// Works we list under another title, or that are plays and retellings rather than novels.
const SKIP = new Set([
  '1984',
  'The Fellowship of the Ring',
  'Norse Mythology',
  'The Odyssey',
  'Harry Potter and the Cursed Child',
  'A Christmas Carol',
]);

const EDITION_NOISE =
  /box(ed)? set|complete|collection|omnibus|illustrated|anniversary|special edition|trilogy|bundle|volume \d|books? \d/i;

const found = [];
for (let page = 1; page <= maxPages && found.length < want; page++) {
  const docs = await searchBooks('*', { perPage: 50, page, sort: 'users_count:desc' });
  if (!docs.length) break;
  for (const doc of docs) {
    const title = cleanTitle(doc.title);
    const author = primaryAuthor(doc);
    const genres = ourGenres(doc.genres);
    const ok =
      author &&
      !SKIP.has(title) &&
      !doc.compilation &&
      (doc.ratings_count ?? 0) >= minRatings &&
      doc.release_year >= 1800 &&
      genres.length > 0 &&
      !isNonfiction(doc.genres) &&
      !EDITION_NOISE.test(doc.title) &&
      !have.some((b) => sameBook(b, { title, author }));
    if (!ok) continue;
    // Hardcover lists the ISBNs of the book's editions. An English-registrant (978-0 or 978-1) one
    // with a valid check digit saves a slow Open Library search; it is still verified later.
    const isbn13 = (doc.isbns ?? []).find(
      (i) => /^97[89]\d{10}$/.test(i) && /^97[89][01]/.test(i) && isValidIsbn13(i),
    );
    have.push({ title, author });
    found.push({
      title,
      author,
      year: doc.release_year,
      genres,
      soldMillions: null,
      group: 'modern',
      ...(isbn13 ? { isbn13 } : {}),
      usersCount: doc.users_count,
    });
  }
  console.error(`page ${page}: ${found.length} missing books so far`);
}

const picked = found.slice(0, want);
for (const b of picked)
  console.log(
    `${String(b.usersCount).padStart(6)}  ${b.title} (${b.author}, ${b.year}) [${b.genres.join(', ')}]`,
  );

if (write) {
  const additions = picked.map(({ usersCount: _u, ...entry }) => entry);
  writeFileSync(file, `${JSON.stringify([...catalogue, ...additions], null, 1)}\n`);
  console.error(
    `Added ${additions.length} books to the catalogue (no ISBNs yet: run npm run catalogue:isbns).`,
  );
}
