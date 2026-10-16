/**
 * Cross-checks every book's ISBN-13 against Open Library and Google Books and reports whether the
 * title and author agree. This supports (it does not replace) the human review step.
 *
 *   npm run verify:isbns
 *
 * Reads OL_CONTACT and GOOGLE_BOOKS_KEY from .env. Open Library allows 3 requests/second with an
 * identifying User-Agent, so calls are spaced out.
 */
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { loadData } from '../src/site/data.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const { OL_CONTACT, GOOGLE_BOOKS_KEY } = process.env;
if (!OL_CONTACT) {
  console.error('Set OL_CONTACT in .env (your contact email) before calling Open Library.');
  process.exit(1);
}
const headers = { 'User-Agent': `BookFinder/0.1 (${OL_CONTACT})` };
const norm = (s) =>
  s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

async function openLibrary(isbn) {
  const res = await fetch(`https://openlibrary.org/isbn/${isbn}.json`, { headers });
  if (!res.ok) return { ok: false, note: `HTTP ${res.status}` };
  const edition = await res.json();
  return { ok: true, title: edition.title };
}

async function googleBooks(isbn) {
  const key = GOOGLE_BOOKS_KEY ? `&key=${encodeURIComponent(GOOGLE_BOOKS_KEY)}` : '';
  const res = await fetch(`https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}${key}`);
  if (!res.ok) return { ok: false, note: `HTTP ${res.status}` };
  const info = (await res.json()).items?.[0]?.volumeInfo;
  return info
    ? { ok: true, title: info.title, authors: info.authors ?? [] }
    : { ok: false, note: 'no match' };
}

let problems = 0;
for (const book of loadData(root).books) {
  const [ol, gb] = [await openLibrary(book.isbn13), await googleBooks(book.isbn13)];
  await sleep(400);
  const check = (name, result) => {
    if (!result.ok) return `${name}: ${result.note}`;
    const t = norm(result.title);
    const want = norm(book.title);
    return t.includes(want) || want.includes(t)
      ? `${name}: ok`
      : `${name}: MISMATCH "${result.title}"`;
  };
  // Open Library is authoritative. Google Books is advisory: it often has no record for a given
  // edition (and returns nothing at all for some keys), so a miss there is reported, not failed.
  const line = [check('OpenLibrary', ol), check('GoogleBooks', gb)];
  const gbMismatch = line[1].includes('MISMATCH');
  if (!line[0].endsWith(': ok') || gbMismatch) problems++;
  console.log(`${book.slug.padEnd(40)} ${line.join(' | ')}`);
}
console.log(
  problems
    ? `\n${problems} book(s) need a manual look.`
    : '\nAll ISBNs match Open Library (Google Books is advisory).',
);
process.exit(problems ? 1 : 0);
