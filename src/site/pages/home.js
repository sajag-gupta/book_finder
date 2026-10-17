import { esc } from '../html.js';
import { icon } from '../icons.js';
import { layout } from '../layout.js';
import { cardGrid, searchForm, sectionHead, signupForm } from '../components.js';
import { feelPicker } from './feel.js';

const STEPS = [
  [
    'search',
    'Say how you want to feel',
    'Pick a mood, or name a book you loved. We suggest what to read next and tell you why.',
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

export function homePage(ctx) {
  const { site, data, published } = ctx;
  const genres = data.genres.filter((g) => ctx.byGenre.has(g.slug));
  const empty = published.length === 0;

  const hero = `<section class="hero">
  <div class="wrap hero__inner">
    <p class="kicker">Two questions, one right book</p>
    <h1>How do you feel, and how do you want to feel?</h1>
    <p class="hero__lede">${empty ? 'We check every pick by hand before it goes live, and our first ones are almost ready. Check back soon.' : `Tell us where you are and where you want to be. We match ${published.length} books to that shift, then show you the free or cheapest way to read each one.`}</p>
    ${
      empty
        ? ''
        : `${feelPicker(ctx, { id: 'home-feel' })}
    <div class="hero__search"><p class="hero__or">Or start from a book you loved</p>${searchForm('hero-q', { large: true, placeholder: 'Try “Fourth Wing” or “Pride and Prejudice”…' })}
    <p class="hero__vibe"><a href="/feel/#vibe-q">${icon('sparkles', { size: 16 })} Describe the vibe in your own words</a></p></div>`
    }
  </div>
</section>`;

  const trust = empty
    ? ''
    : `<section class="wrap trust" aria-label="Why use us"><ul>
    <li>${icon('library', { size: 22 })}<span><strong>Library first</strong> Free borrowing is always the top option</span></li>
    <li>${icon('shield-check', { size: 22 })}<span><strong>Facts checked</strong> Every book verified against two sources</span></li>
    <li>${icon('layers', { size: 22 })}<span><strong>Every format</strong> Print, ebook and audio compared</span></li>
  </ul></section>`;

  const sellers = ctx.topSellers.slice(0, 12);
  const popular = ctx.modern.slice(0, 12);

  const sections = empty
    ? ''
    : `
${
  ctx.trending.length >= 4
    ? `<section class="wrap section">
  ${sectionHead({ kicker: 'This month', title: 'Trending now', href: '/books/?sort=newest', linkText: 'See newer books' })}
  <div class="scroller">${cardGrid(ctx.trending, ctx)}</div>
  <p class="muted small">Most-read books over the last 30 days, according to Hardcover readers.</p>
</section>`
    : ''
}
<section class="wrap section">
  ${sectionHead({ kicker: 'Sold by the million', title: 'Top sellers of all time', href: '/bestsellers/', linkText: 'See the full ranking' })}
  <div class="scroller">${cardGrid(sellers, ctx, { ranked: true })}</div>
</section>
<section class="wrap section">
  ${sectionHead({ kicker: 'Find your corner', title: 'Browse by genre', href: '/genres/', linkText: 'All genres' })}
  <ul class="tiles">${genres.map((g) => `<li><a class="tile tile--${esc(g.color)}" href="/genres/${esc(g.slug)}/">${icon(g.icon, { size: 26 })}<span class="tile__name">${esc(g.name)}</span><span class="tile__count">${ctx.byGenre.get(g.slug).length} books</span></a></li>`).join('')}</ul>
</section>
<section class="wrap section">
  ${sectionHead({ kicker: 'Read this decade', title: 'Popular right now', href: '/books/?sort=newest', linkText: 'More recent books' })}
  <div class="scroller">${cardGrid(popular, ctx)}</div>
</section>
<section class="wrap section how">
  ${sectionHead({ title: 'How it works' })}
  <ol class="steps">${STEPS.map(([i, t, d], n) => `<li><span class="steps__num">${n + 1}</span>${icon(i, { size: 28, className: 'steps__icon' })}<h3>${esc(t)}</h3><p>${esc(d)}</p></li>`).join('')}</ol>
</section>`;

  const band = `<section class="wrap section"><div class="band">
  <div><p class="kicker">Every week</p><h2>Three books and one honest deal</h2><p>One email, picked by hand. We only share a price we have checked ourselves.</p></div>
  ${signupForm('hero-signup')}
</div></section>`;

  return layout({
    site,
    path: '/',
    title: `${site.name}: find your next read by mood`,
    description:
      'Pick a book by how you want to feel, then see every way to borrow, buy or listen to it, with the cheapest option marked.',
    body: hero + trust + sections + band,
    scripts: ['feel'],
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
          description:
            'A book discovery site that matches books to how you feel and how you want to feel, and shows every way to borrow, buy or listen.',
        },
      ],
    },
  });
}
