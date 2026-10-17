import { esc } from '../html.js';
import { icon } from '../icons.js';
import { layout } from '../layout.js';
import { cover } from '../components.js';
import { offersTable } from './book.js';

/**
 * A facts-only page for a book we list but have not written about yet. It carries no text of our
 * own beyond a plain sentence assembled from the facts, is noindex, and is not in the sitemap.
 */
export function lightBookPage(ctx, entry) {
  const book = {
    slug: entry.s,
    title: entry.t,
    author: entry.a,
    isbn13: entry.i,
    firstPublished: entry.y,
  };
  const genres = entry.g.map((g) => ctx.genre(g)).filter(Boolean);
  const genreLinks = genres
    .map((g) =>
      ctx.byGenre.has(g.slug)
        ? `<a href="/genres/${esc(g.slug)}/">${esc(g.name)}</a>`
        : `<span>${esc(g.name)}</span>`,
    )
    .join(' · ');
  const facts = [
    `First published ${entry.y}`,
    entry.p ? `about ${entry.p} pages` : null,
    entry.sr ? `part of ${entry.sr}` : null,
  ].filter(Boolean);
  const sentence = `${genres[0] ? `${genres[0].name} by ${entry.a}` : `A book by ${entry.a}`}. ${facts.join(', ')}.${entry.m.length ? ` Readers describe it as ${entry.m.slice(0, 4).join(', ')}.` : ''}`;
  const rating =
    entry.r && entry.n >= 20
      ? `<p class="rating">${icon('star', { size: 18 })}<strong>${esc(entry.r.toFixed(1))}</strong><span class="muted"> out of 5, from ${esc(entry.n.toLocaleString('en-US'))} ratings from Hardcover readers</span></p>`
      : '';

  const body = `<article class="wrap book">
<div class="book__hero">
  <div class="book__cover">${cover(book, { size: 'L', width: 220, height: 330, eager: true })}</div>
  <div class="book__intro">
    ${genreLinks ? `<p class="kicker">${genreLinks}</p>` : ''}
    <h1>${esc(entry.t)}</h1>
    <p class="byline">by ${esc(entry.a)}</p>
    ${rating}
    <p class="summary">${esc(sentence)}</p>
    <div class="actions">
      <a class="btn btn--library btn--lg" href="/go/libby/${esc(entry.i)}?q=${encodeURIComponent(`${entry.t} ${entry.a}`)}" rel="nofollow noopener" target="_blank">${icon('library', { size: 20 })}Borrow free with Libby</a>
      <a class="btn btn--ghost btn--lg" href="#offers-h">Compare prices</a>
    </div>
  </div>
</div>
<aside class="notice" role="note">${icon('info', { size: 20 })}<p><strong>Quick listing.</strong> We have not written about this book yet, so this page shows the facts and every way to get it. <a href="/books/">Browse our written picks</a></p></aside>
<div class="book__grid"><div class="book__main"></div><div class="book__side">${offersTable(book, ctx)}</div></div>
</article>`;

  return layout({
    site: ctx.site,
    path: `/books/${entry.s}/`,
    title: `${entry.t} by ${entry.a}`,
    description: `${entry.t} by ${entry.a}: where to borrow, buy or listen.`,
    body,
    noindex: true,
  });
}
