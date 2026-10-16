/**
 * Resolves an ISBN-13 for every entry in data/catalogue/catalogue.json that lacks one.
 *
 *   npm run catalogue:isbns
 *
 * For each book it searches Open Library by title and author, then keeps the first candidate ISBN-13
 * that (a) has a valid check digit and (b) belongs to an Open Library edition whose title matches.
 * Resumable: progress is saved every few books, and entries already resolved are skipped.
 * Needs OL_CONTACT in .env (Open Library asks callers to identify themselves).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { isValidIsbn13 } from '../src/shared/isbn.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const file = join(root, 'data', 'catalogue', 'catalogue.json');
const { OL_CONTACT } = process.env;
if (!OL_CONTACT) {
  console.error('Set OL_CONTACT in .env first.');
  process.exit(1);
}
const headers = { 'User-Agent': `BookFinder/0.1 (${OL_CONTACT})` };
const enc = encodeURIComponent;
const norm = (s) =>
  String(s)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

async function getJson(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers });
      await sleep(350); // inside Open Library's 3 requests/second
      if (response.ok) return await response.json();
      if (response.status !== 429 && response.status < 500) return null;
    } catch {
      // network hiccup: retry
    }
    await sleep(2000 * (attempt + 1));
  }
  return null;
}

const titleMatches = (a, b) => {
  const [x, y] = [norm(a), norm(b)];
  return x.includes(y) || y.includes(x);
};

async function resolve(book) {
  const main = norm(book.title.split(':')[0]);
  const query = `title=${enc(book.title.split(':')[0])}&author=${enc(book.author.split(' and ')[0])}`;
  const search = await getJson(
    `https://openlibrary.org/search.json?${query}&fields=title,isbn&limit=3&language=eng`,
  );
  const candidates = [];
  for (const doc of search?.docs ?? []) {
    if (!titleMatches(doc.title, main)) continue;
    for (const isbn of doc.isbn ?? []) {
      // 978-0 / 978-1 are English-language registrant groups, the best fit for the stores we link.
      if (/^97[89]\d{10}$/.test(isbn) && isValidIsbn13(isbn)) candidates.push(isbn);
    }
  }
  const english = candidates.filter((i) => i.startsWith('9780') || i.startsWith('9781'));
  for (const isbn of [...new Set([...english, ...candidates])].slice(0, 6)) {
    const edition = await getJson(`https://openlibrary.org/isbn/${isbn}.json`);
    if (edition?.title && titleMatches(edition.title, main)) return isbn;
  }
  return null;
}

const catalogue = JSON.parse(readFileSync(file, 'utf8'));
const todo = catalogue.filter((b) => b.isbn13 === undefined);
console.log(`${todo.length} of ${catalogue.length} need an ISBN`);

let done = 0;
for (const book of todo) {
  book.isbn13 = await resolve(book);
  done++;
  console.log(
    `${String(done).padStart(3)}/${todo.length} ${book.isbn13 ?? 'NOT FOUND'} ${book.title}`,
  );
  if (done % 10 === 0) writeFileSync(file, JSON.stringify(catalogue, null, 1));
}
writeFileSync(file, JSON.stringify(catalogue, null, 1));
const missing = catalogue.filter((b) => !b.isbn13);
console.log(`Done. ${missing.length} without an ISBN.`);
