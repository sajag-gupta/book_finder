/**
 * Checks batch files of drafted editorial records before they are merged into data/books.
 *
 *   node scripts/validate-drafts.js .work/records/part-a-1.json [more files...]
 *
 * Verifies every field against the vocabulary and length limits, and that pairings point at books in
 * data/catalogue/catalogue.json. Exits non-zero and lists every problem.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { slugify } from '../src/shared/slug.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const json = (...p) => JSON.parse(readFileSync(join(root, ...p), 'utf8'));
const vocab = (f) => new Set(json('data', 'vocab', f).map((x) => x.slug));
const [moods, tropes, warnings] = ['moods.json', 'tropes.json', 'warnings.json'].map(vocab);
const genres = vocab('genres.json');
const slugs = new Set(
  json('data', 'catalogue', 'catalogue.json').map((b) => b.slug ?? slugify(b.title)),
);

const between = (s, lo, hi) => typeof s === 'string' && s.length >= lo && s.length <= hi;
const errors = [];

for (const file of process.argv.slice(2)) {
  let records;
  try {
    records = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    errors.push(`${file}: not valid JSON (${error.message})`);
    continue;
  }
  for (const r of records) {
    const at = `${file} ${r.slug}`;
    const bad = (msg) => errors.push(`${at}: ${msg}`);
    if (!slugs.has(r.slug)) bad('slug is not in the catalogue');
    if (r.skip === true) continue; // the drafter did not know this book well enough
    if (!['slow', 'medium', 'fast'].includes(r.pace)) bad(`pace "${r.pace}"`);
    if (r.length !== undefined && !['short', 'medium', 'long'].includes(r.length))
      bad(`length "${r.length}"`);
    if (!Array.isArray(r.genres) || r.genres.length < 1 || r.genres.length > 3)
      bad('needs 1-3 genres');
    for (const g of r.genres ?? []) if (!genres.has(g)) bad(`unknown genre "${g}"`);
    if (!Array.isArray(r.moods) || r.moods.length < 1 || r.moods.length > 4) bad('needs 1-4 moods');
    for (const m of r.moods ?? []) if (!moods.has(m)) bad(`unknown mood "${m}"`);
    for (const t of r.tropes ?? []) if (!tropes.has(t)) bad(`unknown trope "${t}"`);
    for (const w of r.warnings ?? []) if (!warnings.has(w)) bad(`unknown warning "${w}"`);
    for (const key of ['moods', 'tropes', 'warnings']) {
      if (new Set(r[key]).size !== (r[key] ?? []).length) bad(`duplicate in ${key}`);
    }
    if (!between(r.summary, 40, 400)) bad(`summary length ${r.summary?.length}`);
    if ((r.tropes ?? []).length > 3) bad('at most 3 tropes');
    if ((r.warnings ?? []).length > 8) bad('at most 8 warnings');
    if (!between(r.readIf, 15, 200)) bad(`readIf length ${r.readIf?.length}`);
    if (!between(r.skipIf, 15, 200)) bad(`skipIf length ${r.skipIf?.length}`);
    if (r.pairings !== undefined && (!Array.isArray(r.pairings) || r.pairings.length > 3)) {
      bad('pairings, when given, are a list of at most 3');
    }
    for (const p of r.pairings ?? []) {
      if (!slugs.has(p.slug)) bad(`pairing "${p.slug}" is not in the catalogue`);
      if (p.slug === r.slug) bad('pairs with itself');
      if (!between(p.reason, 25, 300)) bad(`pairing reason length for ${p.slug}`);
      if (!['similar', 'lighter', 'darker', 'quieter', 'bigger'].includes(p.moodShift)) {
        bad(`moodShift "${p.moodShift}"`);
      }
    }
  }
}

if (errors.length) {
  console.error(`${errors.length} problem(s):\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}
console.log('Batch files OK.');
