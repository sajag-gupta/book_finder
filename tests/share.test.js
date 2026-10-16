import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadData } from '../src/site/data.js';
import { SIZES, cardTree, titleSize } from '../src/share/card.js';
import { renderCardPng } from '../src/share/render.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const data = loadData(root);
const options = { moods: data.moods, host: 'example.test', siteName: 'Test Site' };
const book = data.books.find((b) => b.slug === 'the-house-in-the-cerulean-sea');

const png = (bytes) => ({
  signature: Buffer.from(bytes.subarray(0, 8)).toString('hex'),
  width: Buffer.from(bytes).readUInt32BE(16),
  height: Buffer.from(bytes).readUInt32BE(20),
});

test('titleSize shrinks long titles and scales down for link previews', () => {
  assert.ok(titleSize('Dune', 'portrait') > titleSize('The House in the Cerulean Sea', 'portrait'));
  assert.ok(titleSize('Dune', 'og') < titleSize('Dune', 'portrait'));
  assert.ok(titleSize('x'.repeat(80), 'portrait') >= 40);
});

test('the portrait card includes title, author, mood chips and the page address', () => {
  const text = JSON.stringify(cardTree(book, options));
  assert.ok(text.includes(book.title));
  assert.ok(text.includes(book.author));
  assert.ok(text.includes('Cozy'));
  assert.ok(text.includes(`example.test/books/${book.slug}`));
  assert.ok(text.includes('Read this if'));
});

test('the link-preview card leaves out the read-if box', () => {
  assert.ok(
    !JSON.stringify(cardTree(book, { ...options, variant: 'og' })).includes('Read this if'),
  );
});

test('renders valid PNGs at the exact sizes', async () => {
  for (const variant of ['portrait', 'og']) {
    const info = png(await renderCardPng(book, { ...options, variant }));
    assert.equal(info.signature, '89504e470d0a1a0a');
    assert.equal(info.width, SIZES[variant].width);
    assert.equal(info.height, SIZES[variant].height);
  }
});

test('renders every published-length title without throwing', async () => {
  for (const b of data.books) {
    assert.ok((await renderCardPng(b, options)).length > 5000, b.slug);
  }
});
