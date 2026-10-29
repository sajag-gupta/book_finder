import { esc } from '../html.js';
import { icon } from '../icons.js';
import { layout } from '../layout.js';
import { backdropFor } from '../backdrops.js';
import { cardGrid, cover, saveButton } from '../components.js';
import { goPath } from '../../shared/links.js';
import { allStores } from '../../shared/registry.js';
import { FORMAT_ORDER, FORMAT_TITLES, rankOffers } from '../../shared/offers.js';

const FORMAT_ICONS = {
  library: 'library',
  print: 'book',
  ebook: 'tablet',
  audio: 'headphones',
};
const names = (slugs, vocab) => slugs.map((s) => vocab.find((v) => v.slug === s)?.name ?? s);

const lower = (text) => text.charAt(0).toLowerCase() + text.slice(1);

/** Shortens text to fit a search snippet, cutting at a word and ending with an ellipsis. */
const clip = (text, max) =>
  text.length <= max ? text : `${text.slice(0, max - 1).replace(/\s+\S*$/, '')}…`;

export function offersTable(book, ctx) {
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
        return `<tr><td class="offer__store">${esc(o.store.name)}${badge}</td><td class="offer__price">${esc(price)}</td>
<td class="offer__go"><a class="btn${o.store.kind === 'library' ? ' btn--library' : ''}" href="${esc(href)}" rel="${rel}" target="_blank">${esc(o.store.label)}<span class="sr-only"> from ${esc(o.store.name)}</span>${icon('arrow-up-right', { size: 16 })}</a></td></tr>`;
      })
      .join('\n');
    return `<tbody><tr class="group"><th scope="rowgroup" colspan="3">${icon(FORMAT_ICONS[kind], { size: 18 })} ${esc(FORMAT_TITLES[kind])}</th></tr>
${body}</tbody>`;
  }).join('\n');

  return `<section class="panel offers" aria-labelledby="offers-h">
<h2 id="offers-h">Where to get it</h2>
<table><thead><tr><th scope="col">Store</th><th scope="col">Price</th><th scope="col"><span class="sr-only">Link</span></th></tr></thead>
${sections}</table>
<p class="muted small">Prices appear here as retailer feeds are connected. Where none is shown, check the store. Links open the store in a new tab.</p>
<p class="muted small disclosure">As an Amazon Associate I earn from qualifying purchases. Some store links, including Amazon and Kobo, are affiliate links: we may earn a commission if you buy, at no extra cost to you. Library links are never affiliate links. <a href="/about/affiliate-disclosure/">How this works</a></p>
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
  return `<section class="panel" aria-labelledby="series-h"><h2 id="series-h">Reading order: ${esc(series.name)}</h2><ul class="series">${items}</ul></section>`;
}

const STATUS_OPTIONS = [
  ['want', 'Want to read'],
  ['reading', 'Currently reading'],
  ['read', 'Read'],
  ['paused', 'Paused'],
  ['dnf', 'Did not finish'],
]
  .map(([value, label]) => `<option value="${value}">${label}</option>`)
  .join('');
const STAR = `<span class="star" data-fill="none"><span class="star__base">${icon('star', { size: 28 })}</span><span class="star__fill">${icon('star', { size: 28 })}</span></span>`;

const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const factsRow = (label, value) => `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`;

export function bookPage(ctx, book) {
  const { data, site } = ctx;
  const picks = ctx.pairings(book);
  const warnings = names(book.warnings, data.warnings);
  const primary = ctx.genre(book.genres[0]);
  const moodLinks = book.moods
    .map((s) => ctx.mood(s))
    .filter(Boolean)
    .map(
      (m) =>
        `<li><a class="tag tag--mood" href="/moods/${esc(m.slug)}/">${icon(m.icon, { size: 14 })}${esc(m.name)}</a></li>`,
    )
    .join('');
  const tropeLinks = book.tropes
    .map((s) => ctx.trope(s))
    .filter(Boolean)
    .map((t) =>
      (ctx.byTrope.get(t.slug)?.length ?? 0) >= 3
        ? `<li><a class="tag" href="/tropes/${esc(t.slug)}/">${esc(t.name)}</a></li>`
        : `<li class="tag">${esc(t.name)}</li>`,
    )
    .join('');
  const author = ctx.hasAuthorPage(book)
    ? `<a href="/authors/${esc(ctx.authorSlug(book))}/">${esc(book.author)}</a>`
    : esc(book.author);
  const sold = book.soldMillions
    ? `<span class="badge badge--sold">${icon('award', { size: 14 })}Bestseller: about ${esc(book.soldMillions)} million copies (estimate)</span>`
    : '';
  const hc = ctx.hc(book.slug);
  // Attribution is text only: we never send readers to Hardcover.
  const hcLink = hc ? 'Hardcover readers' : '';
  const rating =
    hc?.rating && hc.ratingsCount >= 20
      ? `<p class="rating">${icon('star', { size: 18 })}<strong>${esc(hc.rating.toFixed(1))}</strong><span class="muted"> out of 5, from ${esc(hc.ratingsCount.toLocaleString('en-US'))} ratings from ${hcLink}</span></p>`
      : '';
  const seriesFact = book.series
    ? `Book ${esc(book.series.position)} of a series`
    : hc?.series
      ? hc.series.position
        ? `Book ${esc(hc.series.position)}${hc.series.total ? ` of ${esc(hc.series.total)}` : ''} in ${esc(hc.series.name)}`
        : `Part of ${esc(hc.series.name)}`
      : 'Standalone';
  // Reader-reported warnings from Hardcover that our own list does not already cover.
  const ours = new Set(
    [...warnings, ...book.warnings].map((w) =>
      w
        .toLowerCase()
        .replace(/[^a-z]+/g, ' ')
        .trim(),
    ),
  );
  const reported = (hc?.contentWarnings ?? []).filter(
    (w) =>
      !ours.has(
        w
          .toLowerCase()
          .replace(/[^a-z]+/g, ' ')
          .trim(),
      ),
  );
  const notice =
    book.status === 'checked'
      ? `<aside class="notice" role="note">${icon('info', { size: 20 })}<p><strong>Facts checked, text awaiting review.</strong> The title, author, year and edition were verified against Open Library and Wikipedia. Our description and tags have not yet been read by an editor. <a href="/about/how-we-pick/">How we check</a></p></aside>`
      : '';
  const more = (ctx.byGenre.get(book.genres[0]) ?? [])
    .filter((b) => b.slug !== book.slug && !picks.some((p) => p.slug === b.slug))
    .slice(0, 6);
  const url = `${site.url}/books/${book.slug}/`;

  // Plain-language answers, written from our own record. They are shown on the page and repeated in
  // FAQPage markup, so readers, search engines and AI assistants all get the same facts.
  const asSentence = (text) => (/[.!?]$/.test(text) ? text : `${text}.`);
  const warningNames = [...warnings];
  const faq = [
    [`What is ${book.title} about?`, book.summary],
    [
      `Who should read ${book.title}?`,
      `Read it if ${lower(asSentence(book.readIf))} Skip it if ${lower(asSentence(book.skipIf))}`,
    ],
    [
      `How long and how fast is ${book.title}?`,
      `It is a ${book.pace}-paced, ${book.length} read${hc?.pages ? ` of about ${hc.pages} pages` : ''}, first published in ${book.firstPublished}.`,
    ],
    [
      `Does ${book.title} have content warnings?`,
      warningNames.length
        ? `Content we flag: ${warningNames.join(', ')}.`
        : 'We have not noted any content warnings for this book yet.',
    ],
    [
      `Can I borrow ${book.title} for free?`,
      `Often, yes. Check Libby (OverDrive) to see whether your library lends ${book.title}; the borrow button above searches it for you.`,
    ],
    ...(picks.length
      ? [
          [
            `What should I read after ${book.title}?`,
            `Readers who liked it often move on to ${picks
              .slice(0, 3)
              .map((p) => ctx.bySlug.get(p.slug).title)
              .join(', ')}.`,
          ],
        ]
      : []),
  ];
  const faqHtml = `<section class="panel faq" aria-labelledby="faq-h"><h2 id="faq-h">Quick answers about ${esc(book.title)}</h2><dl>${faq
    .map(([q, a]) => `<div><dt>${esc(q)}</dt><dd>${esc(a)}</dd></div>`)
    .join('')}</dl></section>`;
  const checked = book.reviewedOn ?? book.checkedOn;

  const body = `<article class="wrap book">
