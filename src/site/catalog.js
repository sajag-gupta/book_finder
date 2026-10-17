import { coverRef } from './components.js';

/** Small index for search suggestions and the saved shelf. */
export const searchIndex = (ctx) =>
  ctx.published.map((b) => ({
    s: b.slug,
    t: b.title,
    a: b.author,
    y: b.firstPublished,
    i: b.isbn13,
    g: b.genres,
    c: coverRef(b.isbn13),
  }));

/**
 * Every published book with the tags the browse filters and the vibe box match against, plus the
 * vocabulary they need to read a sentence. Keys are short because this file grows with the catalogue.
 */
export const catalogIndex = (ctx) => ({
  moods: ctx.data.moods.map((m) => m.slug),
  genres: ctx.data.genres.map((g) => g.slug),
  moodNames: Object.fromEntries(ctx.data.moods.map((m) => [m.slug, m.name])),
  genreNames: Object.fromEntries(ctx.data.genres.map((g) => [g.slug, g.name])),
  tropes: ctx.data.tropes.map((t) => ({ s: t.slug, n: t.name })),
  feelings: ctx.feelings.map((f) => ({
    s: f.slug,
    words: f.words,
    wants: f.wants.map((w) => w.mood),
  })),
  books: ctx.published.map((b) => ({
    s: b.slug,
    t: b.title,
    a: b.author,
    y: b.firstPublished,
    i: b.isbn13,
    g: b.genres,
    m: b.moods,
    tr: b.tropes,
    w: b.warnings,
    l: b.length,
    p: b.pace,
    sold: b.soldMillions ?? 0,
    users: ctx.hc(b.slug)?.usersCount ?? 0,
    c: coverRef(b.isbn13),
  })),
});
