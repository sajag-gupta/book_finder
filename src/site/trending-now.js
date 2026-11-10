import { sameBook } from '../shared/hardcover.js';

/**
 * Turns data/trending-now.json (titles and authors from this month's bestseller charts) into items the
 * pages can show. Each is matched to a written book first, then to a facts-only listing; a title the
 * site does not have is left out rather than shown with a dead link.
 */
/** A long subtitle makes a card unreadable; the full title is on the book's own page. */
const short = (title) => (title.length > 38 && title.includes(':') ? title.split(':')[0] : title);

export function resolveTrendingNow(list, published, light, hc) {
  if (!list?.groups) return { updated: null, groups: [], flat: [] };
  const groups = list.groups.map((group) => ({
    name: group.name,
    items: group.books
      .map((entry) => {
        const book = published.find((b) => sameBook(b, entry));
        if (book) {
          const facts = hc(book.slug);
          return {
            rank: entry.rank,
            slug: book.slug,
            title: short(book.title),
            author: book.author,
            isbn13: book.isbn13,
            written: true,
            rating: facts?.rating && facts.ratingsCount >= 20 ? facts.rating : null,
          };
        }
        const entryLight = light.find((b) => sameBook({ title: b.t, author: b.a }, entry));
        return entryLight
          ? {
              rank: entry.rank,
              slug: entryLight.s,
              title: short(entryLight.t),
              author: entryLight.a,
              isbn13: entryLight.i,
              written: false,
              rating: entryLight.r && entryLight.n >= 20 ? entryLight.r : null,
            }
          : null;
      })
      .filter(Boolean),
  }));
  return { updated: list.updated, groups, flat: groups.flatMap((g) => g.items) };
}
