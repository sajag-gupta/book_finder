import { esc } from '../html.js';
import { icon } from '../icons.js';
import { layout } from '../layout.js';
import { cardGrid, moodChip, sectionHead } from '../components.js';

const MAX_BOOKS = 36;

export const pairPath = (feeling, mood) => `/feel/${feeling}/${mood}/`;

/** The two-question picker: how you feel now, and how you want to feel. Works as plain links without JS. */
export function feelPicker(ctx, { id = 'feel' } = {}) {
  const now = ctx.feelings
    .map(
      (f) =>
        `<li><a class="pill" href="/feel/${esc(f.slug)}/" data-now="${esc(f.slug)}" data-wants="${esc(f.wants.map((w) => w.mood).join(' '))}">${icon(f.icon, { size: 18 })}<span>${esc(f.name)}</span></a></li>`,
    )
    .join('');
  const want = ctx.data.moods
    .filter((m) => ctx.byMood.has(m.slug))
    .map(
      (m) =>
        `<li><a class="pill pill--${esc(m.color)}" href="/moods/${esc(m.slug)}/" data-want="${esc(m.slug)}">${icon(m.icon, { size: 18 })}<span>${esc(m.name)}</span></a></li>`,
    )
    .join('');
  const pairs = ctx.feelings.flatMap((f) => f.wants.map((w) => `${f.slug}:${w.mood}`)).join(' ');
  return `<div class="feel" data-feel data-pairs="${esc(pairs)}">
  <div class="feel__step">
    <h2 class="feel__q" id="${id}-now"><span class="feel__n">1</span>Right now I feel&hellip;</h2>
    <ul class="pills" aria-labelledby="${id}-now">${now}</ul>
  </div>
  <div class="feel__step">
    <h2 class="feel__q" id="${id}-want"><span class="feel__n">2</span>I want to feel&hellip;</h2>
    <p class="feel__hint muted" data-feel-hint hidden></p>
    <ul class="pills" aria-labelledby="${id}-want">${want}</ul>
  </div>
  <p class="feel__go"><a class="btn btn--accent btn--lg" href="/moods/" data-feel-go>${icon('arrow-right', { size: 18 })}Show me books</a></p>
</div>`;
}

const topNames = (books, n = 5) =>
  books
    .slice(0, n)
    .map((b) => `${b.title} by ${b.author}`)
    .join(', ');

const itemList = (ctx, books, name) => ({
  '@type': 'ItemList',
  name,
  itemListElement: books.slice(0, 10).map((b, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    url: `${ctx.site.url}/books/${b.slug}/`,
    name: b.title,
  })),
});

export function feelHubPage(ctx) {
  return layout({
    site: ctx.site,
    path: '/feel/',
    breadcrumbs: [['Books by feeling']],
    title: 'Books for how you feel right now and how you want to feel',
    description:
      'Tell us how you feel today and how you want to feel. Get books chosen for that shift, with every way to borrow, buy or listen.',
    body: `<section class="wrap page">
<header class="pagehead"><p class="kicker">Start here</p><h1>How do you feel, and how do you want to?</h1>
<p class="lede">A book is a small way to change your day. Say where you are and where you would like to be, and we will point you to the right shelf.</p></header>
${feelPicker(ctx)}
<section class="section vibe" data-vibe>
  <h2>Or describe it in your own words</h2>
  <p class="muted">Try “a cozy fantasy with found family, no gore” or “I am stressed and want something funny”.</p>
  <form class="search search--large" role="search" data-vibe-form>
    <label class="sr-only" for="vibe-q">Describe the book you want</label>
    ${icon('sparkles', { size: 22, className: 'search__icon' })}
    <input id="vibe-q" name="vibe" type="text" autocomplete="off" enterkeyhint="search" placeholder="Describe the mood, genre or tropes you want…">
    <button class="search__btn" type="submit" aria-label="Find books">${icon('search', { size: 22 })}<span class="search__btn-text">Find books</span></button>
  </form>
  <p class="muted small" data-vibe-status role="status" aria-live="polite"></p>
  <ul class="grid grid--browse" data-vibe-results></ul>
</section>
<section class="section">${sectionHead({ title: 'Browse by how you feel now' })}
<ul class="pills pills--big">${ctx.feelings.map((f) => `<li><a class="pill" href="/feel/${esc(f.slug)}/">${icon(f.icon, { size: 18 })}<span>${esc(f.name)}</span></a></li>`).join('')}</ul></section>
</section>`,
    scripts: ['feel', 'vibe'],
    structuredData: {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Books for how you feel and how you want to feel',
      url: `${ctx.site.url}/feel/`,
    },
  });
}

