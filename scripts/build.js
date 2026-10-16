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
function page(path, html, { listed = true } = {}) {
  write(path.endsWith('/') ? `${path}index.html` : path, html);
  if (listed && !path.endsWith('.html')) urls.push(path);
}

rmSync(dist, { recursive: true, force: true });
cpSync(join(root, 'src', 'assets'), join(dist, 'assets'), { recursive: true });
cpSync(join(root, 'public'), dist, { recursive: true });

page('/', pages.homePage(ctx));
page('/books/', pages.browsePage(ctx));
page('/bestsellers/', pages.bestsellersPage(ctx));
page('/moods/', pages.moodsIndexPage(ctx));
page('/genres/', pages.genresIndexPage(ctx));
page('/tropes/', pages.tropesIndexPage(ctx));
page('/about/how-we-pick/', pages.howWePickPage(ctx));
page('/about/affiliate-disclosure/', pages.disclosurePage(ctx));
page('/shelf/', pages.shelfPage(ctx), { listed: false });
page('/b/', pages.lookupPage(ctx), { listed: false });
page('/subscribed/', pages.subscribedPage(ctx, true), { listed: false });
page('/subscribe-error/', pages.subscribedPage(ctx, false), { listed: false });
page('/404.html', pages.notFoundPage(ctx));

for (const mood of data.moods) {
  if (ctx.byMood.has(mood.slug)) page(`/moods/${mood.slug}/`, pages.moodPage(ctx, mood));
}
for (const genre of data.genres) {
  if (ctx.byGenre.has(genre.slug)) page(`/genres/${genre.slug}/`, pages.genrePage(ctx, genre));
}
for (const trope of pages.tropesWithPages(ctx)) {
  page(`/tropes/${trope.slug}/`, pages.tropePage(ctx, trope));
}
for (const slug of pages.authorsWithPages(ctx)) {
  page(`/authors/${slug}/`, pages.authorPage(ctx, slug));
}
for (const book of ctx.published) {
  page(`/books/${book.slug}/`, pages.bookPage(ctx, book));
  if (ctx.pairings(book).length) page(`/books-like/${book.slug}/`, pages.booksLikePage(ctx, book));
}

// Share cards: a 4:5 image for posting and a 1.91:1 image for link previews, one pair per book.
if (!process.argv.includes('--skip-share-cards')) {
  const options = { moods: data.moods, siteName: site.name, host: new URL(site.url).host };
  for (const book of ctx.published) {
    write(`share/${book.slug}.png`, await renderCardPng(book, options));
    write(`share/${book.slug}-og.png`, await renderCardPng(book, { ...options, variant: 'og' }));
  }
}

// Compact index for search suggestions and the saved shelf.
write(
  'search-index.json',
  JSON.stringify(
    ctx.published.map((b) => ({
      s: b.slug,
      t: b.title,
      a: b.author,
      y: b.firstPublished,
      i: b.isbn13,
      g: b.genres,
    })),
  ),
);
write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${site.url}${u}</loc></url>`)
    .join('\n')}\n</urlset>\n`,
);
write(
  'robots.txt',
  includeDrafts
    ? 'User-agent: *\nDisallow: /\n'
    : `User-agent: *\nDisallow: /go/\nDisallow: /api/\nDisallow: /shelf/\n\nSitemap: ${site.url}/sitemap.xml\n`,
);

console.log(
  `Built ${urls.length} listed pages, ${ctx.published.length} books${includeDrafts ? ' (preview, drafts included)' : ''} -> dist/`,
);
