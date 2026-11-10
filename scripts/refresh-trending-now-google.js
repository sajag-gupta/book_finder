/**
 * Second pass for refresh-trending-now.js: books Hardcover does not list yet (very new releases) are
 * looked up in Google Books (GOOGLE_BOOKS_KEY in .env) and added to data/light/books.json when a
 * volume with a valid ISBN-13 and a matching title and author is found.
 *
 *   npm run trending:now:google
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { isValidIsbn13 } from '../src/shared/isbn.js';
import { slugify } from '../src/shared/slug.js';
import { sameBook } from '../src/shared/hardcover.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const key = process.env.GOOGLE_BOOKS_KEY;
if (!key) {
  console.error('Set GOOGLE_BOOKS_KEY in .env first.');
  process.exit(1);
}
const read = (...p) => JSON.parse(readFileSync(join(root, ...p), 'utf8'));
const list = read('data', 'trending-now.json');
const lightFile = join(root, 'data', 'light', 'books.json');
const books = readdirSync(join(root, 'data', 'books'))
  .filter((f) => f.endsWith('.json'))
  .map((f) => read('data', 'books', f));
const written = (entry) => books.some((b) => sameBook(b, entry));
// A written page always wins, so a facts-only listing for the same book is dropped.
const light = (existsSync(lightFile) ? read('data', 'light', 'books.json') : []).filter(
  (b) => !written({ title: b.t, author: b.a }),
);
const known = (entry) =>
  written(entry) || light.some((b) => sameBook({ title: b.t, author: b.a }, entry));
const slugs = new Set(light.map((b) => b.s));
const isbns = new Set(light.map((b) => b.i));

async function search(query) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(query)}&maxResults=10&printType=books&langRestrict=en&key=${key}`,
    );
    if (r.status === 429) {
      await sleep(5000 * (attempt + 1));
      continue;
    }
    return r.ok ? ((await r.json()).items ?? []) : [];
  }
  return [];
}

let added = 0;
const missing = [];
for (const group of list.groups) {
  for (const entry of group.books) {
    // Books already on the site (written records are checked by refresh-trending-now.js) are skipped.
    if (known(entry)) continue;
    const items = await search(`${entry.title} ${entry.author}`);
    await sleep(600);
    const hit = items
      .map((item) => ({
        item,
        isbn: (item.volumeInfo?.industryIdentifiers ?? []).find(
          (id) => id.type === 'ISBN_13' && isValidIsbn13(id.identifier),
        )?.identifier,
      }))
      .find(
        ({ item, isbn }) =>
          isbn &&
          sameBook(
            { title: item.volumeInfo.title, author: item.volumeInfo.authors?.[0] ?? '' },
            { title: entry.title, author: entry.author },
          ),
      );
    if (!hit || isbns.has(hit.isbn)) {
      missing.push(`${entry.rank}. ${entry.title}`);
      continue;
    }
    const info = hit.item.volumeInfo;
    let slug = slugify(entry.title);
    if (slugs.has(slug)) slug = `${slug}-${slugify(entry.author.split(' ').pop())}`;
    slugs.add(slug);
    isbns.add(hit.isbn);
    light.push({
      s: slug,
      t: entry.title,
      a: info.authors?.[0] ?? entry.author,
      y: Number(String(info.publishedDate ?? list.updated).slice(0, 4)),
      i: hit.isbn,
      ...(info.pageCount ? { p: info.pageCount } : {}),
      g: [],
      m: [],
      u: 0,
    });
    added++;
    console.log(`added   ${entry.rank}. ${entry.title}`);
  }
}
writeFileSync(lightFile, `${JSON.stringify(light)}\n`);
console.log(`\n${added} added.`);
if (missing.length) console.log(`Still not found (${missing.length}):\n  ${missing.join('\n  ')}`);
