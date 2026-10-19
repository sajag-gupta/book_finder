import { esc } from '../html.js';
import { icon } from '../icons.js';
import { layout } from '../layout.js';
import { cardGrid, cover, searchForm, sectionHead, signupForm } from '../components.js';
import { HOME } from '../backdrops.js';

const STEPS = [
  [
    'search',
    'Say how you feel, and how you want to',
    'Pick a mood, or describe it in your own words. We suggest what to read next and tell you why.',
  ],
  [
    'layers',
    'See every way to get it',
    'Print, ebook and audiobook side by side, with the lowest price marked.',
  ],
  [
    'library',
    'Borrow it free first',
    'Your library is always the first option. Buying is there when you want it.',
  ],
];

const CATEGORIES = [
  'romance',
  'fantasy',
  'self-help',
  'thriller',
  'science-fiction',
  'biography',
  'young-adult',
  'classic',
];
const fmt = (n) => n.toLocaleString('en-US');

export function homePage(ctx) {
  const { site, data, published } = ctx;
  const empty = published.length === 0;
  const listed = published.length + ctx.light.length;
  const authors = new Set([...published.map((b) => b.author), ...ctx.light.map((b) => b.a)]).size;
  const genreCount = data.genres.filter((g) => ctx.byGenre.has(g.slug)).length;

  const hero = `<section class="hero2">
  <div class="hero2__text">
    <h1>Books for wherever your mind is.</h1>
    <p class="hero2__lede">${empty ? 'We check every pick by hand before it goes live, and our first ones are almost ready. Check back soon.' : 'Sometimes you don&rsquo;t know what to read, but you know how you feel. Tell us how you feel and how you want to feel, and find books that fit.'}</p>
    ${empty ? '' : `<div class="hero2__cta"><a class="btn btn--accent btn--lg" href="/feel/">Find my next read</a></div>`}
    ${empty ? '' : searchForm('hero-q', { large: true, placeholder: 'e.g. I feel lost and need a fresh start…' })}
    <ul class="hero2__stats" aria-label="The collection">
      <li>${icon('book-open', { size: 26 })}<span><strong>${fmt(listed)}</strong> books</span></li>
      <li>${icon('users', { size: 26 })}<span><strong>${fmt(authors)}</strong> authors</span></li>
      <li>${icon('layout-grid', { size: 26 })}<span><strong>${genreCount}</strong> categories</span></li>
    </ul>
  </div>
  <div class="hero2__visual" role="img" aria-label="A painting of a window looking out over woods"><p class="hero2__note" aria-hidden="true">A different book for a different you.</p></div>
</section>`;

  const feelings = ctx.feelings
    .map(
      (f, i) =>
        `<a class="feelcard tone-${i % 8}" href="/feel/${esc(f.slug)}/">${icon(f.icon, { size: 28 })}<span>${esc(f.name)}</span></a>`,
    )
    .join('');
  const wants = data.moods
    .filter((m) => m.featured && ctx.byMood.has(m.slug))
    .map(
      (m) =>
        `<li><a class="pill" href="/moods/${esc(m.slug)}/">${icon(m.icon, { size: 18 })}<span>${esc(m.name)}</span></a></li>`,
    )
    .join('');
  const moodStrip = empty
    ? ''
    : `<section class="wrap moodstrip" aria-labelledby="mood-h">
  <div class="moodstrip__intro"><h2 id="mood-h">How are you feeling today?</h2><p class="muted">Pick a feeling and get personalised recommendations.</p></div>
  <div class="scroller moodstrip__cards">${feelings}</div>
  <p class="moodstrip__next"><strong>And how do you want to feel?</strong> <a class="more" href="/feel/">Choose both${icon('arrow-right', { size: 16 })}</a></p>
  <ul class="pills" aria-label="Moods you can aim for">${wants}</ul>
</section>`;

  // Trending: this month's most-read when we have enough of them, else the most-read overall.
  const byReaders = [...published].sort(
    (a, b) => (ctx.hc(b.slug)?.usersCount ?? 0) - (ctx.hc(a.slug)?.usersCount ?? 0),
  );
  const trending = (ctx.trending.length >= 4 ? ctx.trending : byReaders).slice(0, 10);
  const trendItem = (b, i) => {
    const hc = ctx.hc(b.slug);
    const rating =
      hc?.rating && hc.ratingsCount >= 20
        ? `<span class="trend__rating">${icon('star', { size: 14 })}${esc(hc.rating.toFixed(1))}</span>`
        : '';
    return `<li class="trend"><span class="trend__n" aria-hidden="true">${i + 1}</span><a class="trend__link" href="/books/${esc(b.slug)}/">${cover(b, { eager: i < 6 })}<strong class="trend__title">${esc(b.title)}</strong><span class="trend__author">${esc(b.author)}</span>${rating}</a></li>`;
  };
  const trendingSection = `<div class="bgband" data-bg="${HOME.trending}"><section class="wrap section">
  ${sectionHead({ title: 'Trending right now', href: '/books/?sort=popular', linkText: 'View all' })}
  <p class="muted small sub">${ctx.trending.length >= 4 ? 'Most-read books over the last 30 days, according to Hardcover readers.' : 'Popular books readers are loving, according to Hardcover readers.'}</p>
  <div class="scroller"><ol class="trendlist">${trending.map(trendItem).join('')}</ol></div>
</section></div>`;

  const slugs = [
    ...CATEGORIES.filter((s) => ctx.byGenre.has(s)),
    ...data.genres
      .filter((g) => ctx.byGenre.has(g.slug) && !CATEGORIES.includes(g.slug))
      .sort((a, b) => ctx.byGenre.get(b.slug).length - ctx.byGenre.get(a.slug).length)
      .map((g) => g.slug),
  ].slice(0, 8);
  const catTiles = slugs
    .map((slug, i) => {
      const g = ctx.genre(slug);
      const books = ctx.byGenre.get(slug).slice(0, 3);
      return `<li><a class="catcard tone-${i % 8}" href="/genres/${esc(slug)}/"><span class="catcard__fan">${books.map((b) => cover(b, { width: 90, height: 135 })).join('')}</span><span class="catcard__name">${esc(g.name)}</span><span class="catcard__count">${fmt(ctx.byGenre.get(slug).length)} books</span></a></li>`;
    })
    .join('');
  const categories = `<section class="wrap section">
  ${sectionHead({ title: 'Explore by category', href: '/genres/', linkText: 'View all categories' })}
  <p class="muted small sub">Browse books by your favourite genres.</p>
  <ul class="catgrid">${catTiles}</ul>
</section>`;

  const sellers = ctx.topSellers.slice(0, 12);
  const sections = empty
    ? ''
    : `${trendingSection}
${categories}
<div class="bgband" data-bg="${HOME.sellers}"><section class="wrap section">
  ${sectionHead({ title: 'Top sellers of all time', href: '/bestsellers/', linkText: 'See the full ranking' })}
  <div class="scroller">${cardGrid(sellers, ctx, { ranked: true })}</div>
</section></div>
<section class="wrap section">
  ${sectionHead({ title: 'Popular right now', href: '/books/?sort=newest', linkText: 'More recent books' })}
  <div class="scroller">${cardGrid(ctx.modern.slice(0, 12), ctx)}</div>
</section>
<div class="bgband" data-bg="${HOME.how}"><section class="wrap section how">
  ${sectionHead({ title: 'How it works' })}
  <ol class="steps">${STEPS.map(([, t, d]) => `<li><h3>${esc(t)}</h3><p>${esc(d)}</p></li>`).join('')}</ol>
</section></div>`;

  const band = `<div class="bgband" data-bg="${HOME.newsletter}"><section class="wrap section"><div class="band">
  <div><h2>Three books and one honest deal, every week</h2><p>One email, picked by hand. We only share a price we have checked ourselves.</p></div>
  ${signupForm('hero-signup')}
</div></section></div>`;

  return layout({
    site,
    path: '/',
    title: `${site.name}: find books by how you feel`,
    description:
      'Tell us how you feel and how you want to feel. Find books that fit, then see every way to borrow, buy or listen, with the cheapest option marked.',
    body: hero + moodStrip + sections + band,
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${site.url}/#website`,
          name: site.name,
          url: site.url,
          inLanguage: 'en',
          publisher: { '@id': `${site.url}/#org` },
          potentialAction: {
            '@type': 'SearchAction',
            target: `${site.url}/books/?q={search_term_string}`,
            'query-input': 'required name=search_term_string',
          },
        },
        {
          '@type': 'Organization',
          '@id': `${site.url}/#org`,
          name: site.name,
          url: site.url,
          logo: {
            '@type': 'ImageObject',
            url: `${site.url}/assets/brand/icon-512.png`,
            width: 512,
            height: 512,
          },
          description:
            'A book discovery site that matches books to how you feel and how you want to feel, and shows every way to borrow, buy or listen.',
        },
      ],
    },
  });
}
