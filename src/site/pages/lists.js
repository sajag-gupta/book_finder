import { esc } from '../html.js';
import { icon } from '../icons.js';
import { layout } from '../layout.js';
import {
  cardGrid,
  cover,
  moodChip,
  pageCount,
  pageHref,
  pageSlice,
  pager,
  sectionHead,
  signupForm,
} from '../components.js';
import { allStores } from '../../shared/registry.js';
import { FORMAT_ORDER, FORMAT_TITLES } from '../../shared/offers.js';

const head = ({ kicker, title, lede, iconName }) =>
  `<header class="pagehead">${iconName ? `<span class="pagehead__icon">${icon(iconName, { size: 30 })}</span>` : ''}${kicker ? `<p class="kicker">${esc(kicker)}</p>` : ''}<h1>${esc(title)}</h1>${lede ? `<p class="lede">${esc(lede)}</p>` : ''}</header>`;

const page = (ctx, { path, title, description, body, noindex, breadcrumbs, structuredData }) =>
  layout({
    site: ctx.site,
    path,
    title,
    description,
    body: `<section class="wrap page">${body}</section>`,
    noindex,
    breadcrumbs,
    structuredData,
  });

/** Fields every page of a long list shares: its own URL, a "page N" title and the page links. */
function paging(base, title, books, pageNum) {
  const pages = pageCount(books.length);
  return {
    pages,
    path: pageHref(base, pageNum),
    title: pageNum > 1 ? `${title}, page ${pageNum}` : title,
    suffix: pageNum > 1 ? ` Page ${pageNum} of ${pages}.` : '',
    list: pageSlice(books, pageNum),
    nav: pager(base, pageNum, pages),
  };
}

