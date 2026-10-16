import { slugify } from '../shared/slug.js';
import { isPublished } from './data.js';

const byTitle = (a, b) => a.title.localeCompare(b.title);
const bySales = (a, b) => (b.soldMillions ?? 0) - (a.soldMillions ?? 0) || byTitle(a, b);

/** Everything a page needs to link between books. Only published books are ever referenced. */
export function createContext({ data, site }) {
  const published = data.books.filter((b) => isPublished(b, site.includeDrafts)).sort(byTitle);
  const bySlug = new Map(published.map((b) => [b.slug, b]));
  const pairings = (book) => (book.pairings ?? []).filter((p) => bySlug.has(p.slug));

  const groupBy = (keys) => {
    const map = new Map();
    for (const book of published) {
      for (const key of keys(book)) {
        if (!map.has(key)) map.set(key, []);
        map.get(key).push(book);
      }
    }
    for (const list of map.values()) list.sort(bySales);
    return map;
  };

  const byGenre = groupBy((b) => b.genres);
  const byMood = groupBy((b) => b.moods);
  const byTrope = groupBy((b) => b.tropes);
  const byAuthor = groupBy((b) => [slugify(b.author)]);

  const topSellers = published.filter((b) => b.soldMillions).sort(bySales);
  const modern = published
    .filter((b) => b.tier === 'modern' && b.firstPublished >= 2010)
    .sort((a, b) => b.firstPublished - a.firstPublished || byTitle(a, b));

  return {
    data,
    site,
    published,
    bySlug,
    pairings,
    byGenre,
    byMood,
    byTrope,
    byAuthor,
    topSellers,
    modern,
    authorSlug: (book) => slugify(book.author),
    /** Author pages exist only for authors with two or more books here. */
    hasAuthorPage: (book) => (byAuthor.get(slugify(book.author))?.length ?? 0) >= 2,
    genre: (slug) => data.genres.find((g) => g.slug === slug),
    mood: (slug) => data.moods.find((m) => m.slug === slug),
    trope: (slug) => data.tropes.find((t) => t.slug === slug),
  };
}
