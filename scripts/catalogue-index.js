/**
 * Writes .work/catalogue-index.txt: one line per catalogue book (slug, title, author, year, genres).
 * It is the reference list used when drafting editorial records, so "if you loved X" pairings can
 * only point at books that exist.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify } from '../src/shared/slug.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const catalogue = JSON.parse(
  readFileSync(join(root, 'data', 'catalogue', 'catalogue.json'), 'utf8'),
);

const seen = new Map();
const lines = catalogue.map((b, i) => {
  const slug = b.slug ?? slugify(b.title);
  if (seen.has(slug)) throw new Error(`Duplicate slug "${slug}": ${b.title} and ${seen.get(slug)}`);
  seen.set(slug, b.title);
  return `${String(i + 1).padStart(3, '0')} | ${slug} | ${b.title} | ${b.author} | ${b.year} | ${b.genres.join(',')}`;
});

mkdirSync(join(root, '.work'), { recursive: true });
writeFileSync(join(root, '.work', 'catalogue-index.txt'), `${lines.join('\n')}\n`);
console.log(`Wrote .work/catalogue-index.txt (${lines.length} books)`);
