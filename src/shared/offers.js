/**
 * Offer ordering, following the product plan:
 *   1. Sort by lowest total price. Offers without a known price sort after priced ones.
 *   2. Break ties toward the higher-paying program.
 *   3. Never hide a cheaper option to push a commission. Library rows are always kept.
 */

const total = (offer) => (offer.price ?? 0) + (offer.shipping ?? 0);
const hasPrice = (offer) => typeof offer.price === 'number';

/**
 * @param {Array<{store: object, price?: number, shipping?: number}>} offers
 * @returns {Array<object>} new array, ordered, each offer annotated with `isLowest`
 */
export function rankOffers(offers) {
  const ranked = [...offers].sort((a, b) => {
    if (hasPrice(a) !== hasPrice(b)) return hasPrice(a) ? -1 : 1;
    if (hasPrice(a) && total(a) !== total(b)) return total(a) - total(b);
    return b.store.commissionRate - a.store.commissionRate;
  });

  // The "lowest price" badge goes to the cheapest paid option; library copies are free by
  // definition and are labelled separately.
  const paid = ranked.filter((o) => o.store.kind !== 'library' && hasPrice(o));
  const lowest = paid.length ? total(paid[0]) : null;
  return ranked.map((offer) => ({
    ...offer,
    isLowest:
      lowest !== null &&
      offer.store.kind !== 'library' &&
      hasPrice(offer) &&
      total(offer) === lowest,
  }));
}

export const FORMAT_ORDER = ['library', 'print', 'used', 'ebook', 'audio'];

export const FORMAT_TITLES = {
  library: 'Borrow free',
  print: 'Print, new',
  used: 'Print, used',
  ebook: 'Ebook',
  audio: 'Audiobook',
};
