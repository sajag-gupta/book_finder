import { existsSync, readFileSync } from 'node:fs';
import { esc } from './html.js';
import { icon } from './icons.js';

const manifest = new URL('../../data/covers.json', import.meta.url);
// data/covers.json (npm run covers) records which image really exists for each book.
const covers = existsSync(manifest) ? JSON.parse(readFileSync(manifest, 'utf8')) : {};

/** Short code for a known cover: "o123" is Open Library cover id 123, "gXYZ" a Google Books volume. */
export function coverRef(isbn13) {
  const c = covers[isbn13];
  return c?.ol ? `o${c.ol}` : c?.gb ? `g${c.gb}` : null;
}

/** Image address for a book, or null when we know there is none (the generated cover shows). */
export function coverUrl(isbn13, size = 'M') {
  const ref = coverRef(isbn13);
  if (ref?.startsWith('o'))
    return `https://covers.openlibrary.org/b/id/${ref.slice(1)}-${size}.jpg?default=false`;
  if (ref?.startsWith('g'))
    return `https://books.google.com/books/content?id=${ref.slice(1)}&printsec=frontcover&img=1&zoom=${size === 'L' ? 2 : 1}`;
  if (isbn13 in covers) return null;
  return `https://covers.openlibrary.org/b/isbn/${isbn13}-${size}.jpg?default=false`;
}

/** Stable 0-35 bucket from a slug, so each book keeps the same fallback cover colour. */
export function hue(slug) {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) % 36;
  return h;
}

/**
 * A cover: a generated typographic cover underneath, with the real cover image on top. If the image
 * is missing (Open Library has no cover for many editions) site.js removes it and the generated
 * cover shows.
 */
export function cover(book, { size = 'M', width = 160, height = 240, eager = false } = {}) {
  const src = coverUrl(book.isbn13, size);
  return `<span class="cover hue-${hue(book.slug)}">
<span class="cover__fallback" aria-hidden="true"><span class="cover__title">${esc(book.title)}</span><span class="cover__author">${esc(book.author)}</span></span>
${src ? `<img src="${esc(src)}" alt="Cover of ${esc(book.title)}" width="${width}" height="${height}" ${eager ? '' : 'loading="lazy"'} decoding="async" data-cover>` : ''}
</span>`;
}

export function saveButton(book) {
  return `<button type="button" class="save" data-save="${esc(book.slug)}" aria-pressed="false" aria-label="Save ${esc(book.title)} to my shelf">${icon('bookmark', { size: 18 })}</button>`;
}

const metaLine = (book, ctx) =>
  [book.firstPublished, ctx.genre(book.genres[0])?.name].filter(Boolean).map(esc).join(' · ');

/**
 * Card for a list of books. `data-*` attributes let the browse page filter without a server.
 * @param {{reason?: string, rank?: number, filterable?: boolean}} [opts]
 */
export function bookCard(book, ctx, { reason, rank, filterable = false, eager = false } = {}) {
  const attrs = filterable
    ? ` data-isbn="${esc(book.isbn13)}" data-title="${esc(`${book.title} ${book.author}`.toLowerCase())}" data-genres="${esc(book.genres.join(' '))}" data-moods="${esc(book.moods.join(' '))}" data-warnings="${esc(book.warnings.join(' '))}" data-length="${book.length}" data-pace="${book.pace}" data-year="${book.firstPublished}" data-sold="${book.soldMillions ?? 0}" data-users="${ctx.hc(book.slug)?.usersCount ?? 0}" data-series="${book.series ? 1 : 0}"`
    : '';
  return `<li class="card"${attrs}>
  <a class="card__link" href="/books/${esc(book.slug)}/">
    ${rank ? `<span class="rank" aria-label="Rank ${rank}">${rank}</span>` : ''}
    ${cover(book, { eager })}
    <span class="card__body">
      <strong class="card__title">${esc(book.title)}</strong>
      <span class="card__author">${esc(book.author)}</span>
      <span class="card__meta">${metaLine(book, ctx)}</span>
      ${reason ? `<span class="card__reason">${esc(reason)}</span>` : ''}
    </span>
  </a>
  ${saveButton(book)}
</li>`;
}

