/**
 * Builds the list of books to add to the catalogue from several sources, ranks them, and writes the
 * winners to data/catalogue/catalogue.json (as entries with an ISBN, ready for editorial drafting).
 *
 *   node --env-file-if-exists=.env scripts/build-candidates.js [--target=5000] [--pages=360] [--nonfiction=1500]
 *
 * Sources
 *  1. Research files in .work/research/*.json (best-seller lists, awards, canon lists, top authors;
 *     collected by hand from public pages: title, author, year, which list).
 *  2. Hardcover's most-read books across every genre (API, aggregate facts only).
 * Every candidate must resolve to a Hardcover record with an English-registrant ISBN-13 (the same
 * ISBN is verified later against Open Library). Score = readers (log) + number of independent lists
 * + author rank + sales estimate, so a book on three lists beats one with only a big reader count.
 *
 * Aggregate Hardcover facts for each winner are saved to .work/hardcover-new.json so the enrich step
 * does not have to ask again. Nothing but facts (title, author, year, ISBN, counts) is kept.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { searchBooks } from './hardcover-client.js';
import { isValidIsbn13 } from '../src/shared/isbn.js';
import { slugify } from '../src/shared/slug.js';
import { cleanTitle, primaryAuthor, sameBook, summarise } from '../src/shared/hardcover.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const flag = (name, fallback) =>
  Number(process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);
const target = flag('target', 5000);
const maxPages = flag('pages', 360);
const nonfictionWanted = flag('nonfiction', 1500);

const catalogueFile = join(root, 'data', 'catalogue', 'catalogue.json');
const catalogue = JSON.parse(readFileSync(catalogueFile, 'utf8'));
const have = [...catalogue];

const NOISE =
  /box(ed)? set|books? set|collection|omnibus|bundle|study guide|summary of|summary and|analysis of|workbook|journal|coloring|colouring|calendar|sampler|\bvolumes? \d|books? \d|complete (works|series|novels)|trilogy|the complete|illustrated edition|special edition|anniversary edition|deluxe/i;
const NONFICTION_HINT =
  /non-?fiction|biograph|memoir|self[- ]help|history|science|psycholog|business|econom|politic|philosoph|health|cook|religion|spirit|essays|true crime|finance|invest|leadership|productiv|mindful|parenting|technology|nature|travel|sports|music|art\b/i;

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
/** Only the aggregate facts we use; descriptions, reviews and images are dropped straight away. */
const trim = (d) => ({
  id: d.id,
  slug: d.slug,
  title: d.title,
  release_year: d.release_year,
  isbns: d.isbns,
  users_count: d.users_count,
  ratings_count: d.ratings_count,
  rating: d.rating,
  pages: d.pages,
  compilation: d.compilation,
  genres: d.genres,
  moods: d.moods,
  content_warnings: d.content_warnings,
  featured_series: d.featured_series,
  contributions: (d.contributions ?? []).map((c) => ({
    contribution: c.contribution,
    author: { name: c.author?.name },
  })),
  author_names: d.author_names,
});

const compact = (t) =>
  String(t ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/^the /, '')
    .replace(/[^a-z0-9]+/g, '');
const keysOf = (title) => [...new Set([compact(title), compact(title.split(':')[0])])];
/** Looks books up by title key first, so matching 20,000 rows is not 20,000 x 20,000 comparisons. */
class Index {
  map = new Map();
  add(item, title) {
    for (const k of keysOf(title)) this.map.set(k, [...(this.map.get(k) ?? []), item]);
  }
  find(title, test) {
    for (const k of keysOf(title))
      for (const item of this.map.get(k) ?? []) if (test(item)) return item;
    return undefined;
  }
}

// ---- 1. research lists ------------------------------------------------------------------------
const researchDir = join(root, '.work', 'research');
const research = [];
if (existsSync(researchDir)) {
  const FILES = ['recent.json', 'alltime.json', 'canon.json', 'nonfiction.json', 'authors.json'];
  for (const file of readdirSync(researchDir).filter((f) => FILES.includes(f))) {
    try {
      const rows = readJson(join(researchDir, file));
      if (Array.isArray(rows)) for (const r of rows) research.push({ ...r, file });
    } catch {
      console.error(`skipping unreadable ${file}`);
    }
  }
}
console.error(`research rows: ${research.length}`);