<nav class="crumbs" aria-label="Breadcrumb"><a href="/">Home</a>${icon('chevron-right', { size: 14 })}${primary ? `<a href="/genres/${esc(primary.slug)}/">${esc(primary.name)}</a>${icon('chevron-right', { size: 14 })}` : ''}<span aria-current="page">${esc(book.title)}</span></nav>
<div class="book__hero" data-bg="${backdropFor(book.slug, book.moods[0])}">
  <div class="book__cover">${cover(book, { size: 'L', width: 220, height: 330, eager: true })}</div>
  <div class="book__intro">
    <p class="kicker">${book.genres.map((g) => esc(ctx.genre(g)?.name ?? g)).join(' · ')}</p>
    <h1>${esc(book.title)}</h1>
    <p class="byline">by ${author}</p>
    ${sold}
    ${rating}
    <p class="summary">${esc(book.summary)}</p>
    ${checked ? `<p class="muted small checked">${icon('shield-check', { size: 14 })} Facts last checked ${esc(checked)}</p>` : ''}
    <dl class="facts">
      ${factsRow('First published', esc(book.firstPublished))}
      ${factsRow('Pace', esc(cap(book.pace)))}
      ${factsRow('Length', esc(cap(book.length)))}
      ${hc?.pages ? factsRow('Pages', esc(hc.pages)) : ''}
      ${factsRow('Format', seriesFact)}
    </dl>
    <div class="actions">
      <a class="btn btn--library btn--lg" href="${esc(goPath('libby', book.isbn13, `${book.title} ${book.author}`))}" rel="nofollow noopener" target="_blank">${icon('library', { size: 20 })}Borrow free with Libby</a>
      <a class="btn btn--ghost btn--lg" href="#offers-h">Compare prices</a>
      <span class="actions__save">${saveButton(book)}<span class="sr-only">Save to my shelf</span></span>
    </div>
  </div>
