/**
 * Builds the "light" listings: facts-only entries for the most-read books we have not written about.
 *
 *   node scripts/build-light.js [--max=9000] [--min-ratings=30]
 *
 * Reads the cached Hardcover top list (.work/hardcover-top.json, from build-candidates.js
 * --fetch-only), drops anything already in the catalogue, and writes data/light/books.json. Entries
 * hold only facts: title, author, year, ISBN, page count, our genre labels where Hardcover's tags map
 * cleanly, Hardcover's reader-reported mood words, and rating counts. No text of any kind is copied.
 * Light pages are noindex, stay out of the sitemap, and upgrade to full records when one is written.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isValidIsbn13 } from '../src/shared/isbn.js';
import { slugify } from '../src/shared/slug.js';
import { cleanTitle, ourGenres, primaryAuthor, sameBook } from '../src/shared/hardcover.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const flag = (name, fallback) =>
  Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const max = flag('max', 9000);
const minRatings = flag('min-ratings', 30);

const read = (...p) => JSON.parse(readFileSync(join(root, ...p), 'utf8'));
const docs = read('.work', 'hardcover-top.json');
const catalogue = read('data', 'catalogue', 'catalogue.json');
const bookSlugs = new Set(catalogue.map((b) => b.slug ?? slugify(b.title)));

const NOISE =
  /box(ed)? set|books? set|collection|omnibus|bundle|study guide|summary of|summary and|analysis of|workbook|journal|coloring|colouring|calendar|sampler|\bvolumes? \d|books? \d|complete (works|series|novels)|trilogy|the complete|illustrated edition|special edition|anniversary edition|deluxe/i;

const compact = (t) =>
  String(t ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/^the /, '')
    .replace(/[^a-z0-9]+/g, '');
const keys = (title) => [...new Set([compact(title), compact(title.split(':')[0])])];
const have = new Map();
for (const b of catalogue) {
  for (const k of keys(cleanTitle(b.title))) have.set(k, [...(have.get(k) ?? []), b]);
}
const known = (title, author) =>
  keys(title).some((k) => (have.get(k) ?? []).some((b) => sameBook(b, { title, author })));

const englishIsbn = (doc) =>
  (doc.isbns ?? []).find((i) => /^97[89][01]\d{9}$/.test(i) && isValidIsbn13(i));

const out = [];
const usedSlugs = new Set(bookSlugs);
const usedIsbn = new Set(catalogue.map((b) => b.isbn13).filter(Boolean));
for (const doc of docs.sort((a, b) => (b.users_count ?? 0) - (a.users_count ?? 0))) {
  if (out.length >= max) break;
  const title = cleanTitle(doc.title ?? '');
  const author = primaryAuthor(doc);
  const isbn = englishIsbn(doc);
  if (!title || !author || !isbn || doc.compilation || NOISE.test(doc.title)) continue;
  if ((doc.ratings_count ?? 0) < minRatings || (doc.release_year ?? 0) < 1000) continue;
  if (usedIsbn.has(isbn) || known(title, author)) continue;
  let slug = slugify(title);
  if (!slug) continue;
  if (usedSlugs.has(slug)) slug = `${slug}-${slugify(author.split(' ').pop())}`;
  if (usedSlugs.has(slug)) slug = `${slug}-${doc.release_year}`;
  if (usedSlugs.has(slug)) continue;
  usedSlugs.add(slug);
  usedIsbn.add(isbn);
  const series = doc.featured_series?.series?.name;
  out.push({
    s: slug,
    t: title,
    a: author,
    y: doc.release_year,
    i: isbn,
    ...(doc.pages ? { p: doc.pages } : {}),
    g: ourGenres(doc.genres ?? []),
    m: [...new Set((doc.moods ?? []).map((m) => String(m).toLowerCase()))].slice(0, 5),
    ...(doc.rating && (doc.ratings_count ?? 0) >= 20
      ? { r: Math.round(doc.rating * 10) / 10, n: doc.ratings_count }
      : {}),
    u: doc.users_count ?? 0,
    ...(series ? { sr: series } : {}),
  });
}

mkdirSync(join(root, 'data', 'light'), { recursive: true });
writeFileSync(join(root, 'data', 'light', 'books.json'), `${JSON.stringify(out)}\n`);
const withGenre = out.filter((b) => b.g.length).length;
console.log(
  `Wrote ${out.length} light listings (${withGenre} with a mapped genre) to data/light/books.json`,
);
if (!existsSync(join(root, 'data', 'light', 'books.json'))) process.exit(1);
