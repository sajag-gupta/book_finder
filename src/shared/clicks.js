/**
 * Builds the row stored for a store click. Privacy by design: no IP address, no user agent, and
 * only the referring *host*, so the click log can count outcomes without identifying readers.
 */
export function clickRecord(request, { storeId, isbn13, affiliate }) {
  let referrerHost = null;
  try {
    const referer = request.headers.get('Referer');
    if (referer) referrerHost = new URL(referer).host;
  } catch {
    // Malformed Referer header: record nothing.
  }
  return {
    store: storeId,
    isbn13,
    affiliate: affiliate ? 1 : 0,
    referrerHost,
    country: request.cf?.country ?? null,
  };
}

export async function logClick(db, record) {
  if (!db) return;
  try {
    await db
      .prepare(
        'INSERT INTO clicks (store, isbn13, affiliate, referrer_host, country) VALUES (?, ?, ?, ?, ?)',
      )
      .bind(record.store, record.isbn13, record.affiliate, record.referrerHost, record.country)
      .run();
  } catch (error) {
    // Logging must never break the redirect.
    console.error('click log failed', error);
  }
}
