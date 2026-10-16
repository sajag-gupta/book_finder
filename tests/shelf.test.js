import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clampRating, createStore, migrate } from '../src/assets/shelf-store.js';
import { importRows, parseCsv } from '../src/assets/shelf-import.js';
import { readingStats } from '../src/assets/shelf-stats.js';

const memory = (initial) => {
  const data = new Map(initial ? [['bf:shelf', initial]] : []);
  return {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  };
};

test('ratings clamp to 0-5 in half-star steps', () => {
  assert.equal(clampRating(3.2), 3);
  assert.equal(clampRating(3.3), 3.5);
  assert.equal(clampRating(9), 5);
  assert.equal(clampRating(-1), 0);
  assert.equal(clampRating('nope'), 0);
});

test('migrate upgrades the original array-of-slugs shelf and rejects junk', () => {
  const upgraded = migrate(['dune', 'emma', 42]);
  assert.deepEqual(Object.keys(upgraded.items), ['dune', 'emma']);
  assert.equal(upgraded.items.dune.status, 'want');
  assert.deepEqual(migrate({ nonsense: true }), { v: 2, items: {} });
  assert.deepEqual(migrate(null), { v: 2, items: {} });
});

test('the store adds, updates and removes books', () => {
  const store = createStore(memory());
  store.set('dune', { status: 'reading' });
  assert.equal(store.get('dune').status, 'reading');
  store.set('dune', { rating: 4.5 });
  assert.equal(store.get('dune').rating, 4.5);
  assert.equal(store.get('dune').status, 'reading', 'a rating update keeps the status');
  assert.equal(store.count(), 1);
  store.remove('dune');
  assert.equal(store.get('dune'), null);
});

test('finishing a book stamps today as the date read, once', () => {
  const store = createStore(memory());
  const finished = store.set('emma', { status: 'read' });
  assert.match(finished.read, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(store.set('emma', { read: '2024-03-02' }).read, '2024-03-02');
  assert.equal(
    store.set('emma', { status: 'read' }).read,
    '2024-03-02',
    'an existing date is kept',
  );
});

test('unknown statuses and bad dates are ignored', () => {
  const store = createStore(memory());
  store.set('dune', { status: 'hacked', read: 'yesterday' });
  assert.equal(store.get('dune').status, 'want');
  assert.equal(store.get('dune').read, null);
});

test('the store survives corrupt storage and a throwing setItem', () => {
  const corrupt = createStore(memory('{not json'));
  assert.deepEqual(corrupt.all(), {});
  const blocked = createStore({
    getItem: () => null,
    setItem: () => {
      throw new Error('quota');
    },
  });
  assert.doesNotThrow(() => blocked.set('dune', { status: 'read' }));
});

test('an old shelf in storage is upgraded on first read', () => {
  const store = createStore(memory(JSON.stringify(['dune'])));
  assert.equal(store.get('dune').status, 'want');
});

test('merge never overwrites books the reader already shelved', () => {
  const store = createStore(memory());
  store.set('dune', { status: 'read', rating: 5 });
  const added = store.merge({
    dune: { status: 'dnf', rating: 1 },
    emma: { status: 'read', rating: 4, read: '2023-01-05' },
  });
  assert.equal(added, 1);
  assert.equal(store.get('dune').rating, 5);
  assert.equal(store.get('emma').read, '2023-01-05');
});

test('exportJson round-trips', () => {
  const store = createStore(memory());
  store.set('dune', { status: 'read', rating: 4 });
  const copy = createStore(memory(store.exportJson()));
  assert.equal(copy.get('dune').rating, 4);
});

// ---------- CSV import ----------
const GOODREADS = `Book Id,Title,Author,ISBN,ISBN13,My Rating,Exclusive Shelf,Date Read
1,"Fourth Wing (The Empyrean, #1)",Rebecca Yarros,"=""1649374042""","=""9781649374042""",5,read,2024/02/03
2,Dune,Frank Herbert,"=""""","=""""",0,to-read,
3,"The ""Odd"" Book",Nobody Known,"","",3,currently-reading,
`;
const INDEX = [
  { s: 'fourth-wing', t: 'Fourth Wing', a: 'Rebecca Yarros', i: '9781649374042' },
  { s: 'dune', t: 'Dune', a: 'Frank Herbert', i: '9780441013593' },
];

test('parseCsv handles quotes, escaped quotes, Excel formulas and a BOM', () => {
  const rows = parseCsv(`${String.fromCharCode(0xfeff)}${GOODREADS}`);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].Title, 'Fourth Wing (The Empyrean, #1)');
  assert.equal(rows[2].Title, 'The "Odd" Book');
  assert.equal(parseCsv('a,b\r\n"x\ny",2\r\n')[0].a, 'x\ny');
  assert.deepEqual(parseCsv(''), []);
});

test('Goodreads rows match by ISBN-13 or by title and author surname', () => {
  const result = importRows(parseCsv(GOODREADS), INDEX);
  assert.equal(result.matched, 2);
  assert.deepEqual(result.unmatched, ['The "Odd" Book']);
  assert.deepEqual(result.items['fourth-wing'], { status: 'read', rating: 5, read: '2024-02-03' });
  assert.equal(result.items.dune.status, 'want', 'matched by title when the ISBN is blank');
});

test('StoryGraph exports map statuses and half-star ratings', () => {
  const csv = `Title,Authors,ISBN/UID,Read Status,Star Rating,Last Date Read
Dune,Frank Herbert,9780441013593,did-not-finish,2.5,2023/11/9
`;
  const { items } = importRows(parseCsv(csv), INDEX);
  assert.deepEqual(items.dune, { status: 'dnf', rating: 2.5, read: '2023-11-09' });
});

test('a title match with the wrong author is not imported', () => {
  const csv = 'Title,Author,ISBN13,My Rating,Exclusive Shelf\nDune,Someone Else,,3,read\n';
  assert.equal(importRows(parseCsv(csv), INDEX).matched, 0);
});

// ---------- Stats ----------
test('reading stats count statuses, average ratings and group read books', () => {
  const items = {
    a: { status: 'read', rating: 5, read: '2024-01-02' },
    b: { status: 'read', rating: 3, read: '2024-06-02' },
    c: { status: 'read', rating: 0, read: '2025-01-01' },
    d: { status: 'want', rating: 0, read: null },
    e: { status: 'dnf', rating: 1, read: null },
  };
  const bySlug = new Map([
    ['a', { g: ['fantasy', 'romance'] }],
    ['b', { g: ['fantasy'] }],
    ['c', { g: ['horror'] }],
  ]);
  const stats = readingStats(items, bySlug);
  assert.equal(stats.counts.read, 3);
  assert.equal(stats.counts.want, 1);
  assert.equal(stats.counts.dnf, 1);
  assert.equal(stats.averageRating, 4, 'unrated books are left out of the average');
  assert.deepEqual(stats.topGenres[0], ['fantasy', 2]);
  assert.deepEqual(stats.booksByYear, [
    ['2024', 2],
    ['2025', 1],
  ]);
  assert.equal(readingStats({}, new Map()).averageRating, null);
});
