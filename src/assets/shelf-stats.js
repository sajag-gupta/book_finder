// Reading stats for the shelf page, computed in the browser from the reader's own data.

/**
 * @param {Record<string, {status: string, rating: number, read: string|null}>} items
 * @param {Map<string, {g?: string[]}>} bySlug  search-index entries by slug
 */
export function readingStats(items, bySlug) {
  const entries = Object.entries(items);
  const counts = { want: 0, reading: 0, read: 0, paused: 0, dnf: 0 };
  const genres = new Map();
  const years = new Map();
  let rated = 0;
  let ratingSum = 0;

  for (const [slug, item] of entries) {
    if (item.status in counts) counts[item.status]++;
    if (item.status !== 'read') continue;
    if (item.rating > 0) {
      rated++;
      ratingSum += item.rating;
    }
    for (const g of bySlug.get(slug)?.g ?? []) genres.set(g, (genres.get(g) ?? 0) + 1);
    const year = item.read?.slice(0, 4);
    if (year) years.set(year, (years.get(year) ?? 0) + 1);
  }

  return {
    counts,
    total: entries.length,
    averageRating: rated ? Math.round((ratingSum / rated) * 10) / 10 : null,
    topGenres: [...genres.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 6),
    booksByYear: [...years.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  };
}
