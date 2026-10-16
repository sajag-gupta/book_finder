import { esc } from './html.js';
import { layout, withScript, withSearchScript } from './layout.js';
import { goPath } from '../shared/links.js';
import { allStores } from '../shared/registry.js';
import { FORMAT_ORDER, FORMAT_TITLES, rankOffers } from '../shared/offers.js';

const coverUrl = (isbn13) => `https://covers.openlibrary.org/b/isbn/${isbn13}-L.jpg`;
const names = (slugs, vocab) =>
  slugs.map((slug) => vocab.find((v) => v.slug === slug)?.name ?? slug);
const chips = (items, className = 'tag') =>
  items.map((item) => `<li class="${className}">${esc(item)}</li>`).join('');

/** Everything a page needs to link between books: only published books are ever referenced. */
export function createContext({ data, site }) {
  const published = data.books.filter((b) => site.includeDrafts || b.status === 'reviewed');
  const bySlug = new Map(published.map((b) => [b.slug, b]));
  const pairings = (book) => (book.pairings ?? []).filter((p) => bySlug.has(p.slug));
  return { data, site, published, bySlug, pairings };
}

function bookCard(book, ctx, reason) {
  return `<li class="card">
  <a class="card-link" href="/books/${esc(book.slug)}/">
    <img src="${esc(coverUrl(book.isbn13))}" alt="Cover of ${esc(book.title)}" width="80" height="120" loading="lazy">
    <span class="card-text"><strong>${esc(book.title)}</strong> <span class="muted">${esc(book.author)}</span>
    ${reason ? `<span class="reason">${esc(reason)}</span>` : ''}</span>
  </a>
</li>`;
}

export function homePage(ctx) {
  const { data, site } = ctx;
  const moodChips = data.moods
    .filter((m) => m.featured && ctx.published.some((b) => b.moods.includes(m.slug)))
    .map(
      (m) =>
        `<li><a class="chip chip-${esc(m.color)}" href="/moods/${esc(m.slug)}/">${esc(m.name)}<span>${esc(m.blurb)}</span></a></li>`,
    )
    .join('');
  const body = ctx.published.length
    ? `<section class="hero">
  <h1>How do you want to feel?</h1>
  <ul class="chips" aria-label="Moods">${moodChips}</ul>
  <form class="search" role="search" action="/books/" method="get">
    <label for="q">Or name a book you loved</label>
    <input id="q" name="q" type="search" autocomplete="off" placeholder="Try &ldquo;Fourth Wing&rdquo;">
    <ul id="results" class="results" aria-live="polite"></ul>
  </form>
</section>`
    : `<section class="hero">
  <h1>How do you want to feel?</h1>
  <p class="lede">We check every pick by hand before it goes live, and our first ones are almost ready. Check back soon.</p>
</section>`;
  return withSearchScript(
    layout({
      site,
      path: '/',
      title: `${site.name}: find your next read by mood`,
      description:
        'Pick a book by how you want to feel, then see every way to buy, borrow or listen to it, with the cheapest option marked.',
      body,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: site.name,
        url: site.url,
      },
    }),
  );
}

export function booksIndexPage(ctx) {
  const items = [...ctx.published]
    .sort((a, b) => a.title.localeCompare(b.title))
    .map((b) => bookCard(b, ctx))
    .join('');
  return layout({
    site: ctx.site,
    path: '/books/',
    title: 'All books',
    description: 'Every book we have written up, with moods, content warnings and where to get it.',
    body: `<section class="page"><h1>All books</h1><ul class="cards">${items}</ul></section>`,
  });
}

export function moodPage(ctx, mood) {
  const books = ctx.published.filter((b) => b.moods.includes(mood.slug));
  return layout({
    site: ctx.site,
    path: `/moods/${mood.slug}/`,
    title: `${mood.name} books`,
    description: `${mood.blurb} Picks for when you want something ${mood.name.toLowerCase()}, each with a plain reason.`,
    body: `<section class="page"><h1>${esc(mood.name)} books</h1><p class="lede">${esc(mood.blurb)}</p>
<ul class="cards">${books.map((b) => bookCard(b, ctx)).join('')}</ul></section>`,
  });
}

