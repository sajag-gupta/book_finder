/**
 * Static site generator. Reads data/ and writes a deployable site to dist/.
 *
 *   node scripts/build.js                   production: reviewed books only
 *   node scripts/build.js --include-drafts  preview: includes drafts, marked noindex
 *
 * SITE_URL sets canonical URLs and the sitemap (defaults to a placeholder).
 */
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData, validateData } from '../src/site/data.js';
import * as pages from '../src/site/pages.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const includeDrafts = process.argv.includes('--include-drafts');

const site = {
  name: 'After the Dragons', // working title: change in one place
  url: (process.env.SITE_URL || 'https://book-finder.pages.dev').replace(/\/$/, ''),
  preview: includeDrafts,
  includeDrafts,
};

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
function page(path, html) {
  write(path.endsWith('/') ? `${path}index.html` : path, html);
  if (!path.endsWith('.html')) urls.push(path);
}

rmSync(dist, { recursive: true, force: true });
cpSync(join(root, 'src', 'assets'), join(dist, 'assets'), { recursive: true });
cpSync(join(root, 'public'), dist, { recursive: true });

page('/', pages.homePage(ctx));
page('/books/', pages.booksIndexPage(ctx));
page('/about/how-we-pick/', pages.howWePickPage(ctx));
page('/about/affiliate-disclosure/', pages.disclosurePage(ctx));
page('/404.html', pages.notFoundPage(ctx));

for (const mood of data.moods) {
  if (ctx.published.some((b) => b.moods.includes(mood.slug))) {
    page(`/moods/${mood.slug}/`, pages.moodPage(ctx, mood));
  }
}
for (const book of ctx.published) {
  page(`/books/${book.slug}/`, pages.bookPage(ctx, book));
  if (ctx.pairings(book).length) page(`/books-like/${book.slug}/`, pages.booksLikePage(ctx, book));
}

write(
  'search-index.json',
  JSON.stringify(
    ctx.published.map((b) => ({
      title: b.title,
      author: b.author,
      url: ctx.pairings(b).length ? `/books-like/${b.slug}/` : `/books/${b.slug}/`,
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
    : `User-agent: *\nDisallow: /go/\n\nSitemap: ${site.url}/sitemap.xml\n`,
);

console.log(
  `Built ${urls.length} pages, ${ctx.published.length} books${includeDrafts ? ' (preview, drafts included)' : ''} -> dist/`,
);
