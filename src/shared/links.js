/**
 * Builds the outbound URL for a store. Pure and config-driven so the build step (which renders
 * /go/... links) and the redirect function (which resolves them) can never disagree.
 *
 * A store link is affiliate-tagged only when every ID the template requires is non-empty;
 * otherwise the plain URL is used. Targets come only from config templates, never from user input
 * (the optional `query` is URL-encoded before substitution), so this cannot become an open redirect.
 */

const PLACEHOLDER = /\{(\w+)\}/g;

function fill(template, vars) {
  return template.replace(PLACEHOLDER, (_, key) => {
    if (!(key in vars)) throw new Error(`Unknown placeholder {${key}} in "${template}"`);
    return vars[key];
  });
}

/**
 * @param {object} store    An entry from config/stores.json
 * @param {{isbn13: string, query?: string}} book
 * @param {Record<string, string>} [ids]  Affiliate IDs from config/affiliates.json
 * @returns {{url: string, affiliate: boolean}}
 */
export function buildStoreUrl(store, book, ids = {}) {
  const query = (book.query ?? '').trim().slice(0, 120) || book.isbn13;
  const vars = { isbn13: book.isbn13, query: encodeURIComponent(query) };
  const plain = fill(store.plain, vars);

  const aff = store.affiliate;
  if (aff && aff.requires.every((key) => Boolean(ids[key]))) {
    const encodedIds = Object.fromEntries(
      Object.entries(ids).map(([key, value]) => [key, encodeURIComponent(value)]),
    );
    const url = fill(aff.template, {
      ...vars,
      ...encodedIds,
      plain_encoded: encodeURIComponent(plain),
    });
    return { url, affiliate: true };
  }
  return { url: plain, affiliate: false };
}

/** Path of the first-party redirect for a store/book pair, with an optional search hint. */
export function goPath(storeId, isbn13, query) {
  const base = `/go/${storeId}/${isbn13}`;
  return query ? `${base}?q=${encodeURIComponent(query)}` : base;
}
