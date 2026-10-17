/**
 * Helpers for Hardcover's official API data (https://docs.hardcover.app). Pure functions, no I/O.
 *
 * Hardcover's terms allow aggregate data with attribution; they forbid using readers' libraries or
 * reviews and training language models on the data. We keep only aggregate facts (rating, counts,
 * page count, series, moods, genres and reader-reported content warnings), credit Hardcover wherever
 * they appear, and never store free text such as descriptions or reviews.
 */

// Hardcover genre name (lower-cased) -> our genre slug.
const GENRE_MAP = {
  fantasy: 'fantasy',
  'epic fantasy': 'epic-fantasy',
  'cozy fantasy': 'cozy-fantasy',
  romantasy: 'romantasy',
  romance: 'romance',
  'science fiction': 'science-fiction',
  'sci-fi': 'science-fiction',
  dystopian: 'dystopian',
  thriller: 'thriller',
  suspense: 'thriller',
  mystery: 'mystery',
  crime: 'crime',
  horror: 'horror',
  'historical fiction': 'historical',
  historical: 'historical',
  'young adult': 'young-adult',
  classics: 'classic',
  adventure: 'adventure',
  "children's literature": 'children',
  children: 'children',
  'literary fiction': 'literary',
  'contemporary fiction': 'literary',
};

const NONFICTION = [
  'nonfiction',
  'non-fiction',
  'self help',
  'self-help',
  'biography',
  'memoir',
  'business',
  'psychology',
  'cookbook',
  'politics',
  'religion',
  'philosophy',
];

/** Our genre slugs for a Hardcover genre list, in Hardcover's order, at most three. */
export function ourGenres(hcGenres = []) {
  const out = [];
  for (const g of hcGenres) {
    const slug = GENRE_MAP[String(g).toLowerCase()];
    if (slug && !out.includes(slug)) out.push(slug);
  }
  return out.slice(0, 3);
}

export const isNonfiction = (hcGenres = []) =>
  hcGenres.some((g) => NONFICTION.includes(String(g).toLowerCase()));

/**
 * The book's author. Hardcover lists annotators, illustrators and translators too, and
 * `author_names` puts them in no useful order, so use the contribution roles: the first person
 * credited as "Author" (or with no role), falling back to the first name.
 */
export function primaryAuthor(doc) {
  const credited = (doc.contributions ?? []).find(
    (c) => !c.contribution || c.contribution === 'Author',
  );
  return credited?.author?.name ?? doc.author_names?.[0] ?? null;
}

/** "Dune (Dune Chronicles #1)" -> "Dune"; "Babel, or the Necessity of Violence" -> "Babel". */
export const cleanTitle = (title) =>
  String(title)
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/,\s+or\s.*$/i, '')
    .replace(/\s*:\s*a novel$/i, '')
    .trim();

const norm = (s) =>
  String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const compactTitle = (t) => norm(t).replace(/^the /, '').replace(/ /g, '');
const authorTokens = (author) =>
  new Set(
    norm(author)
      .split(' ')
      .filter((t) => t.length > 1),
  );

/**
 * Whether two records are the same book. Titles must match (ignoring "The", punctuation and a
 * subtitle that only one side has: "Good Omens" = "Good Omens: The Nice and Accurate Prophecies..."),
 * and the authors must share a name token, so "Liu Cixin" = "Cixin Liu". Two different subtitles
 * ("Mistborn: The Final Empire" vs "Mistborn: The Well of Ascension") are different books.
 */
export function sameBook(a, b) {
  const [ta, tb] = [cleanTitle(a.title), cleanTitle(b.title)];
  const [ha, hb] = [ta.split(':')[0], tb.split(':')[0]];
  const full = compactTitle(ta) === compactTitle(tb);
  const oneSubtitle = ta.includes(':') !== tb.includes(':');
  const sameTitle = full || (oneSubtitle && compactTitle(ha) === compactTitle(hb));
  const shared = [...authorTokens(a.author)].some((t) => authorTokens(b.author).has(t));
  return sameTitle && shared;
}

const unique = (items, limit) => {
  const seen = new Set();
  const out = [];
  for (const raw of items) {
    const text = String(raw).trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    out.push(text.charAt(0).toUpperCase() + text.slice(1));
    if (out.length === limit) break;
  }
  return out;
};

/** The aggregate facts we keep from a Hardcover search document. */
export function summarise(doc) {
  const series = doc.featured_series;
  return {
    id: doc.id,
    slug: doc.slug,
    rating: typeof doc.rating === 'number' ? Math.round(doc.rating * 10) / 10 : null,
    ratingsCount: doc.ratings_count ?? 0,
    usersCount: doc.users_count ?? 0,
    pages: doc.pages ?? null,
    series: series?.series?.name
      ? {
          name: series.series.name,
          position: series.position ?? null,
          total: series.series.primary_books_count ?? series.series.books_count ?? null,
        }
      : null,
    moods: unique(doc.moods ?? [], 8),
    contentWarnings: unique(doc.content_warnings ?? [], 12),
  };
}
