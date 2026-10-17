/**
 * Finds a working cover image for every book and records it in data/covers.json, so pages link to
 * a cover that is known to exist instead of guessing by ISBN in the visitor's browser.
 *
 *   npm run covers            only books without an entry yet (resumable)
 *   npm run covers -- --retry  also retry books recorded as having no cover
 *
 * Order of attempts per book:
 *   1. Open Library by ISBN (one batched call per 80 books, returns the cover id)
 *   2. Open Library by title and author (finds another edition's cover)
 *   3. Google Books by ISBN, then by title and author (needs GOOGLE_BOOKS_KEY for volume)
 * Open Library covers are served by id (not rate limited); Google covers by volume id. Pages still
 * fall back to a generated typographic cover when nothing is found.
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

const root = fileURLToPath(new URL('..', import.meta.url));
const out = join(root, 'data', 'covers.json');
const retry = process.argv.includes('--retry');
const recheck = process.argv.includes('--recheck-google');
const contact = process.env.OL_CONTACT || 'book-finder';
const gKey = process.env.GOOGLE_BOOKS_KEY;
const UA = { 'User-Agent': `BookFinder/0.1 (${contact})` };

const books = readdirSync(join(root, 'data', 'books'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(join(root, 'data', 'books', f), 'utf8')));
const covers = existsSync(out) ? JSON.parse(readFileSync(out, 'utf8')) : {};
const save = () =>
  writeFileSync(out, `${JSON.stringify(covers, null, 0).replace(/,"/g, ',\n"')}\n`);

async function getJson(url, headers = UA) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, { headers, signal: AbortSignal.timeout(15000) });
      if (response.status === 429 || response.status >= 500) {
        await sleep(4000 * (attempt + 1));
        continue;
      }
      if (!response.ok) return null;
      return await response.json();
    } catch {
      await sleep(2000 * (attempt + 1));
    }
  }
  return null;
}

/** A cover id is only useful if the image really exists and is not a 1x1 placeholder. */
async function olImageOk(id) {
  try {
    const response = await fetch(`https://covers.openlibrary.org/b/id/${id}-M.jpg?default=false`, {
      method: 'HEAD',
      headers: UA,
      signal: AbortSignal.timeout(10000),
    });
    return response.ok && Number(response.headers.get('content-length') ?? 1000) > 1500;
  } catch {
    return false;
  }
}

/** Runs `fn` over `items` with at most `size` in flight; a slow host then costs seconds, not hours. */
async function pool(items, size, fn) {
  let next = 0;
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < items.length) await fn(items[next++]);
    }),
  );
}

const norm = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
const lastName = (author) => author.trim().split(/\s+/).pop();
const NOT_A_SINGLE_BOOK =
  /collection|box(ed)? set|books set|trilogy|omnibus|illustrated|bundle|series/i;

const todo = books.filter((b) => !(b.isbn13 in covers) || (retry && covers[b.isbn13] === null));
console.log(`${todo.length} of ${books.length} books need a cover lookup`);

// 1. Open Library, batched by ISBN.
for (let i = 0; i < todo.length; i += 80) {
  const batch = todo.slice(i, i + 80);
  const keys = batch.map((b) => `ISBN:${b.isbn13}`).join(',');
  const data = await getJson(
    `https://openlibrary.org/api/books?bibkeys=${keys}&jscmd=data&format=json`,
  );
  await pool(batch, 8, async (book) => {
    const url = data?.[`ISBN:${book.isbn13}`]?.cover?.medium;
    const id = url?.match(/\/id\/(\d+)-/)?.[1];
    if (id && (await olImageOk(id))) covers[book.isbn13] = { ol: Number(id) };
  });
  save();
  console.log(`open library by isbn: ${Math.min(i + 80, todo.length)}/${todo.length}`);
  await sleep(1000);
}

// Google covers found by title are only kept if the volume matches the book, so re-check them.
if (recheck && gKey) {
  const entries = books.filter((b) => covers[b.isbn13]?.gb);
  console.log(`re-checking ${entries.length} Google covers`);
  await pool(entries, 4, async (book) => {
    const g = await getJson(
      `https://www.googleapis.com/books/v1/volumes/${covers[book.isbn13].gb}?fields=volumeInfo(title,authors)&key=${gKey}`,
    );
    if (!g) return; // lookup failed (rate limit): keep the entry rather than guess
    const info = g.volumeInfo ?? {};
    const ok =
      norm(info.title ?? '').includes(norm(book.title)) &&
      !NOT_A_SINGLE_BOOK.test(info.title ?? '') &&
      (info.authors ?? []).some((name) => norm(name).includes(norm(lastName(book.author))));
    if (!ok) delete covers[book.isbn13];
  });
  save();
}

// 2 and 3. One book at a time for whatever is still missing.
const missing = books.filter((b) => !(b.isbn13 in covers) || (retry && covers[b.isbn13] === null));
console.log(`${missing.length} still missing, trying title searches`);
let n = 0;
await pool(missing, 4, async (book) => {
  const q = new URLSearchParams({
    title: book.title,
    author: book.author,
    fields: 'cover_i',
    limit: '5',
    lang: 'eng',
  });
  const found = await getJson(`https://openlibrary.org/search.json?${q}`);
  const id = found?.docs?.find((d) => d.cover_i)?.cover_i;
  if (id && (await olImageOk(id))) {
    covers[book.isbn13] = { ol: id };
  } else if (gKey) {
    const g = await getJson(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(`${book.title} ${book.author}`)}&maxResults=8&printType=books&langRestrict=en&fields=items(id,volumeInfo(title,authors,imageLinks))&key=${gKey}`,
    );
    const hit = g?.items?.find((item) => {
      const info = item.volumeInfo ?? {};
      return (
        info.imageLinks?.thumbnail &&
        norm(info.title ?? '').includes(norm(book.title)) &&
        !NOT_A_SINGLE_BOOK.test(info.title ?? '') &&
        (info.authors ?? []).some((name) => norm(name).includes(norm(lastName(book.author))))
      );
    });
    if (hit) covers[book.isbn13] = { gb: hit.id };
  }
  if (!covers[book.isbn13]) covers[book.isbn13] = null;
  if (++n % 20 === 0) {
    save();
    console.log(`${n}/${missing.length}`);
  }
  await sleep(300);
});
save();
const have = books.filter((b) => covers[b.isbn13]).length;
console.log(
  `Done: ${have} of ${books.length} books have a cover (${books.length - have} use the generated cover).`,
);