export function booksLikePage(ctx, book) {
  const picks = ctx
    .pairings(book)
    .map((p) => bookCard(ctx.bySlug.get(p.slug), ctx, p.reason))
    .join('');
  return layout({
    site: ctx.site,
    path: `/books-like/${book.slug}/`,
    title: `Books like ${book.title}`,
    description: `If you loved ${book.title} by ${book.author}, these picks come with a plain reason for each.`,
    body: `<section class="page"><h1>Books like ${esc(book.title)}</h1>
<p class="lede">If you loved <a href="/books/${esc(book.slug)}/">${esc(book.title)}</a> by ${esc(book.author)}, try these.</p>
<ul class="cards">${picks}</ul></section>`,
  });
}

function offersTable(book, ctx) {
  const query = `${book.title} ${book.author}`;
  const feed = new Map((ctx.data.offers[book.isbn13] ?? []).map((o) => [o.store, o]));
  // Feed entries name their store by id, so the store object must be applied last.
  const rows = rankOffers(allStores.map((store) => ({ ...(feed.get(store.id) ?? {}), store })));
  const money = (o) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: o.currency ?? 'USD' }).format(
      o.price,
    );

  const sections = FORMAT_ORDER.map((kind) => {
    const group = rows.filter((o) => o.store.kind === kind);
    if (!group.length) return '';
    const body = group
      .map((o) => {
        const href = goPath(
          o.store.id,
          book.isbn13,
          o.store.plain.includes('{query}') ? query : '',
        );
        const price =
          o.store.kind === 'library'
            ? 'Free with a library card'
            : typeof o.price === 'number'
              ? money(o)
              : 'Check price';
        const badge = o.isLowest ? ' <span class="badge">Lowest price</span>' : '';
        const rel =
          o.store.kind === 'library' ? 'nofollow noopener' : 'sponsored nofollow noopener';
        return `<tr><td>${esc(o.store.name)}${badge}</td><td>${esc(price)}</td>
<td><a class="btn${o.store.kind === 'library' ? ' btn-library' : ''}" href="${esc(href)}" rel="${rel}" target="_blank">${esc(o.store.label)}<span class="sr-only"> from ${esc(o.store.name)}</span></a></td></tr>`;
      })
      .join('\n');
    return `<tbody><tr class="group"><th scope="rowgroup" colspan="3">${esc(FORMAT_TITLES[kind])}</th></tr>
${body}</tbody>`;
  }).join('\n');

  return `<section class="offers" aria-labelledby="offers-h">
<h2 id="offers-h">Where to get it</h2>
<table><thead><tr><th scope="col">Store</th><th scope="col">Price</th><th scope="col"><span class="sr-only">Link</span></th></tr></thead>
${sections}</table>
<p class="muted small">Prices appear here as retailer feeds are connected. Where none is shown, check the store.
Opens the store in a new tab.</p>
</section>`;
}

function seriesBlock(book, ctx) {
  const series = ctx.data.series.find((s) => s.slug === book.series?.slug);
  if (!series) return '';
  const items = series.books
    .map((entry) => {
      const owned = ctx.published.find(
        (b) => b.series?.slug === series.slug && b.series.position === entry.position,
      );
      const label =
        esc(entry.title) + (entry.note ? ` <span class="muted">(${esc(entry.note)})</span>` : '');
      const mark = owned?.slug === book.slug ? ' aria-current="true"' : '';
      const link =
        owned && owned.slug !== book.slug
          ? `<a href="/books/${esc(owned.slug)}/">${label}</a>`
          : label;
      return `<li${mark}><span class="muted">${esc(entry.position)}.</span> ${link}</li>`;
    })
    .join('');
  return `<section aria-labelledby="series-h"><h2 id="series-h">Reading order: ${esc(series.name)}</h2>
<ul class="series">${items}</ul></section>`;
}

