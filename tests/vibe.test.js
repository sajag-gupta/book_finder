import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadData, validateData } from '../src/site/data.js';
import { parseVibe, rankBooks } from '../src/assets/vibe-core.js';

const data = loadData(fileURLToPath(new URL('..', import.meta.url)));
const lexicon = {
  moods: data.moods.map((m) => m.slug),
  genres: data.genres.map((g) => g.slug),
  tropes: data.tropes.map((t) => ({ s: t.slug, n: t.name })),
  feelings: data.feelings.map((f) => ({
    s: f.slug,
    words: f.words,
    wants: f.wants.map((w) => w.mood),
  })),
};
const books = data.books.map((b) => ({
  s: b.slug,
  t: b.title,
  a: b.author,
  g: b.genres,
  m: b.moods,
  tr: b.tropes,
  w: b.warnings,
  l: b.length,
  p: b.pace,
  sold: b.soldMillions ?? 0,
  users: 0,
}));

test('feelings only point at moods that exist', () => {
  assert.deepEqual(
    validateData(data).filter((e) => e.includes('feelings')),
    [],
  );
});

test('a sentence becomes moods, genres, tropes and exclusions', () => {
  const v = parseVibe('A cozy fantasy with found family, but no gore please', lexicon);
  assert.ok(v.genres.includes('cozy-fantasy'));
  assert.ok(!v.moods.includes('cozy'), 'cozy fantasy is a genre, not a demand for the cozy mood');
  assert.ok(v.tropes.includes('found-family'));
  assert.deepEqual(v.avoidWarnings, ['gore']);
});

test('"no romance" excludes the genre instead of asking for it', () => {
  const v = parseVibe('tense thriller with no romance', lexicon);
  assert.ok(v.moods.includes('tense'));
  assert.ok(v.genres.includes('thriller'));
  assert.ok(v.avoidGenres.includes('romance'));
  assert.ok(!v.genres.includes('romance'));
});

test('a current feeling suggests moods only when none were named', () => {
  const alone = parseVibe('I am stressed', lexicon);
  assert.deepEqual(alone.feelings, ['stressed']);
  assert.ok(alone.moods.includes('cozy'));
  const explicit = parseVibe('I am stressed and want something funny', lexicon);
  assert.deepEqual(explicit.moods, ['funny']);
});

test('ranking honours exclusions and explains each match', () => {
  const v = parseVibe('dark fantasy no violence', lexicon);
  const ranked = rankBooks(books, v);
  assert.ok(ranked.length > 0);
  for (const { book, why } of ranked) {
    assert.ok(!book.w.includes('violence'));
    assert.ok(why.length > 0);
  }
});

test('nothing recognisable gives no results rather than random books', () => {
  assert.deepEqual(rankBooks(books, parseVibe('qwertyuiop asdf', lexicon)), []);
});
