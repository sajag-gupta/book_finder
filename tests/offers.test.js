import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rankOffers } from '../src/shared/offers.js';

const store = (id, kind, commissionRate) => ({ id, kind, commissionRate });

test('orders by lowest total price including shipping', () => {
  const ranked = rankOffers([
    { store: store('a', 'print', 0.1), price: 12, shipping: 5 },
    { store: store('b', 'print', 0.02), price: 15 },
  ]);
  assert.deepEqual(
    ranked.map((o) => o.store.id),
    ['b', 'a'],
  );
  assert.equal(ranked[0].isLowest, true);
  assert.equal(ranked[1].isLowest, false);
});

test('breaks price ties toward the higher-paying program', () => {
  const ranked = rankOffers([
    { store: store('low-pay', 'print', 0.02), price: 10 },
    { store: store('high-pay', 'print', 0.1), price: 10 },
  ]);
  assert.equal(ranked[0].store.id, 'high-pay');
});

test('never lets commission outrank a cheaper price', () => {
  const ranked = rankOffers([
    { store: store('rich', 'print', 0.15), price: 20 },
    { store: store('cheap', 'print', 0.0), price: 9 },
  ]);
  assert.equal(ranked[0].store.id, 'cheap');
});

test('offers with no known price sort after priced ones and never get the badge', () => {
  const ranked = rankOffers([
    { store: store('unknown', 'print', 0.5) },
    { store: store('priced', 'print', 0.01), price: 30 },
  ]);
  assert.deepEqual(
    ranked.map((o) => o.store.id),
    ['priced', 'unknown'],
  );
  assert.equal(ranked[1].isLowest, false);
});

test('library rows are kept and never take the lowest-price badge', () => {
  const ranked = rankOffers([
    { store: store('libby', 'library', 0), price: 0 },
    { store: store('shop', 'print', 0.1), price: 8 },
  ]);
  assert.equal(ranked.length, 2);
  assert.equal(ranked.find((o) => o.store.id === 'libby').isLowest, false);
  assert.equal(ranked.find((o) => o.store.id === 'shop').isLowest, true);
});

test('does not mutate its input', () => {
  const input = [
    { store: store('a', 'print', 0.1), price: 5 },
    { store: store('b', 'print', 0.1), price: 3 },
  ];
  rankOffers(input);
  assert.equal(input[0].store.id, 'a');
});
