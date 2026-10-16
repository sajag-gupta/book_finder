// The reader's shelf, stored only in this browser (localStorage). No account, nothing is sent to us.
// Shape: { v: 2, items: { [slug]: { status, rating, added, read } } }

export const STATUSES = [
  ['want', 'Want to read'],
  ['reading', 'Currently reading'],
  ['read', 'Read'],
  ['paused', 'Paused'],
  ['dnf', 'Did not finish'],
];
const VALID = new Set(STATUSES.map(([key]) => key));
const KEY = 'bf:shelf';

const today = () => new Date().toISOString().slice(0, 10);

/** Ratings run 0 (unrated) to 5 in half-star steps. */
export const clampRating = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.min(5, Math.max(0, Math.round(n * 2) / 2));
};

/** Reads any stored shape: the original array of slugs, or the current object. */
export function migrate(raw) {
  if (Array.isArray(raw)) {
    return {
      v: 2,
      items: Object.fromEntries(
        raw
          .filter((slug) => typeof slug === 'string')
          .map((slug) => [slug, { status: 'want', rating: 0, added: Date.now(), read: null }]),
      ),
    };
  }
  if (raw && raw.v === 2 && raw.items && typeof raw.items === 'object') return raw;
  return { v: 2, items: {} };
}

export function createStore(storage = globalThis.localStorage) {
  const read = () => {
    try {
      return migrate(JSON.parse(storage.getItem(KEY)));
    } catch {
      return migrate(null);
    }
  };
  const write = (state) => {
    try {
      storage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage is blocked (private mode) or full: the shelf simply does not persist.
    }
  };

  return {
    all: () => read().items,
    get: (slug) => read().items[slug] ?? null,
    count: () => Object.keys(read().items).length,

    /** Adds or updates one book. Only known statuses are accepted; ratings are clamped. */
    set(slug, patch) {
      const state = read();
      const current = state.items[slug] ?? {
        status: 'want',
        rating: 0,
        added: Date.now(),
        read: null,
      };
      const next = { ...current };
      if (patch.status !== undefined && VALID.has(patch.status)) next.status = patch.status;
      if (patch.rating !== undefined) next.rating = clampRating(patch.rating);
      if (patch.read !== undefined)
        next.read = /^\d{4}-\d{2}-\d{2}$/.test(patch.read) ? patch.read : null;
      if (next.status === 'read' && !next.read) next.read = today();
      state.items[slug] = next;
      write(state);
      return next;
    },

    remove(slug) {
      const state = read();
      delete state.items[slug];
      write(state);
    },

    /** Merges imported items without overwriting a book the reader already shelved. */
    merge(items) {
      const state = read();
      let added = 0;
      for (const [slug, item] of Object.entries(items)) {
        if (state.items[slug]) continue;
        state.items[slug] = {
          status: VALID.has(item.status) ? item.status : 'want',
          rating: clampRating(item.rating),
          added: Date.now(),
          read: /^\d{4}-\d{2}-\d{2}$/.test(item.read ?? '') ? item.read : null,
        };
        added++;
      }
      write(state);
      return added;
    },

    exportJson: () => JSON.stringify(read(), null, 2),
  };
}