export function bookPage(ctx, book) {
  const { data } = ctx;
  const picks = ctx.pairings(book);
  const warnings = names(book.warnings, data.warnings);
  const meta = [
    book.firstPublished,
    `${book.pace} pace`,
    `${book.length} length`,
    book.series ? `book ${book.series.position} of a series` : 'standalone',
  ];
  const body = `<article class="book">
<div class="book-head">
  <img class="cover" src="${esc(coverUrl(book.isbn13))}" alt="Cover of ${esc(book.title)}" width="200" height="300">
  <div>
    <h1>${esc(book.title)}</h1>
    <p class="byline">by ${esc(book.author)}</p>
    <p class="muted">${meta.map(esc).join(' · ')}</p>
    <p>${esc(book.summary)}</p>
  </div>
</div>
<div class="read-if">
  <p><strong>Read this if</strong> ${esc(book.readIf)}</p>
  <p><strong>Skip this if</strong> ${esc(book.skipIf)}</p>
</div>
<ul class="tags" aria-label="Moods and tropes">${chips(names(book.moods, data.moods), 'tag tag-mood')}${chips(names(book.tropes, data.tropes))}</ul>
<section aria-labelledby="cw-h"><h2 id="cw-h">Content warnings</h2>
${warnings.length ? `<ul class="tags">${chips(warnings, 'tag tag-warn')}</ul>` : '<p>None noted yet.</p>'}</section>
${offersTable(book, ctx)}
${seriesBlock(book, ctx)}
<section aria-labelledby="share-h"><h2 id="share-h">Share this pick</h2>
<img class="share-preview" src="/share/${esc(book.slug)}.png" alt="Share card for ${esc(book.title)}" width="270" height="338" loading="lazy">
<p><a class="btn" href="/share/${esc(book.slug)}.png" download="${esc(book.slug)}-share-card.png">Download share card</a>
<button type="button" class="btn btn-ghost" data-share data-title="${esc(book.title)}" data-url="${esc(ctx.site.url)}/books/${esc(book.slug)}/" hidden>Share link</button></p></section>
${
  picks.length
    ? `<section aria-labelledby="like-h"><h2 id="like-h">If you loved ${esc(book.title)}</h2>
<ul class="cards">${picks.map((p) => bookCard(ctx.bySlug.get(p.slug), ctx, p.reason)).join('')}</ul>
<p><a href="/books-like/${esc(book.slug)}/">See all books like ${esc(book.title)}</a></p></section>`
    : ''
}
</article>`;
  return withScript(
    layout({
      site: ctx.site,
      path: `/books/${book.slug}/`,
      title: `${book.title} by ${book.author}: where to buy or borrow`,
      description: `${book.summary} Compare print, ebook, audiobook, used and library options.`,
      image: `/share/${book.slug}-og.png`,
      body,
      structuredData: {
        '@context': 'https://schema.org',
        '@type': 'Book',
        name: book.title,
        author: { '@type': 'Person', name: book.author },
        isbn: book.isbn13,
        datePublished: String(book.firstPublished),
      },
    }),
    'share',
  );
}

export function howWePickPage(ctx) {
  return layout({
    site: ctx.site,
    path: '/about/how-we-pick/',
    title: 'How we pick',
    description: 'How our recommendations are written, checked and kept free of paid placements.',
    body: `<section class="page prose"><h1>How we pick</h1>
<p>Every reason, mood tag and content warning on this site is written by us, in our own words. We do not copy publisher blurbs, reviews or other sites&rsquo; lists.</p>
<p>Each book is checked against at least two public sources by a person before it is published. If we get something wrong, tell us and we will fix it.</p>
<p>Sponsored placements, if we ever have any, will be labelled and kept out of mood results. We never hide a cheaper option to push a commission.</p>
<p>We do not host, link to or help you find pirated copies.</p></section>`,
  });
}

export function disclosurePage(ctx) {
  return layout({
    site: ctx.site,
    path: '/about/affiliate-disclosure/',
    title: 'Affiliate disclosure',
    description: 'How this site earns money from store links, and what that does not change.',
    body: `<section class="page prose"><h1>Affiliate disclosure</h1>
<p>Some buttons on this site are affiliate links. If you buy after clicking one, the store may pay us a commission. It costs you nothing extra.</p>
<p>Offers are ordered by lowest price first. Where prices tie, we may list the store that pays us more first. We never hide a cheaper option, and library borrowing is always shown, even though it earns us nothing.</p>
<p>Buttons that go to a store without a partner program are plain links.</p></section>`,
  });
}

export function notFoundPage(ctx) {
  return layout({
    site: ctx.site,
    path: '/404.html',
    title: 'Page not found',
    description: 'That page does not exist.',
    noindex: true,
    body: `<section class="page"><h1>Page not found</h1><p><a href="/">Back to the home page</a></p></section>`,
  });
}