</div>
${notice}
<div class="book__grid">
  <div class="book__main">
    <div class="duo">
      <div class="callout callout--yes">${icon('circle-check', { size: 22 })}<p><strong>Read this if</strong> ${esc(lower(book.readIf))}</p></div>
      <div class="callout callout--no">${icon('circle-alert', { size: 22 })}<p><strong>Skip this if</strong> ${esc(lower(book.skipIf))}</p></div>
    </div>
    <section class="panel" aria-labelledby="feel-h"><h2 id="feel-h">The feel</h2>
      <ul class="tags" aria-label="Moods">${moodLinks}</ul>
      ${tropeLinks ? `<ul class="tags" aria-label="Tropes">${tropeLinks}</ul>` : ''}
    </section>
    <section class="panel" aria-labelledby="cw-h" data-cw><h2 id="cw-h">Content warnings</h2>
      <div data-cw-body>${warnings.length ? `<ul class="tags">${warnings.map((w) => `<li class="tag tag--warn">${icon('triangle-alert', { size: 14 })}${esc(w)}</li>`).join('')}</ul>` : '<p>None noted yet.</p>'}${
        reported.length
          ? `<p class="muted small cw__reported">Also reported by ${hcLink}:</p><ul class="tags">${reported
              .slice(0, 10)
              .map(
                (w) =>
                  `<li class="tag tag--warn">${icon('triangle-alert', { size: 14 })}${esc(w)}</li>`,
              )
              .join('')}</ul>`
          : ''
      }</div>
      <div class="cw__controls">
        <button type="button" class="btn btn--ghost btn--small" data-cw-toggle aria-expanded="true" hidden>Hide content warnings</button>
        <label class="check" hidden><input type="checkbox" data-cw-pref><span>Hide them until I ask</span></label>
      </div>
    </section>
    ${seriesBlock(book, ctx)}
    ${faqHtml}
  </div>
  <div class="book__side">
    <section class="panel shelfpanel" aria-labelledby="shelf-h" data-shelf-panel data-slug="${esc(book.slug)}" hidden>
      <h2 id="shelf-h">Your shelf</h2>
      <div class="shelfpanel__row">
        <label for="status-${esc(book.slug)}">Status</label>
        <select id="status-${esc(book.slug)}" data-status><option value="">Not on my shelf</option>${STATUS_OPTIONS}</select>
      </div>
      <div class="shelfpanel__row" data-date-row hidden>
        <label for="read-${esc(book.slug)}">Date read</label>
        <input id="read-${esc(book.slug)}" type="date" data-read-date>
      </div>
      <div class="shelfpanel__row">
        <span id="rating-label">Your rating</span>
        <div class="stars" role="slider" tabindex="0" aria-labelledby="rating-label" aria-valuemin="0" aria-valuemax="5" aria-valuenow="0" aria-valuetext="Not rated" data-stars>${STAR.repeat(5)}</div>
        <button type="button" class="linkbtn" data-clear-rating hidden>Clear</button>
      </div>
      <p class="muted small">Saved in this browser only. <a href="/shelf/">Open my shelf</a></p>
    </section>
    ${offersTable(book, ctx)}
    <section class="panel share" aria-labelledby="share-h"><h2 id="share-h">Share this pick</h2>
      <img class="share-preview" src="/share/${esc(book.slug)}.png" alt="Share card for ${esc(book.title)}" width="270" height="338" loading="lazy">
      <p class="share__actions"><a class="btn btn--ghost" href="/share/${esc(book.slug)}.png" download="${esc(book.slug)}-share-card.png">${icon('download', { size: 18 })}Download card</a>
      <button type="button" class="btn btn--ghost" data-share data-title="${esc(book.title)}" data-url="${esc(url)}" hidden>${icon('share-2', { size: 18 })}<span>Share link</span></button></p>
    </section>
  </div>