/** @param {{ranked?: boolean, reasons?: string[]}} [opts]  `reasons[i]` is shown on book i. */
export const cardGrid = (books, ctx, opts = {}) =>
  `<ul class="grid">${books
    .map((b, i) =>
      bookCard(b, ctx, {
        rank: opts.ranked ? i + 1 : undefined,
        reason: opts.reasons?.[i],
        // The first few covers are on screen at once: load them right away, the rest lazily.
        eager: i < 6,
      }),
    )
    .join('')}</ul>`;

export const moodChip = (mood, { blurb = true } = {}) =>
  `<a class="chip chip--${esc(mood.color)}" href="/moods/${esc(mood.slug)}/">${icon(mood.icon, { size: 22 })}<span class="chip__text"><span class="chip__name">${esc(mood.name)}</span>${blurb ? `<span class="chip__blurb">${esc(mood.blurb)}</span>` : ''}</span></a>`;

export const sectionHead = ({ title, kicker, href, linkText }) =>
  `<div class="section__head"><div>${kicker ? `<p class="kicker">${esc(kicker)}</p>` : ''}<h2>${esc(title)}</h2></div>${href ? `<a class="more" href="${esc(href)}">${esc(linkText ?? 'See all')}${icon('arrow-right', { size: 16 })}</a>` : ''}</div>`;

export const tagList = (items, className = 'tag', label) =>
  `<ul class="tags"${label ? ` aria-label="${esc(label)}"` : ''}>${items.map((t) => `<li class="${className}">${esc(t)}</li>`).join('')}</ul>`;

export function signupForm(id) {
  return `<form class="signup" action="/api/subscribe" method="post" data-subscribe>
  <label for="${id}">Get three hand-picked books in your inbox each week</label>
  <div class="signup__row">
    <input id="${id}" type="email" name="email" required autocomplete="email" placeholder="you@example.com">
    <input class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">
    <button class="btn btn--accent" type="submit">Subscribe</button>
  </div>
  <p class="signup__msg" role="status" data-msg>No spam. Unsubscribe in one click.</p>
</form>`;
}

export const searchForm = (
  id,
  { large = false, placeholder = 'Search by title or author…' } = {},
) =>
  `<form class="search${large ? ' search--large' : ''}" role="search" action="/books/" method="get">
  <label class="sr-only" for="${id}">Search books by title or author</label>
  ${icon('search', { size: large ? 22 : 18, className: 'search__icon' })}
  <input id="${id}" name="q" type="search" autocomplete="off" enterkeyhint="search" placeholder="${esc(placeholder)}" data-search>
  <button class="search__btn" type="submit" aria-label="Search">${icon('search', { size: large ? 22 : 18 })}<span class="search__btn-text">Search</span></button>
  <ul class="suggest" data-suggest hidden></ul>
</form>`;

export const PER_PAGE = 60;
export const pageCount = (total) => Math.max(1, Math.ceil(total / PER_PAGE));
export const pageSlice = (items, page) => items.slice((page - 1) * PER_PAGE, page * PER_PAGE);
/** URL of page `n` of a list whose first page lives at `base` (for example "/genres/fantasy/"). */
export const pageHref = (base, n) => (n === 1 ? base : `${base}page/${n}/`);

/** Numbered links to the other pages of a long list, so every book is reachable without JavaScript. */
export function pager(base, page, pages) {
  if (pages < 2) return '';
  const shown = new Set([1, pages, page - 2, page - 1, page, page + 1, page + 2]);
  const items = [];
  let last = 0;
  for (const n of [...shown].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b)) {
    if (n - last > 1) items.push('<li class="pager__gap" aria-hidden="true">&hellip;</li>');
    items.push(
      n === page
        ? `<li><span class="pager__n" aria-current="page">${n}</span></li>`
        : `<li><a class="pager__n" href="${esc(pageHref(base, n))}">${n}</a></li>`,
    );
    last = n;
  }
  const prev =
    page > 1
      ? `<a class="pager__step" rel="prev" href="${esc(pageHref(base, page - 1))}">Previous</a>`
      : '';
  const next =
    page < pages
      ? `<a class="pager__step" rel="next" href="${esc(pageHref(base, page + 1))}">Next</a>`
      : '';
  return `<nav class="pager" aria-label="Pages">${prev}<ul>${items.join('')}</ul>${next}</nav>`;
}
