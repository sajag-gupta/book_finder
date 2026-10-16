import stores from '../../config/stores.json' with { type: 'json' };
import affiliates from '../../config/affiliates.json' with { type: 'json' };

const byId = new Map(stores.map((store) => [store.id, store]));

export const allStores = stores;

export function getStore(id) {
  return byId.get(id);
}

/** Affiliate IDs with the documentation key removed. */
export const affiliateIds = Object.fromEntries(
  Object.entries(affiliates).filter(([key]) => !key.startsWith('_')),
);