const mergedIndex = new Index();
const merged = []; // { title, author, year, kind, genreHint, sources:Set, soldMillions, authorRank }
for (const row of research) {
  if (!row.title || !row.author || NOISE.test(row.title)) continue;
  const title = cleanTitle(row.title);
  const hit = mergedIndex.find(title, (m) => sameBook(m, { title, author: row.author }));
  const sources = Array.isArray(row.sources) && row.sources.length ? row.sources : [row.file];
  if (hit) {
    for (const s of sources) hit.sources.add(s);
    hit.soldMillions ??= row.soldMillions ?? null;
    hit.authorRank = Math.min(hit.authorRank ?? 9999, row.authorRank ?? 9999);
    hit.year ??= row.year ?? null;
  } else {
    const entry = {
      title,
      author: row.author,
      year: row.year ?? null,
      kind: row.kind ?? null,
      genreHint: row.genreHint ?? '',
      sources: new Set(sources),
      soldMillions: row.soldMillions ?? null,
      authorRank: row.authorRank ?? 9999,
    };
    merged.push(entry);
    mergedIndex.add(entry, title);
  }
}
console.error(`distinct research books: ${merged.length}`);

// ---- 2. Hardcover most-read -------------------------------------------------------------------
const docs = [];
const docsFile = join(root, '.work', 'hardcover-top.json');
if (existsSync(docsFile) && !process.argv.includes('--refetch')) {
  docs.push(...readJson(docsFile));
  console.error(`Hardcover docs from cache: ${docs.length}`);
} else {
  for (let page = 1; page <= maxPages; page++) {
    const batch = await searchBooks('*', { perPage: 25, page, sort: 'users_count:desc' });
    if (!batch.length) break;
    docs.push(...batch.map(trim));
    if (page % 20 === 0) console.error(`Hardcover page ${page}, ${docs.length} docs`);
  }
  writeFileSync(docsFile, JSON.stringify(docs));
}

if (process.argv.includes('--fetch-only')) {
  console.error(`Fetched ${docs.length} Hardcover docs into .work/hardcover-top.json`);
  process.exit(0);
}

const englishIsbn = (doc) =>
  (doc.isbns ?? []).find((i) => /^97[89][01]\d{9}$/.test(i) && isValidIsbn13(i));
const usable = (doc) => {
  const title = cleanTitle(doc.title ?? '');
  const author = primaryAuthor(doc);
  return (
    author &&
    title &&
    !doc.compilation &&
    !NOISE.test(doc.title) &&
    (doc.release_year ?? 0) >= 1000 &&
    englishIsbn(doc)
  );
};

const docIndex = new Index();
for (const d of docs) if (usable(d)) docIndex.add(d, cleanTitle(d.title));

// ---- 3. resolve research rows to Hardcover docs ----------------------------------------------
const maxLookups = flag('lookups', 1800);
let looked = 0;
// Books on several lists first: they matter most and a search costs a second each.
merged.sort((a, b) => b.sources.size - a.sources.size);
for (const m of merged) {
  m.doc = docIndex.find(m.title, (d) =>
    sameBook(m, { title: cleanTitle(d.title), author: primaryAuthor(d) }),
  );
  if (m.doc || looked >= maxLookups) continue;
  looked++;
  const found = (await searchBooks(`${m.title} ${m.author}`, { perPage: 6 })).map(trim);
  m.doc = found.find(
    (d) => usable(d) && sameBook(m, { title: cleanTitle(d.title), author: primaryAuthor(d) }),
  );
  if (looked % 50 === 0) console.error(`resolved ${looked} research books by search`);
}
console.error(
  `research books resolved: ${merged.filter((m) => m.doc).length} of ${merged.length} (${looked} needed a search)`,
);

