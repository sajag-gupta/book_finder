import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidIsbn13, normalizeIsbn } from '../src/shared/isbn.js';

test('normalizeIsbn strips hyphens and spaces', () => {
  assert.equal(normalizeIsbn('978-0-441-01359-3'), '9780441013593');
  assert.equal(normalizeIsbn(' 9780441013593 '), '9780441013593');
  assert.equal(normalizeIsbn(null), '');
});

test('isValidIsbn13 accepts real ISBNs', () => {
  assert.equal(isValidIsbn13('9780441013593'), true);
  assert.equal(isValidIsbn13('978-1-64937-404-2'), true);
});

test('isValidIsbn13 rejects bad check digits and malformed input', () => {
  assert.equal(isValidIsbn13('9780441013594'), false);
  assert.equal(isValidIsbn13('978044101359'), false);
  assert.equal(isValidIsbn13('abcdefghijklm'), false);
  assert.equal(isValidIsbn13(''), false);
});
