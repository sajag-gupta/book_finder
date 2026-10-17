import { esc } from '../html.js';
import { icon } from '../icons.js';
import { layout } from '../layout.js';
import { cardGrid, pageCount, pageHref, pageSlice, pager } from '../components.js';

const LENGTHS = [
  ['short', 'Under 300 pages'],
  ['medium', '300 to 450 pages'],
  ['long', 'Over 450 pages'],
];
const PACES = [
  ['slow', 'Slow and immersive'],
  ['medium', 'Steady'],
  ['fast', 'Fast'],
];
const AVOID = [
  'violence',
  'sexual-content',
  'death',
  'abuse',
  'war',
  'suicide',
  'animal-death',
  'gore',
];

const checkbox = (name, value, label, count) =>
  `<label class="check"><input type="checkbox" name="${name}" value="${esc(value)}"><span>${esc(label)}</span>${count === undefined ? '' : `<span class="check__n">${count}</span>`}</label>`;

/**
 * All books. The server renders one page of the list (with numbered page links, so every book is
 * reachable without JavaScript); the script loads the catalogue index for filters, search and sorting.
 */
export function browsePage(ctx, pageNum = 1) {
  const { data, site } = ctx;
  const genres = data.genres.filter((g) => ctx.byGenre.has(g.slug));
  const moods = data.moods.filter((m) => ctx.byMood.has(m.slug));
  const warnings = AVOID.map((slug) => data.warnings.find((w) => w.slug === slug)).filter(Boolean);
  const books = [...ctx.published].sort(
    (a, b) => (b.soldMillions ?? 0) - (a.soldMillions ?? 0) || a.title.localeCompare(b.title),
  );

  const filters = `<form class="filters" data-filters aria-label="Filter books">
  <div class="filters__top">
    <label class="sr-only" for="bq">Search within results</label>
    <div class="search search--block">${icon('search', { size: 18, className: 'search__icon' })}<input id="bq" type="search" name="q" placeholder="Title or author…" autocomplete="off" enterkeyhint="search"><button class="search__btn" type="submit" aria-label="Search">${icon('search', { size: 18 })}</button></div>
    <label class="select"><span class="sr-only">Sort by</span>
      <select name="sort"><option value="top">Top sellers first</option><option value="popular">Most read on Hardcover</option><option value="az">Title A to Z</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
    </label>
  </div>
  <details class="facet facet--long"><summary>Genre ${icon('chevron-down', { size: 16 })}</summary><div class="facet__body">${genres.map((g) => checkbox('genre', g.slug, g.name, ctx.byGenre.get(g.slug).length)).join('')}</div></details>
  <details class="facet" open><summary>Mood ${icon('chevron-down', { size: 16 })}</summary><div class="facet__body">${moods.map((m) => checkbox('mood', m.slug, m.name, ctx.byMood.get(m.slug).length)).join('')}</div></details>
  <details class="facet"><summary>Length ${icon('chevron-down', { size: 16 })}</summary><div class="facet__body">${LENGTHS.map(([v, l]) => checkbox('length', v, l)).join('')}</div></details>
  <details class="facet"><summary>Pace ${icon('chevron-down', { size: 16 })}</summary><div class="facet__body">${PACES.map(([v, l]) => checkbox('pace', v, l)).join('')}</div></details>
  <details class="facet"><summary>Hide books with ${icon('chevron-down', { size: 16 })}</summary><div class="facet__body">${warnings.map((w) => checkbox('avoid', w.slug, w.name)).join('')}</div></details>
  <button type="button" class="btn btn--ghost" data-reset>Clear filters</button>
</form>`;

  const body = `<section class="wrap page page--browse">
  <header class="pagehead"><p class="kicker">The whole catalogue</p><h1>Browse all books</h1>
  <p class="lede">Filter by genre, mood, length and pace, or hide content you would rather avoid.</p></header>
  <div class="browse">
    <aside class="browse__side">${filters}</aside>
    <div class="browse__main">
      <p class="results-count" role="status" data-count>${books.length} books</p>
      <div data-results-wrap>${cardGrid(pageSlice(books, pageNum), ctx).replace('class="grid"', 'class="grid grid--browse" data-results')}</div>
      <div data-pager>${pager('/books/', pageNum, pageCount(books.length))}</div>
      <p class="empty" data-empty hidden>None of our hand-picked books match those filters. Try clearing one.</p>
      <section class="section" data-remote hidden aria-live="polite">
        <h2>More books matching &ldquo;<span data-remote-q></span>&rdquo;</h2>
        <p class="muted">From Open Library. We have not written about these yet, but you can still see where to borrow, buy or listen to them.</p>
        <p class="remote-status" data-remote-status hidden></p>
        <ul class="grid" data-remote-list></ul>
      </section>
      <button type="button" class="btn btn--ghost more-btn" data-more hidden>Show more</button>
    </div>
  </div>
</section>`;

  return layout({
    site,
    path: pageHref('/books/', pageNum),
    breadcrumbs: [['Browse all books']],
    title: pageNum > 1 ? `Browse all books, page ${pageNum}` : 'Browse all books',
    description: `Browse ${books.length} books by genre, mood, length and pace, with content warnings and every way to get them.${pageNum > 1 ? ` Page ${pageNum} of ${pageCount(books.length)}.` : ''}`,
    body,
    scripts: ['browse'],
  });
}
