/**
 * Open Library lookups for books outside our editorial catalogue, so a reader never hits a dead end.
 * Pure mapping functions plus two thin fetchers that take an injected `fetchImpl` (tested with fakes).
 *
 * We use Open Library for facts only: title, authors, first-publication year, page count, publisher,
 * subjects and ISBNs. We deliberately do not show its free-text descriptions, which are often
 * copied publisher blurbs.
 */
import { isValidIsbn13, normalizeIsbn } from './isbn.js';

const OL = 'https://openlibrary.org';
const enc = encodeURIComponent;

/** Prefers English-registrant ISBN-13s (978-0 / 978-1), which the stores we link know best. */
export function pickIsbn13(isbns = []) {
  const valid = [...new Set(isbns.map(normalizeIsbn))].filter(isValidIsbn13);
  return valid.find((i) => i.startsWith('9780') || i.startsWith('9781')) ?? valid[0] ?? null;
}

/**
 * Search result for the suggestion list. The ISBN comes from an English edition only: Open Library
 * works list ISBNs for every translation, and linking a reader to a Polish or Urdu edition of an
 * English book would be worse than showing nothing.
 * Returns null when there is nothing we can link to.
 */
export function mapSearchDoc(doc) {
  const edition = (doc.editions?.docs ?? []).find((e) => pickIsbn13(e.isbn));
  const isbn13 = edition ? pickIsbn13(edition.isbn) : null;
  if (!doc.title || !isbn13) return null;
  return {
    title: doc.title,
    author: doc.author_name?.[0] ?? '',
    year: doc.first_publish_year ?? null,
    isbn13,
    coverId: edition.cover_i ?? doc.cover_i ?? null,
  };
}

/** One result per title and author, in Open Library's order. */
export function dedupe(results) {
  const seen = new Set();
  return results.filter((r) => {
    const key = `${r.title}|${r.author}`.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mapBook({ edition, work, authors = [] }) {
  const subjects = (work?.subjects ?? edition?.subjects ?? [])
    .filter((s) => typeof s === 'string' && s.length <= 40)
    .slice(0, 10);
  const year = Number(
    String(work?.first_publish_date ?? edition?.publish_date ?? '').match(/\d{4}/)?.[0],
  );
  return {
    title: edition?.title ?? work?.title ?? '',
    subtitle: edition?.subtitle ?? null,
    authors: authors.filter(Boolean),
    year: Number.isFinite(year) ? year : null,
    pages: edition?.number_of_pages ?? null,
    publisher: edition?.publishers?.[0] ?? null,
    subjects,
    coverId: edition?.covers?.find((c) => c > 0) ?? work?.covers?.find((c) => c > 0) ?? null,
  };
}

const headers = (contact) => ({
  'User-Agent': `BookFinder/0.1 (${contact || 'https://github.com/sajag-gupta/book_finder'})`,
});

async function getJson(fetchImpl, url, contact) {
  const response = await fetchImpl(url, { headers: headers(contact) });
  return response.ok ? response.json() : null;
}

/** @returns {Promise<Array<ReturnType<typeof mapSearchDoc>>>} */
export async function searchBooks(query, { fetchImpl = fetch, contact } = {}) {
  const q = String(query ?? '')
    .trim()
    .slice(0, 100);
  if (q.length < 2) return [];
  const body = await getJson(
    fetchImpl,
    `${OL}/search.json?q=${enc(`${q} language:eng`)}&fields=key,title,author_name,first_publish_year,cover_i,editions,editions.isbn&limit=20`,
    contact,
  );
  return dedupe((body?.docs ?? []).map(mapSearchDoc).filter(Boolean)).slice(0, 8);
}

const authorKeys = (list = []) =>
  list
    .map((a) => a.author?.key ?? a.key)
    .filter((k) => typeof k === 'string' && /^\/authors\/OL\d+A$/.test(k))
    .slice(0, 3);

/**
 * Looks a book up by ISBN-13. Returns null when Open Library does not know it. The work and the
 * edition's authors are fetched in parallel, since each lookup is a separate round trip.
 */
export async function lookupBook(isbn, { fetchImpl = fetch, contact } = {}) {
  const clean = normalizeIsbn(isbn);
  if (!isValidIsbn13(clean)) return null;
  const edition = await getJson(fetchImpl, `${OL}/isbn/${clean}.json`, contact);
  if (!edition?.title) return null;

  const workKey = edition.works?.[0]?.key;
  const names = (keys) =>
    Promise.all(
      keys.map(async (key) => (await getJson(fetchImpl, `${OL}${key}.json`, contact))?.name),
    );

  const [work, editionAuthors] = await Promise.all([
    workKey && /^\/works\/OL\d+W$/.test(workKey)
      ? getJson(fetchImpl, `${OL}${workKey}.json`, contact)
      : null,
    names(authorKeys(edition.authors)),
  ]);
  // Many editions carry no authors of their own; the work does.
  const authors = editionAuthors.some(Boolean)
    ? editionAuthors
    : await names(authorKeys(work?.authors));

  return { isbn13: clean, ...mapBook({ edition, work, authors }) };
}
