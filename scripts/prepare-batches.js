/**
 * Splits the catalogue entries that still lack an editorial record into batch files for drafting.
 *
 *   node scripts/prepare-batches.js [--size=60]
 *
 * Writes .work/batches/in-001.json ... (what to write about) and .work/batches/VOCAB.md (the allowed
 * genres, moods, tropes and content warnings). Records come back as .work/records/new-001.json ...
 * and are checked with scripts/validate-drafts.js. Each input row carries only facts: title, author,
 * year, ISBN, page count, series, and Hardcover's aggregate moods and reader-reported warnings.
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify } from '../src/shared/slug.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const size = Number(process.argv.find((a) => a.startsWith('--size='))?.split('=')[1] ?? 60);
const json = (...p) => JSON.parse(readFileSync(join(root, ...p), 'utf8'));
const out = join(root, '.work', 'batches');
const records = join(root, '.work', 'records');
mkdirSync(out, { recursive: true });
mkdirSync(records, { recursive: true });

const catalogue = json('data', 'catalogue', 'catalogue.json');
const hardcover = {
  ...(existsSync(join(root, 'data', 'hardcover.json')) ? json('data', 'hardcover.json').books : {}),
  ...(existsSync(join(root, '.work', 'hardcover-new.json'))
    ? json('.work', 'hardcover-new.json')
    : {}),
};
const done = new Set();
for (const f of readdirSync(records).filter((f) => f.endsWith('.json'))) {
  for (const r of json('.work', 'records', f)) done.add(r.slug);
}
const hasBook = (slug) => existsSync(join(root, 'data', 'books', `${slug}.json`));

const todo = catalogue
  .map((b) => ({ ...b, slug: b.slug ?? slugify(b.title) }))
  .filter((b) => b.isbn13 && !hasBook(b.slug) && !done.has(b.slug));

const rows = todo.map((b) => {
  const h = hardcover[b.slug];
  return {
    slug: b.slug,
    title: b.title,
    author: b.author,
    year: b.year,
    kind: b.kind ?? 'fiction',
    genreHint: b.genreHint ?? '',
    pages: h?.pages ?? null,
    series: h?.series ?? null,
    readers: h?.usersCount ?? null,
    hardcoverMoods: h?.moods ?? [],
    hardcoverContentWarnings: h?.contentWarnings ?? [],
  };
});

let n = 0;
for (let i = 0; i < rows.length; i += size) {
  n++;
  writeFileSync(
    join(out, `in-${String(n).padStart(3, '0')}.json`),
    `${JSON.stringify(rows.slice(i, i + size), null, 1)}\n`,
  );
}

const list = (file, line) => json('data', 'vocab', file).map(line).join('\n');
writeFileSync(
  join(out, 'VOCAB.md'),
  `# Allowed values

## genres (pick 1 to 3; first is the main one)
${list('genres.json', (g) => `- ${g.slug}: ${g.name} (${g.group ?? 'fiction'})`)}

## moods (pick 1 to 4)
${list('moods.json', (m) => `- ${m.slug}: ${m.blurb}`)}

## tropes (fiction only, 0 to 3, only ones that clearly apply)
${list('tropes.json', (t) => `- ${t.slug}: ${t.name}`)}

## content warnings (0 to 8, only ones that clearly apply)
${list('warnings.json', (w) => `- ${w.slug}: ${w.name}`)}
`,
);
console.log(`${rows.length} books to draft in ${n} batches of up to ${size} -> .work/batches/`);
