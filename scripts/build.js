/**
 * Static site generator. Reads data/ and writes a deployable site to dist/.
 *
 *   node scripts/build.js                   production: reviewed and checked books
 *   node scripts/build.js --include-drafts  preview: includes drafts, marked noindex
 *   node scripts/build.js --skip-share-cards  skip PNG generation for quick local builds
 *
 * SITE_URL sets canonical URLs and the sitemap (defaults to a placeholder).
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData, validateData } from '../src/site/data.js';
import * as pages from '../src/site/pages.js';
import { renderCardPng } from '../src/share/render.js';
import { getSite } from '../src/site/config.js';
import { pageCount, pageHref } from '../src/site/components.js';
import { catalogIndex, searchIndex } from '../src/site/catalog.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const includeDrafts = process.argv.includes('--include-drafts');
const site = getSite({ includeDrafts });

const data = loadData(root);
const errors = validateData(data);
if (errors.length) {
  console.error(`Refusing to build, data is invalid:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}

const ctx = pages.createContext({ data, site });
const urls = [];

function write(file, content) {
  const target = join(dist, file);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}
/** Writes a page; `listed: false` keeps it out of the sitemap (private or utility pages). */
function page(path, html, { listed = true, lastmod } = {}) {
  write(path.endsWith('/') ? `${path}index.html` : path, html);
  if (listed && !path.endsWith('.html')) urls.push({ path, lastmod });
}

rmSync(dist, { recursive: true, force: true });
cpSync(join(root, 'src', 'assets'), join(dist, 'assets'), { recursive: true });
cpSync(join(root, 'public'), dist, { recursive: true });

page('/', pages.homePage(ctx));
for (let n = 1; n <= pageCount(ctx.published.length); n++) {
  page(pageHref('/books/', n), pages.browsePage(ctx, n));
}
page('/bestsellers/', pages.bestsellersPage(ctx));
page('/moods/', pages.moodsIndexPage(ctx));
page('/feel/', pages.feelHubPage(ctx));
for (const feeling of ctx.feelings) page(`/feel/${feeling.slug}/`, pages.feelingPage(ctx, feeling));
for (const { feeling, want } of pages.feelPairs(ctx)) {
  page(`/feel/${feeling.slug}/${want.mood}/`, pages.feelPairPage(ctx, feeling, want));
}
page('/genres/', pages.genresIndexPage(ctx));
page('/tropes/', pages.tropesIndexPage(ctx));
page('/about/how-we-pick/', pages.howWePickPage(ctx));
page('/about/affiliate-disclosure/', pages.disclosurePage(ctx));
page('/shelf/', pages.shelfPage(ctx), { listed: false });
page('/b/', pages.lookupPage(ctx), { listed: false });
page('/subscribed/', pages.subscribedPage(ctx, true), { listed: false });
page('/subscribe-error/', pages.subscribedPage(ctx, false), { listed: false });
page('/404.html', pages.notFoundPage(ctx));

/** Writes every page of a long list: /base/, /base/page/2/, and so on. */
function paged(base, total, render) {
  for (let n = 1; n <= pageCount(total); n++) page(pageHref(base, n), render(n));
}
for (const mood of data.moods) {
  const total = ctx.byMood.get(mood.slug)?.length;
  if (total) paged(`/moods/${mood.slug}/`, total, (n) => pages.moodPage(ctx, mood, n));
}
for (const genre of data.genres) {
  const total = ctx.byGenre.get(genre.slug)?.length;
  if (total) paged(`/genres/${genre.slug}/`, total, (n) => pages.genrePage(ctx, genre, n));
}
for (const trope of pages.tropesWithPages(ctx)) {
  paged(`/tropes/${trope.slug}/`, ctx.byTrope.get(trope.slug).length, (n) =>
    pages.tropePage(ctx, trope, n),
  );
}
for (const slug of pages.authorsWithPages(ctx)) {
  paged(`/authors/${slug}/`, ctx.byAuthor.get(slug).length, (n) => pages.authorPage(ctx, slug, n));
}
for (const book of ctx.published) {
  page(`/books/${book.slug}/`, pages.bookPage(ctx, book), {
    lastmod: book.reviewedOn ?? book.checkedOn,
  });
  if (ctx.pairings(book).length) page(`/books-like/${book.slug}/`, pages.booksLikePage(ctx, book));
}

