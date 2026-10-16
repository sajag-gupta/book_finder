import { esc } from '../html.js';
import { icon } from '../icons.js';
import { layout } from '../layout.js';
import { bookCard } from '../components.js';

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

/** All books with client-side filters. Without JavaScript the full list is still readable. */
export function browsePage(ctx) {
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
    <div class="search search--block">${icon('search', { size: 18, className: 'search__icon' })}<input id="bq" type="search" name="q" placeholder="Title or author" autocomplete="off"></div>
    <label class="select"><span class="sr-only">Sort by</span>
      <select name="sort"><option value="top">Top sellers first</option><option value="az">Title A to Z</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select>
    </label>
  </div>
  <details class="facet" open><summary>Genre ${icon('chevron-down', { size: 16 })}</summary><div class="facet__body">${genres.map((g) => checkbox('genre', g.slug, g.name, ctx.byGenre.get(g.slug).length)).join('')}</div></details>
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
      <ul class="grid grid--browse" data-results>${books.map((b) => bookCard(b, ctx, { filterable: true })).join('')}</ul>
      <p class="empty" data-empty hidden>No books match those filters. Try clearing one.</p>
      <button type="button" class="btn btn--ghost more-btn" data-more hidden>Show more</button>
    </div>
  </div>
</section>`;

  return layout({
    site,
    path: '/books/',
    title: 'Browse all books',
    description: `Browse ${books.length} books by genre, mood, length and pace, with content warnings and every way to get them.`,
    body,
    scripts: ['browse'],
  });
}
