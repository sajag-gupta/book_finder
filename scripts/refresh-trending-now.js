/**
 * Makes sure every book in data/trending-now.json exists on the site.
 *
 *   npm run trending:now
 *
 * A book already in data/books or data/light is left alone. For the rest it searches Hardcover
 * (HARDCOVER_TOKEN in .env), and adds a facts-only listing to data/light/books.json when it finds an
 * edition with an English-registrant ISBN-13. Anything it cannot find is printed, so the list can be
 * fixed by hand. Only facts are stored: title, author, year, ISBN, pages and rating counts.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchBooks } from './hardcover-client.js';
import { isValidIsbn13 } from '../src/shared/isbn.js';
import { slugify } from '../src/shared/slug.js';
import { cleanTitle, ourGenres, primaryAuthor, sameBook } from '../src/shared/hardcover.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (...p) => JSON.parse(readFileSync(join(root, ...p), 'utf8'));
const list = read('data', 'trending-now.json');
const lightFile = join(root, 'data', 'light', 'books.json');
const light = existsSync(lightFile) ? read('data', 'light', 'books.json') : [];
const books = readdirSync(join(root, 'data', 'books'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => read('data', 'books', f))
  .filter((b) => b.status === 'checked' || b.status === 'reviewed');

const known = (entry) =>
  books.some((b) => sameBook(b, entry)) ||
  light.some((b) => sameBook({ title: b.t, author: b.a }, entry));
const englishIsbn = (doc) =>
  (doc.isbns ?? []).find((i) => /^97[89][01]\d{9}$/.test(i) && isValidIsbn13(i));

const slugs = new Set([...books.map((b) => b.slug), ...light.map((b) => b.s)]);
const isbns = new Set([...books.map((b) => b.isbn13), ...light.map((b) => b.i)]);
const missing = [];
let added = 0;

for (const group of list.groups) {
  for (const entry of group.books) {
    if (known(entry)) continue;
    const query = `${entry.title} ${entry.author}`;
    const docs = await searchBooks(query, { perPage: 8 });
    const doc = docs.find(
      (d) =>
        englishIsbn(d) &&
        !d.compilation &&
        sameBook(
          { title: cleanTitle(d.title), author: primaryAuthor(d) },
          { title: entry.title, author: entry.author },
        ),
    );
    if (!doc || isbns.has(englishIsbn(doc))) {
      missing.push(`${entry.rank}. ${entry.title} (${entry.author})`);
      continue;
    }
    let slug = slugify(cleanTitle(doc.title));
    if (slugs.has(slug)) slug = `${slug}-${slugify(primaryAuthor(doc).split(' ').pop())}`;
    if (slugs.has(slug)) slug = `${slug}-${doc.release_year}`;
    slugs.add(slug);
    isbns.add(englishIsbn(doc));
    light.push({
      s: slug,
      t: cleanTitle(doc.title),
      a: primaryAuthor(doc),
      y: doc.release_year ?? Number(list.updated.slice(0, 4)),
      i: englishIsbn(doc),
      ...(doc.pages ? { p: doc.pages } : {}),
      g: ourGenres(doc.genres ?? []),
      m: [...new Set((doc.moods ?? []).map((m) => String(m).toLowerCase()))].slice(0, 5),
      ...(doc.rating && (doc.ratings_count ?? 0) >= 20
        ? { r: Math.round(doc.rating * 10) / 10, n: doc.ratings_count }
        : {}),
      u: doc.users_count ?? 0,
    });
    added++;
    console.log(`added   ${entry.rank}. ${entry.title}`);
  }
}

writeFileSync(lightFile, `${JSON.stringify(light)}\n`);
console.log(`\n${added} added to data/light/books.json.`);
if (missing.length)
  console.log(`Not found on Hardcover (${missing.length}):\n  ${missing.join('\n  ')}`);