// Light listings: facts-only pages for more of the most-read books. They are noindex, stay out of
// the sitemap, and give way to a full page as soon as a full record exists.
const light = ctx.light.filter((entry) => !ctx.bySlug.has(entry.s));
for (const entry of light)
  page(`/books/${entry.s}/`, pages.lightBookPage(ctx, entry), { listed: false });
write('light-index.json', JSON.stringify(light.map(({ s, t, a, y, i }) => ({ s, t, a, y, i }))));

// Share cards: a 4:5 image for posting and a 1.91:1 image for link previews, one pair per book.
if (!process.argv.includes('--skip-share-cards')) {
  const options = { moods: data.moods, siteName: site.name, host: new URL(site.url).host };
  for (const book of ctx.published) {
    write(`share/${book.slug}.png`, await renderCardPng(book, options));
    write(`share/${book.slug}-og.png`, await renderCardPng(book, { ...options, variant: 'og' }));
  }
}

// Compact indexes: one small one for search suggestions and the saved shelf, and one with every
// book's tags for the browse filters and the vibe box (both loaded on demand).
write('search-index.json', JSON.stringify(searchIndex(ctx)));
write('catalog.json', JSON.stringify(catalogIndex(ctx)));
write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map(
      (u) =>
        `  <url><loc>${site.url}${u.path}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`,
    )
    .join('\n')}\n</urlset>\n`,
);
// Search and AI crawlers may read everything except the redirect, API and private pages. AI crawlers
// are named so the choice is explicit and easy to change.
const AI_BOTS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-User',
  'PerplexityBot',
  'Perplexity-User',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
];
const blocked = 'Disallow: /go/\nDisallow: /api/\nDisallow: /shelf/\nDisallow: /b/\n';
write(
  'robots.txt',
  includeDrafts
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\n${blocked}\n${AI_BOTS.map((bot) => `User-agent: ${bot}\n${blocked}`).join('\n')}\nSitemap: ${site.url}/sitemap.xml\n`,
);

// llms.txt: a short plain-text map for AI assistants. It is a proposed convention; Google does not
// require it. Everything it links to is also in the sitemap.
if (!includeDrafts) {
  const moods = data.moods.filter((m) => ctx.byMood.has(m.slug));
  write(
    'llms.txt',
    `# ${site.name}

> A book discovery site built on two questions: how do you feel right now, and how do you want to feel? It matches ${ctx.published.length} books to that shift and shows every way to borrow (library first), buy or listen to each one. Descriptions and recommendations are written by us; facts are checked against Open Library and a second source; ratings come from Hardcover readers.

## Start here
- [Books by how you feel](${site.url}/feel/): pick a current feeling and a desired one
- [Browse and filter all books](${site.url}/books/): genre, mood, length, pace, content warnings
- [Bestsellers](${site.url}/bestsellers/): top-selling books of all time, sales labelled as estimates

## Browse by mood
${moods.map((m) => `- [${m.name} books](${site.url}/moods/${m.slug}/): ${m.blurb}`).join('\n')}

## How we work
- [How we pick and check books](${site.url}/about/how-we-pick/)
- [Affiliate disclosure](${site.url}/about/affiliate-disclosure/): some store links earn us a commission and never change recommendations
- [Sitemap](${site.url}/sitemap.xml)
`,
  );
}

console.log(
  `Built ${urls.length} listed pages, ${ctx.published.length} books${includeDrafts ? ' (preview, drafts included)' : ''} -> dist/`,
);
