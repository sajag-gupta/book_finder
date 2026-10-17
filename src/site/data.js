import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import Ajv from 'ajv';
import { isValidIsbn13 } from '../shared/isbn.js';
import { validateIssue } from '../email/issue.js';

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));
const readDir = (dir) =>
  readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({ name, value: readJson(join(dir, name)) }));

/**
 * Which books a build publishes: `reviewed` (a person read it) and `checked` (facts verified
 * against two public sources, text not yet read by a person; pages carry a notice). Drafts only
 * appear in preview builds.
 */
export const isPublished = (book, includeDrafts = false) =>
  includeDrafts || book.status === 'reviewed' || book.status === 'checked';

/** Loads every editorial file from `root` (the repository root). */
export function loadData(root) {
  const data = join(root, 'data');
  const vocab = (file) => readJson(join(data, 'vocab', file));
  return {
    genres: vocab('genres.json'),
    moods: vocab('moods.json'),
    tropes: vocab('tropes.json'),
    warnings: vocab('warnings.json'),
    feelings: vocab('feelings.json'),
    series: readDir(join(data, 'series')).map(({ value }) => value),
    books: readDir(join(data, 'books')).map(({ name, value }) => ({ ...value, _file: name })),
    schema: readJson(join(data, 'schema', 'book.schema.json')),
    offers: loadOffers(join(data, 'offers')),
    hardcover: existsSync(join(data, 'hardcover.json'))
      ? readJson(join(data, 'hardcover.json'))
      : null,
    trending: existsSync(join(data, 'trending.json'))
      ? readJson(join(data, 'trending.json'))
      : null,
    issues: existsSync(join(data, 'newsletter'))
      ? readDir(join(data, 'newsletter')).map(({ name, value }) => ({ ...value, _file: name }))
      : [],
  };
}

/** Optional price feeds: data/offers/<isbn13>.json = [{store, price, shipping?, currency, checkedAt}] */
function loadOffers(dir) {
  if (!existsSync(dir)) return {};
  return Object.fromEntries(
    readDir(dir).map(({ name, value }) => [name.replace(/\.json$/, ''), value]),
  );
}

/** Returns a list of human-readable problems; empty means the data set is consistent. */
export function validateData(data) {
  const errors = [];
  const ajv = new Ajv({ allErrors: true, strict: false, validateFormats: false });
  const validate = ajv.compile(data.schema);

  const genres = new Set(data.genres.map((g) => g.slug));
  const moods = new Set(data.moods.map((m) => m.slug));
  const tropes = new Set(data.tropes.map((t) => t.slug));
  const warnings = new Set(data.warnings.map((w) => w.slug));
  const series = new Set(data.series.map((s) => s.slug));
  for (const feeling of data.feelings ?? []) {
    for (const want of feeling.wants) {
      if (!moods.has(want.mood))
        errors.push(`vocab/feelings.json: "${feeling.slug}" points to unknown mood "${want.mood}"`);
    }
  }
  const slugs = new Set(data.books.map((b) => b.slug));
  const seenIsbn = new Map();

  for (const book of data.books) {
    const at = `books/${book._file}`;
    const { _file, ...record } = book;
    if (!validate(record)) {
      for (const e of validate.errors) errors.push(`${at}: ${e.instancePath || '/'} ${e.message}`);
      continue;
    }
    if (`${book.slug}.json` !== _file) errors.push(`${at}: slug must match the file name`);
    if (!isValidIsbn13(book.isbn13)) errors.push(`${at}: invalid ISBN-13 check digit`);
    if (seenIsbn.has(book.isbn13))
      errors.push(`${at}: duplicate ISBN with ${seenIsbn.get(book.isbn13)}`);
    seenIsbn.set(book.isbn13, book.slug);

    for (const m of book.moods) if (!moods.has(m)) errors.push(`${at}: unknown mood "${m}"`);
    for (const t of book.tropes) if (!tropes.has(t)) errors.push(`${at}: unknown trope "${t}"`);
    for (const w of book.warnings)
      if (!warnings.has(w)) errors.push(`${at}: unknown warning "${w}"`);
    if (book.series && !series.has(book.series.slug)) {
      errors.push(`${at}: unknown series "${book.series.slug}"`);
    }
    for (const p of book.pairings ?? []) {
      if (!slugs.has(p.slug)) errors.push(`${at}: pairing points to unknown book "${p.slug}"`);
      if (p.slug === book.slug) errors.push(`${at}: a book cannot pair with itself`);
    }
    for (const g of book.genres) if (!genres.has(g)) errors.push(`${at}: unknown genre "${g}"`);
    if (book.status === 'reviewed') {
      if ((book.sources ?? []).length < 2)
        errors.push(`${at}: reviewed books need at least two sources`);
      if (!book.reviewedBy || !book.reviewedOn)
        errors.push(`${at}: reviewed books need reviewedBy and reviewedOn`);
    }
    if (book.status === 'checked') {
      if ((book.sources ?? []).length < 2)
        errors.push(`${at}: checked books need at least two sources`);
      if (!book.checkedOn) errors.push(`${at}: checked books need checkedOn`);
    }
  }

  const reviewed = new Set(data.books.filter((b) => b.status === 'reviewed').map((b) => b.slug));
  for (const issue of data.issues ?? []) {
    const { _file, ...record } = issue;
    for (const problem of validateIssue(record, reviewed)) {
      errors.push(`newsletter/${_file}: ${problem}`);
    }
    if (_file !== `${record.date}.json`)
      errors.push(`newsletter/${_file}: file name must be <date>.json`);
  }
  return errors;
}