export function feelingPage(ctx, feeling) {
  const sections = feeling.wants
    .filter((w) => ctx.byMood.has(w.mood))
    .map((w) => {
      const mood = ctx.mood(w.mood);
      const books = ctx.byMood.get(w.mood).slice(0, 6);
      return `<section class="section">
  ${sectionHead({ kicker: `Feel ${mood.name.toLowerCase()}`, title: w.line, href: pairPath(feeling.slug, w.mood), linkText: `All ${mood.name.toLowerCase()} picks` })}
  ${cardGrid(books, ctx)}
</section>`;
    })
    .join('');
  const first = feeling.wants.find((w) => ctx.byMood.has(w.mood));
  const answer = first
    ? `When you feel ${feeling.name.toLowerCase()}, try ${topNames(ctx.byMood.get(first.mood), 4)}. ${first.line}`
    : '';
  const name = feeling.name.toLowerCase();
  return layout({
    site: ctx.site,
    path: `/feel/${feeling.slug}/`,
    breadcrumbs: [['Books by feeling', '/feel/'], [feeling.name]],
    title: `What to read when you feel ${name}`,
    description: `${feeling.blurb} Books chosen for when you feel ${name}, grouped by how you would like to feel next.`,
    body: `<section class="wrap page">
<header class="pagehead"><span class="pagehead__icon">${icon(feeling.icon, { size: 30 })}</span><p class="kicker">When you feel ${esc(name)}</p><h1>What to read when you feel ${esc(name)}</h1>
<p class="lede">${esc(feeling.blurb)} Pick where you would like to end up and we will show you the books that get you there.</p></header>
<section class="answer" aria-labelledby="answer-h"><h2 id="answer-h">What should I read when I feel ${esc(name)}?</h2><p>${esc(answer)}</p></section>
${sections}
<section class="section">${sectionHead({ title: 'Feeling something else?', href: '/feel/', linkText: 'Change how you feel' })}</section>
</section>`,
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: `What should I read when I feel ${name}?`,
              acceptedAnswer: { '@type': 'Answer', text: answer },
            },
          ],
        },
      ],
    },
  });
}

export function feelPairPage(ctx, feeling, want) {
  const mood = ctx.mood(want.mood);
  const books = ctx.byMood.get(want.mood).slice(0, MAX_BOOKS);
  const now = feeling.name.toLowerCase();
  const to = mood.name.toLowerCase();
  const others = feeling.wants.filter((w) => w.mood !== want.mood && ctx.byMood.has(w.mood));
  const title = `Books for when you feel ${now} and want to feel ${to}`;
  const pairAnswer = `Try ${topNames(books)}. ${want.line}`;
  return layout({
    site: ctx.site,
    path: pairPath(feeling.slug, want.mood),
    breadcrumbs: [
      ['Books by feeling', '/feel/'],
      [feeling.name, `/feel/${feeling.slug}/`],
      [`Feel ${to}`],
    ],
    title,
    description:
      `${want.line} ${books.length} ${to} books for when you feel ${now}, best sellers first.`.slice(
        0,
        158,
      ),
    body: `<section class="wrap page">
<header class="pagehead"><p class="kicker">${esc(feeling.name)} to ${esc(mood.name)}</p><h1>${esc(title)}</h1>
<p class="lede">${esc(want.line)}</p></header>
<section class="answer" aria-labelledby="answer-h"><h2 id="answer-h">What should I read when I feel ${esc(now)} and want to feel ${esc(to)}?</h2><p>${esc(pairAnswer)}</p></section>
${cardGrid(books, ctx)}
<section class="section">${sectionHead({ title: `Other ways to go from ${now}` })}
<ul class="chips chips--small">${others.map((o) => `<li>${moodChip(ctx.mood(o.mood), { blurb: false })}</li>`).join('')}</ul>
<p class="more-line"><a class="more" href="/feel/${esc(feeling.slug)}/">All books for when you feel ${esc(now)}${icon('arrow-right', { size: 16 })}</a></p></section>
</section>`,
    structuredData: {
      '@context': 'https://schema.org',
      '@graph': [
        itemList(ctx, books, title),
        {
          '@type': 'FAQPage',
          mainEntity: [
            {
              '@type': 'Question',
              name: `What should I read when I feel ${now} and want to feel ${to}?`,
              acceptedAnswer: {
                '@type': 'Answer',
                text: pairAnswer,
              },
            },
          ],
        },
      ],
    },
  });
}

/** Every feeling-to-mood combination that has a page, for the build and the sitemap. */
export const feelPairs = (ctx) =>
  ctx.feelings.flatMap((feeling) =>
    feeling.wants.filter((w) => ctx.byMood.has(w.mood)).map((want) => ({ feeling, want })),
  );
