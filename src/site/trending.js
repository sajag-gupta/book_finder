/**
 * Matches Hardcover's trending list (titles and authors) to books on this site, keeping Hardcover's
 * order. Only books we publish are returned, so every item links to a real page.
 */
const norm = (s) =>
  String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const head = (title) =>
  norm(
    String(title)
      .replace(/\s*\([^)]*\)\s*$/, '')
      .split(/[:,]/)[0],
  );
const surname = (author) => norm(author).split(' ').filter(Boolean).at(-1) ?? '';

/**
 * @param {Array<{title: string, author: string}>} entries  trending entries, best first
 * @param {Array<{title: string, author: string}>} books    published books
 */
export function matchTrending(entries = [], books = []) {
  const seen = new Set();
  const matched = [];
  for (const entry of entries) {
    const book = books.find(
      (b) => head(b.title) === head(entry.title) && surname(b.author) === surname(entry.author),
    );
    if (book && !seen.has(book.slug)) {
      seen.add(book.slug);
      matched.push(book);
    }
  }
  return matched;
}
