import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadData, validateData } from '../src/site/data.js';

const root = fileURLToPath(new URL('..', import.meta.url));

test('the committed data set is valid', () => {
  assert.deepEqual(validateData(loadData(root)), []);
});

const withBook = (patch) => {
  const data = loadData(root);
  const book = { ...data.books[0], ...patch };
  return { ...data, books: [book, ...data.books.slice(1)] };
};

test('rejects an ISBN with a bad check digit', () => {
  const errors = validateData(withBook({ isbn13: '9780441013594' }));
  assert.ok(errors.some((e) => e.includes('check digit')));
});

test('rejects unknown moods, tropes and warnings', () => {
  const errors = validateData(
    withBook({ moods: ['not-a-mood'], tropes: ['nope'], warnings: ['x'] }),
  );
  assert.ok(errors.some((e) => e.includes('unknown mood')));
  assert.ok(errors.some((e) => e.includes('unknown trope')));
  assert.ok(errors.some((e) => e.includes('unknown warning')));
});

test('rejects pairings that point nowhere', () => {
  const errors = validateData(
    withBook({
      pairings: [
        { slug: 'ghost', reason: 'This reason is long enough to pass.', moodShift: 'similar' },
      ],
    }),
  );
  assert.ok(errors.some((e) => e.includes('unknown book "ghost"')));
});

test('a reviewed book needs two sources and a reviewer', () => {
  const errors = validateData(withBook({ status: 'reviewed', sources: [], reviewedBy: null }));
  assert.ok(errors.some((e) => e.includes('two sources')));
  assert.ok(errors.some((e) => e.includes('reviewedBy')));
});

test('rejects unexpected fields so typos do not slip through', () => {
  const errors = validateData(withBook({ mooods: ['cozy'] }));
  assert.ok(errors.length > 0);
});