/** ItemList markup for a page that is mainly a list of books. */
const listData = (ctx, name, books) => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name,
  mainEntity: {
    '@type': 'ItemList',
    numberOfItems: books.length,
    itemListElement: books.slice(0, 20).map((b, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${ctx.site.url}/books/${b.slug}/`,
      name: b.title,
    })),
  },
});

export function moodPage(ctx, mood, pageNum = 1) {
  const books = ctx.byMood.get(mood.slug) ?? [];
  const pg = paging(`/moods/${mood.slug}/`, `${mood.name} books`, books, pageNum);
  const others = ctx.data.moods
    .filter((m) => m.slug !== mood.slug && ctx.byMood.has(m.slug))
    .slice(0, 8);
  return page(ctx, {
    path: pg.path,
    title: pg.title,
    breadcrumbs: [['Moods', '/moods/'], [pg.title]],
    structuredData: listData(ctx, pg.title, pg.list),
    description: `${mood.blurb} ${books.length} books for when you want something ${mood.name.toLowerCase()}, best sellers first.${pg.suffix}`,
    body: `${head({ kicker: `${books.length} books`, title: `${mood.name} books`, lede: mood.blurb, iconName: mood.icon })}
${cardGrid(pg.list, ctx)}${pg.nav}
<section class="section">${sectionHead({ title: 'Try another mood', href: '/moods/', linkText: 'All moods' })}<ul class="chips chips--small">${others.map((m) => `<li>${moodChip(m, { blurb: false })}</li>`).join('')}</ul></section>`,
  });
}

export function moodsIndexPage(ctx) {
  const moods = ctx.data.moods.filter((m) => ctx.byMood.has(m.slug));
  return page(ctx, {
    path: '/moods/',
    breadcrumbs: [['Moods']],
    title: 'Pick a book by mood',
    description: 'How do you want to feel? Choose a mood and get books that deliver it.',
    body: `${head({ kicker: 'Start here', title: 'How do you want to feel?', lede: 'Pick a mood and we will show you the books that deliver it.' })}
<ul class="chips">${moods.map((m) => `<li>${moodChip(m)}</li>`).join('')}</ul>`,
  });
}

export function genrePage(ctx, genre, pageNum = 1) {
  const books = ctx.byGenre.get(genre.slug) ?? [];
  const pg = paging(
    `/genres/${genre.slug}/`,
    `Best ${genre.name.toLowerCase()} books`,
    books,
    pageNum,
  );
  return page(ctx, {
    path: pg.path,
    title: pg.title,
    breadcrumbs: [['Genres', '/genres/'], [pg.title]],
    structuredData: listData(ctx, pg.title, pg.list),
    description: `${genre.blurb} ${books.length} ${genre.name.toLowerCase()} picks, best sellers first.${pg.suffix}`,
    body: `${head({ kicker: `${books.length} books`, title: genre.name, lede: genre.blurb, iconName: genre.icon })}
<p class="more-line"><a class="more" href="/books/?genre=${esc(genre.slug)}">Filter ${esc(genre.name.toLowerCase())} by mood, length and pace${icon('arrow-right', { size: 16 })}</a></p>
${cardGrid(pg.list, ctx)}${pg.nav}`,
  });
}

export function genresIndexPage(ctx) {
  const genres = ctx.data.genres.filter((g) => ctx.byGenre.has(g.slug));
  return page(ctx, {
    path: '/genres/',
    breadcrumbs: [['Genres']],
    title: 'Browse by genre',
    description: 'From cozy fantasy to crime and classics: browse books by genre.',
    body: `${head({ kicker: 'Browse', title: 'Genres', lede: 'Find your corner of the shelf.' })}
<ul class="tiles">${genres.map((g) => `<li><a class="tile tile--${esc(g.color)}" href="/genres/${esc(g.slug)}/">${icon(g.icon, { size: 26 })}<span class="tile__name">${esc(g.name)}</span><span class="tile__count">${ctx.byGenre.get(g.slug).length} books</span></a></li>`).join('')}</ul>`,
  });
}

/** Tropes with at least three books get a page; fewer would be a thin page. */
export const tropesWithPages = (ctx) =>
  ctx.data.tropes.filter((t) => (ctx.byTrope.get(t.slug)?.length ?? 0) >= 3);

export function tropePage(ctx, trope, pageNum = 1) {
  const books = ctx.byTrope.get(trope.slug) ?? [];
  const pg = paging(`/tropes/${trope.slug}/`, `${trope.name} books`, books, pageNum);
  return page(ctx, {
    path: pg.path,
    title: pg.title,
    breadcrumbs: [['Tropes', '/tropes/'], [pg.title]],
    structuredData: listData(ctx, pg.title, pg.list),
    description: `${books.length} books built around the ${trope.name.toLowerCase()} trope, best sellers first.${pg.suffix}`,
    body: `${head({ kicker: 'Trope', title: `${trope.name} books`, lede: `${books.length} books where the ${trope.name.toLowerCase()} trope is a big part of the story.` })}${cardGrid(pg.list, ctx)}${pg.nav}`,
  });
}

export function tropesIndexPage(ctx) {
  const tropes = tropesWithPages(ctx).sort(
    (a, b) => ctx.byTrope.get(b.slug).length - ctx.byTrope.get(a.slug).length,
  );
  return page(ctx, {
    path: '/tropes/',
    breadcrumbs: [['Tropes']],
    title: 'Browse by trope',
    description:
      'Enemies to lovers, found family, slow burn and more: find books by the tropes you love.',
    body: `${head({ kicker: 'Browse', title: 'Tropes', lede: 'Looking for a particular kind of story? Start with the trope.' })}
<ul class="tags tags--big">${tropes.map((t) => `<li><a class="tag tag--link" href="/tropes/${esc(t.slug)}/">${esc(t.name)} <span class="muted">${ctx.byTrope.get(t.slug).length}</span></a></li>`).join('')}</ul>`,
  });
}

export function authorPage(ctx, slug, pageNum = 1) {
  const books = ctx.byAuthor.get(slug) ?? [];
  const name = books[0].author;
  const pg = paging(`/authors/${slug}/`, `${name} books`, books, pageNum);
  return page(ctx, {
    path: pg.path,
    title: pg.title,
    breadcrumbs: [[pg.title]],
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'Person', name, url: `${ctx.site.url}/authors/${slug}/` },
        listData(ctx, pg.title, pg.list),
      ],
    },
    description: `${books.length} books by ${name}, with moods, content warnings and every way to get them.${pg.suffix}`,
    body: `${head({ kicker: 'Author', title: name, lede: `${books.length} books on this site.` })}${cardGrid(pg.list, ctx)}${pg.nav}`,
  });
}

export const authorsWithPages = (ctx) =>
  [...ctx.byAuthor.entries()].filter(([, books]) => books.length >= 2).map(([slug]) => slug);

export function bestsellersPage(ctx) {
  const list = ctx.topSellers;
  const rows = list
    .map(
      (b, i) => `<li class="rankrow"><span class="rankrow__n">${i + 1}</span>
  <a class="rankrow__cover" href="/books/${esc(b.slug)}/" tabindex="-1" aria-hidden="true">${cover(b, { width: 64, height: 96 })}</a>
  <div class="rankrow__body"><a class="rankrow__title" href="/books/${esc(b.slug)}/">${esc(b.title)}</a><span class="muted">${esc(b.author)} · ${esc(b.firstPublished)}</span></div>
  <span class="rankrow__sold"><strong>${esc(b.soldMillions)}M</strong><span class="muted small">copies, est.</span></span></li>`,
    )
    .join('');
  return page(ctx, {
    path: '/bestsellers/',
    title: 'Best-selling books of all time',
    description: `The ${list.length} best-selling novels of all time with published sales estimates, from Dickens to Colleen Hoover.`,
    body: `${head({ kicker: 'Sold by the million', title: 'Best-selling books of all time', lede: 'Ranked by the most widely published sales estimate for each title.', iconName: 'award' })}
<aside class="notice" role="note">${icon('info', { size: 20 })}<p>Sales figures are estimates compiled from public sources, and they vary widely: older titles are counted across many editions and translations, and publishers do not release exact numbers. Treat the ranking as a guide, not a ruling.</p></aside>
<ol class="rankings">${rows}</ol>
<section class="section">${sectionHead({ kicker: 'Not on the sales lists', title: 'Modern favourites', href: '/books/?sort=newest', linkText: 'See newer books' })}${cardGrid(ctx.modern.slice(0, 12), ctx)}</section>`,
  });
}

export function booksLikePage(ctx, book) {
  const picks = ctx.pairings(book);
  return page(ctx, {
    path: `/books-like/${book.slug}/`,
    title: `Books like ${book.title}`,
    description: `If you loved ${book.title} by ${book.author}, these picks come with a plain reason for each.`,
    body: `${head({ kicker: 'If you loved', title: `Books like ${book.title}`, lede: `${book.title} by ${book.author}: what to read next, and why.` })}
<div class="booksLike__src">${cover(book, { width: 96, height: 144 })}<p><a href="/books/${esc(book.slug)}/">Back to ${esc(book.title)}</a></p></div>
${cardGrid(
  picks.map((p) => ctx.bySlug.get(p.slug)),
  ctx,
  { reasons: picks.map((p) => p.reason) },
)}`,
  });
}

export function shelfPage(ctx) {
  const names = Object.fromEntries(ctx.data.genres.map((g) => [g.slug, g.name]));
  return layout({
    site: ctx.site,
    path: '/shelf/',
    title: 'My shelf',
    description: 'Books you have saved, are reading or have read, kept on this device.',
    noindex: true,
    scripts: ['shelf'],
    body: `<section class="wrap page" data-shelf-app>${head({ kicker: 'Saved on this device', title: 'My shelf', lede: 'Track what you want to read, are reading and have read. It lives in this browser only: nothing is sent to us.', iconName: 'bookmark' })}
<div class="stats panel" data-stats hidden></div>
<div class="tabs" data-tabs role="group" aria-label="Filter by status"></div>
<ul class="grid" data-shelf></ul>
<p class="empty" data-shelf-empty hidden>Nothing here yet. Tap the bookmark on any book, or import your shelf below.</p>
<section class="panel tools" aria-labelledby="tools-h"><h2 id="tools-h">Import and back up</h2>
  <div class="tools__row"><label class="btn btn--ghost">${icon('upload', { size: 18 })}Import Goodreads or StoryGraph CSV<input class="sr-only" type="file" accept=".csv,text/csv" data-import></label>
  <button type="button" class="btn btn--ghost" data-export>${icon('download', { size: 18 })}Download backup</button>
  <label class="btn btn--ghost">${icon('upload', { size: 18 })}Restore backup<input class="sr-only" type="file" accept=".json,application/json" data-restore></label></div>
  <p class="muted small">Export your library from Goodreads (My Books, Import and export) or StoryGraph (Manage account), then pick the file here. It is read in your browser and never uploaded. Books we do not list are skipped.</p>
  <p role="status" data-import-msg></p>
</section>
<script type="application/json" id="genre-names">${JSON.stringify(names).replace(/</g, '\u003c')}</script>
<p><a class="btn btn--accent" href="/books/">Browse books</a></p></section>`,
  });
}

/** One static shell that /api/book fills in for any book outside our catalogue. */
export function lookupPage(ctx) {
  const stores = allStores.map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.kind,
    label: s.label,
    q: s.plain.includes('{query}'),
  }));
  const titles = Object.fromEntries(FORMAT_ORDER.map((kind) => [kind, FORMAT_TITLES[kind]]));
  const json = (value) => JSON.stringify(value).replace(/</g, '\u003c');
  return layout({
    site: ctx.site,
    path: '/b/',
    title: 'Book details',
    description: 'Where to borrow, buy or listen to this book.',
    noindex: true,
    scripts: ['lookup'],
    body: `<article class="wrap book" data-lookup>
<p class="lede" role="status" data-status>Looking up this book...</p>
<div data-body hidden>
  <div class="book__hero">
    <div class="book__cover" data-cover></div>
    <div class="book__intro">
      <p class="kicker">Book details</p>
      <h1 data-title></h1>
      <p class="byline" data-author></p>
      <dl class="facts" data-facts></dl>
      <ul class="tags" data-subjects aria-label="Subjects"></ul>
      <p class="muted">We have not written about this book yet. Here is where to get it, library first.</p>
    </div>
  </div>
  <section class="panel offers" aria-labelledby="offers-h"><h2 id="offers-h">Where to get it</h2><div data-offers></div></section>
  <p><a class="more" href="/books/">Browse our hand-picked books${icon('arrow-right', { size: 16 })}</a></p>
</div>
<script type="application/json" id="stores">${json(stores)}</script>
<script type="application/json" id="format-titles">${json(titles)}</script>
</article>`,
  });
}

export function subscribedPage(ctx, ok = true) {
  return layout({
    site: ctx.site,
    path: ok ? '/subscribed/' : '/subscribe-error/',
    title: ok ? 'Check your email' : 'Could not subscribe',
    description: ok
      ? 'One more step to confirm your subscription.'
      : 'Something went wrong subscribing.',
    noindex: true,
    body: `<section class="wrap page prose">${ok ? `<h1>Check your email</h1><p>We sent a confirmation link. Click it and you will get three hand-picked books each week.</p>` : `<h1>That did not work</h1><p>Please check the address and try again.</p>${signupForm('retry-signup')}`}<p><a href="/">Back to the home page</a></p></section>`,
  });
}

export function howWePickPage(ctx) {
  return page(ctx, {
    path: '/about/how-we-pick/',
    title: 'How we pick',
    description: 'How our recommendations are written, checked and kept free of paid placements.',
    body: `<div class="prose">${head({ kicker: 'About', title: 'How we pick' })}
<p>Every description, mood tag and content warning on this site is written by us, in our own words. We do not copy publisher blurbs, reviews or other sites&rsquo; lists.</p>
<h2>Two levels of checking</h2>
<p><strong>Reviewed</strong> books have been read by an editor, who checked the details against at least two public sources and signed off.</p>
<p><strong>Facts checked</strong> books have had their title, author, first-publication year and edition verified automatically against Open Library and Wikipedia. Their descriptions and tags are written by us but have not yet been read by an editor, and the page says so. We are working through them.</p>
<h2>Ratings and reader data</h2>
<p>Reader ratings, reader counts, page counts, series order and reader-reported content warnings come from Hardcover, credited wherever they appear. Everything we write about a book is our own.</p>
<h2>Bestseller rankings</h2>
<p>Sales figures are estimates from public sources and vary widely. We show them as approximate and never as exact.</p>
<h2>Money and honesty</h2>
<p>Sponsored placements, if we ever have any, will be labelled and kept out of mood results. We never hide a cheaper option to push a commission, and library borrowing is always shown first.</p>
<p>We do not host, link to or help you find pirated copies. If we get something wrong, tell us and we will fix it.</p></div>`,
  });
}

export function disclosurePage(ctx) {
  return page(ctx, {
    path: '/about/affiliate-disclosure/',
    title: 'Affiliate disclosure',
    description: 'How this site earns money from store links, and what that does not change.',
    body: `<div class="prose">${head({ kicker: 'About', title: 'Affiliate disclosure' })}
<p>Some buttons on this site are affiliate links. If you buy after clicking one, the store may pay us a commission. It costs you nothing extra.</p>
<p>Offers are ordered by lowest price first. Where prices tie, we may list the store that pays us more first. We never hide a cheaper option, and library borrowing is always shown, even though it earns us nothing.</p>
<p>Kobo links use our Rakuten Advertising partnership (Kobo US). Bookshop.org and Libro.fm links use Awin once those programs approve us. Buttons that go to a store without a partner program are plain links.</p></div>`,
  });
}

export function notFoundPage(ctx) {
  return layout({
    site: ctx.site,
    path: '/404.html',
    title: 'Page not found',
    description: 'That page does not exist.',
    noindex: true,
    body: `<section class="wrap page prose"><h1>Page not found</h1><p>That page has wandered off. Try the search above, or <a href="/books/">browse all books</a>.</p></section>`,
  });
}