// ---- 4. candidates ----------------------------------------------------------------------------
const candidates = new Map(); // doc id -> candidate
const upsert = (doc, extra) => {
  const key = doc.id;
  const prior = candidates.get(key) ?? {
    doc,
    sources: new Set(),
    soldMillions: null,
    authorRank: 9999,
    kind: null,
    genreHint: '',
  };
  for (const s of extra.sources ?? []) prior.sources.add(s);
  prior.soldMillions ??= extra.soldMillions ?? null;
  prior.authorRank = Math.min(prior.authorRank, extra.authorRank ?? 9999);
  prior.kind ??= extra.kind ?? null;
  if (extra.genreHint) prior.genreHint = extra.genreHint;
  candidates.set(key, prior);
};
for (const m of merged) if (m.doc) upsert(m.doc, m);
for (const doc of docs) if (usable(doc) && (doc.ratings_count ?? 0) >= 30) upsert(doc, {});

const isNonfiction = (c) =>
  c.kind === 'nonfiction' ||
  (c.kind === null &&
    (c.doc.genres ?? []).some(
      (g) => NONFICTION_HINT.test(String(g)) && !/fiction/i.test(String(g)),
    )) ||
  (c.doc.genres ?? []).some((g) => /^non-?fiction$/i.test(String(g)));

const score = (c) =>
  10 * Math.log10(10 + (c.doc.users_count ?? 0)) +
  8 * Math.min(c.sources.size, 6) +
  (c.authorRank < 9999 ? 10 * Math.max(0, 1 - c.authorRank / 400) : 0) +
  Math.min(20, c.soldMillions ?? 0) +
  Math.min(5, ((c.doc.rating ?? 3) - 3) * 2.5);

const haveIndex = new Index();
for (const b of have) haveIndex.add(b, cleanTitle(b.title));
const ranked = [...candidates.values()]
  .filter(
    (c) =>
      !haveIndex.find(cleanTitle(c.doc.title), (b) =>
        sameBook(b, { title: cleanTitle(c.doc.title), author: primaryAuthor(c.doc) }),
      ),
  )
  .sort((a, b) => score(b) - score(a));

const need = Math.max(0, target - catalogue.length);
const nonfictionPool = ranked.filter(isNonfiction);
const fictionPool = ranked.filter((c) => !isNonfiction(c));
const takeNonfiction = Math.min(nonfictionWanted, nonfictionPool.length, need);
const picked = [
  ...nonfictionPool.slice(0, takeNonfiction),
  ...fictionPool.slice(0, need - takeNonfiction),
].sort((a, b) => score(b) - score(a));
console.error(
  `candidates ${ranked.length} (fiction ${fictionPool.length}, non-fiction ${nonfictionPool.length}); picking ${picked.length} (non-fiction ${takeNonfiction})`,
);

// ---- 5. write ---------------------------------------------------------------------------------
const slugs = new Set(catalogue.map((b) => b.slug ?? slugify(b.title)));
const additions = [];
const facts = {};
for (const c of picked) {
  const title = cleanTitle(c.doc.title);
  const author = primaryAuthor(c.doc);
  let slug = slugify(title);
  if (slugs.has(slug)) slug = `${slug}-${slugify(author.split(' ').pop())}`;
  if (slugs.has(slug)) slug = `${slug}-${c.doc.release_year}`;
  if (slugs.has(slug)) continue;
  slugs.add(slug);
  additions.push({
    title,
    author,
    year: c.doc.release_year,
    slug,
    kind: isNonfiction(c) ? 'nonfiction' : 'fiction',
    genres: [],
    genreHint: c.genreHint || (c.doc.genres ?? []).slice(0, 4).join(', '),
    soldMillions: c.soldMillions,
    group: c.soldMillions ? 'all-time' : 'modern',
    isbn13: englishIsbn(c.doc),
    sources: [...c.sources].slice(0, 6),
    readers: c.doc.users_count ?? 0,
  });
  facts[slug] = summarise(c.doc);
}
writeFileSync(catalogueFile, `${JSON.stringify([...catalogue, ...additions], null, 1)}\n`);
writeFileSync(join(root, '.work', 'hardcover-new.json'), JSON.stringify(facts));
const kinds = additions.reduce((n, a) => ({ ...n, [a.kind]: (n[a.kind] ?? 0) + 1 }), {});
console.error(`Added ${additions.length} books to the catalogue`, kinds);