</div>
${
  picks.length
    ? `<section class="section" aria-labelledby="like-h"><div class="section__head"><div><p class="kicker">Because you might love it</p><h2 id="like-h">If you loved ${esc(book.title)}</h2></div><a class="more" href="/books-like/${esc(book.slug)}/">All picks${icon('arrow-right', { size: 16 })}</a></div>${cardGrid(
        picks.map((p) => ctx.bySlug.get(p.slug)),
        ctx,
        { reasons: picks.map((p) => p.reason) },
      )}</section>`
    : ''
}
${more.length ? `<section class="section" aria-labelledby="more-h"><div class="section__head"><div><p class="kicker">${esc(primary?.name ?? '')}</p><h2 id="more-h">More to read</h2></div>${primary ? `<a class="more" href="/genres/${esc(primary.slug)}/">All ${esc(primary.name.toLowerCase())}${icon('arrow-right', { size: 16 })}</a>` : ''}</div>${cardGrid(more, ctx)}</section>` : ''}
</article>`;

  return layout({
    site,
    path: `/books/${book.slug}/`,
    title:
      [
        `${book.title} by ${book.author}: summary and where to read`,
        `${book.title} by ${book.author}: where to read`,
        `${book.title} by ${book.author}`,
      ].find((t) => t.length <= 60) ?? book.title,
    description: clip(`${book.summary} Compare library, print, ebook and audiobook options.`, 158),
    image: `/share/${book.slug}-og.png`,
    body,
    scripts: ['share', 'book'],
    breadcrumbs: [...(primary ? [[primary.name, `/genres/${primary.slug}/`]] : []), [book.title]],
    crumbsVisible: false,
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Book',
          '@id': `${url}#book`,
          url,
          name: book.title,
          author: { '@type': 'Person', name: book.author },
          isbn: book.isbn13,
          inLanguage: 'en',
          description: book.summary,
          datePublished: String(book.firstPublished),
          genre: book.genres.map((g) => ctx.genre(g)?.name ?? g),
          ...(hc?.pages ? { numberOfPages: hc.pages } : {}),
          image: `${site.url}/share/${book.slug}-og.png`,
        },
        {
          '@type': 'WebPage',
          url,
          name: `${book.title} by ${book.author}`,
          about: { '@id': `${url}#book` },
          ...(checked ? { dateModified: checked } : {}),
        },
        {
          '@type': 'FAQPage',
          mainEntity: faq.map(([name, text]) => ({
            '@type': 'Question',
            name,
            acceptedAnswer: { '@type': 'Answer', text },
          })),
        },
      ],
    },
  });
}
