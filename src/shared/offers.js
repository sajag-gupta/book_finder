/**
 * Offer ordering, following the product plan:
 *   1. Sort by lowest total price. Offers without a known price sort after priced ones.
 *   2. Break ties toward the higher-paying program.
 *   3. Never hide a cheaper option to push a commission.
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

  const priced = ranked.filter(hasPrice);
  const lowest = priced.length ? total(priced[0]) : null;
  return ranked.map((offer) => ({
    ...offer,
    isLowest: lowest !== null && hasPrice(offer) && total(offer) === lowest,
  }));
}

export const FORMAT_ORDER = ['print', 'ebook', 'audio'];

export const FORMAT_TITLES = {
  print: 'Print, new',
  ebook: 'Ebook',
  audio: 'Audiobook',
};
