/**
 * Builds data/books/<slug>.json for every catalogue book that has a drafted editorial record and a
 * resolved ISBN. Existing book files are never overwritten (apart from adding sales fields), so
 * reviewed records stay exactly as a person approved them.
 *
 *   node scripts/merge-catalogue.js [drafts-dir]     default drafts dir: .work/records
 *
 * New records start as status "draft"; `npm run review -- --mark-checked` promotes the ones whose
 * facts verify against two public sources.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';
import { isValidIsbn13 } from '../src/shared/isbn.js';
import { slugify } from '../src/shared/slug.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const draftsDir = process.argv[2] ?? join(root, '.work', 'records');
const read = (...p) => JSON.parse(readFileSync(join(root, ...p), 'utf8'));
const prettierConfig = read('.prettierrc.json');
const save = async (path, value) =>
  writeFileSync(path, await format(JSON.stringify(value), { parser: 'json', ...prettierConfig }));

const drafts = new Map(
  readdirSync(draftsDir)
    .filter((f) => f.endsWith('.json'))
    .flatMap((f) => JSON.parse(readFileSync(join(draftsDir, f), 'utf8')))
    .map((r) => [r.slug, r]),
);

const created = [];
const updated = [];
const skipped = [];
for (const entry of read('data', 'catalogue', 'catalogue.json')) {
  const slug = slugify(entry.title);
  const path = join(root, 'data', 'books', `${slug}.json`);

  if (existsSync(path)) {
    // Keep the reviewed text untouched; only attach the sales fields from the catalogue.
    const book = JSON.parse(readFileSync(path, 'utf8'));
    const next = { ...book, soldMillions: entry.soldMillions ?? null, tier: entry.group };
    if (JSON.stringify(next) !== JSON.stringify(book)) {
      await save(path, next);
      updated.push(slug);
    }
    continue;
  }

  const draft = drafts.get(slug);
  if (!draft) {
    skipped.push(`${slug}: no drafted record`);
    continue;
  }
  if (!entry.isbn13 || !isValidIsbn13(entry.isbn13)) {
    skipped.push(`${slug}: no valid ISBN`);
    continue;
  }
  await save(path, {
    slug,
    title: entry.title,
    author: entry.author,
    isbn13: entry.isbn13,
    firstPublished: entry.year,
    series: null,
    genres: entry.genres,
    pace: draft.pace,
    length: draft.length,
    moods: draft.moods,
    tropes: draft.tropes,
    warnings: draft.warnings,
    summary: draft.summary,
    readIf: draft.readIf,
    skipIf: draft.skipIf,
    pairings: draft.pairings,
    soldMillions: entry.soldMillions ?? null,
    tier: entry.group,
    sources: [],
    status: 'draft',
    checkedOn: null,
    reviewedBy: null,
    reviewedOn: null,
  });
  created.push(slug);
}

console.log(`created ${created.length}, updated ${updated.length}, skipped ${skipped.length}`);
for (const line of skipped) console.log(`  skipped ${line}`);
