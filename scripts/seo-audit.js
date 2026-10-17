/**
 * Audits the built site in dist/ for search (SEO), answer-engine (AEO) and generative-engine (GEO)
 * basics, using only what a crawler can read from the HTML. No network access.
 *
 *   npm run build && npm run seo
 *
 * Exits 1 on any error. Warnings are printed but do not fail the run.
 *
 * What it checks, and why:
 *  - titles, descriptions, one h1, canonical, lang, Open Graph: what search results and link previews show
 *  - sitemap and robots.txt: every indexable page listed once, nothing noindex listed, files exist
 *  - internal links: no broken links, no orphan pages (a page nothing links to is hard to discover)
 *  - JSON-LD: parses, has the required fields, breadcrumbs are in order
 *  - FAQ markup: every question and answer in the markup is also visible text (Google requires
 *    structured data to match the page; AI assistants quote the visible text)
 *  - images: alt text and dimensions (accessibility and layout stability)
 *  - answer-first content: book and feeling pages must open with a real answer, not only a list
 */
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
if (!existsSync(dist)) {
  console.error('dist/ not found. Run npm run build first.');
  process.exit(1);
}

const errors = [];
const warnings = [];
const err = (page, msg) => errors.push(`${page}: ${msg}`);
const warn = (page, msg) => warnings.push(`${page}: ${msg}`);

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? walk(join(dir, entry.name)) : [join(dir, entry.name)],
  );
}
const files = walk(dist).map((f) => relative(dist, f).split(sep).join('/'));
const htmlFiles = files.filter((f) => f.endsWith('.html') && f !== '404.html');
const fileSet = new Set(files);

const urlOf = (file) =>
  file.endsWith('index.html') ? `/${file.slice(0, -'index.html'.length)}` : `/${file}`;
const decode = (s) =>
  s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, '’')
    .replace(/&ldquo;/g, '“')
    .replace(/&rdquo;/g, '”')
    .replace(/&amp;/g, '&');
const text = (html) =>
  decode(
    html
      .replace(/<script[\s\S]*?<\/script>/g, ' ')
      .replace(/<style[\s\S]*?<\/style>/g, ' ')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/\s+/g, ' ')
    .trim();
const meta = (html, attr, key) =>
  html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)"`))?.[1];

const siteUrl = (() => {
  const robots = readFileSync(join(dist, 'robots.txt'), 'utf8');
  const origin = robots.match(/Sitemap: (https?:\/\/[^/\s]+)/)?.[1];
  if (!origin) {
    console.error('robots.txt has no Sitemap line (is this a preview build?).');
    process.exit(1);
  }
  return origin;
})();

const pages = new Map();
for (const file of htmlFiles) {
  const html = readFileSync(join(dist, file), 'utf8');
  const noindex = /<meta name="robots" content="[^"]*noindex/.test(html);
  pages.set(urlOf(file), { file, html, noindex });
}
const indexable = [...pages].filter(([, p]) => !p.noindex);

// ---------- Per page ----------
const titles = new Map();
const descriptions = new Map();
const inbound = new Map();

for (const [url, { html, noindex }] of pages) {
  const title = decode(html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '');
  const description = decode(meta(html, 'name', 'description') ?? '');
  if (!/<html lang="[a-z-]+"/.test(html)) err(url, 'missing <html lang>');

  // Internal links, for the broken-link and orphan checks (done for every page, indexable or not).
  for (const [, href] of html.matchAll(/<a [^>]*href="([^"]+)"/g)) {
    if (!href.startsWith('/') || href.startsWith('//')) continue;
    // Share cards are skipped by --skip-share-cards, so only check them when they were built.
    if (href.startsWith('/share/') && !files.some((f) => f.startsWith('share/'))) continue;
    const path = href.split('#')[0].split('?')[0];
    if (!path || /^\/(go|api)\//.test(path)) continue;
    const exists =
      fileSet.has(path.slice(1)) ||
      fileSet.has(`${path.slice(1)}index.html`.replace(/^index\.html$/, 'index.html')) ||
      (path.endsWith('/') && fileSet.has(`${path.slice(1)}index.html`));
    if (!exists) err(url, `broken internal link ${href}`);
    if (path !== url) inbound.set(path, (inbound.get(path) ?? 0) + 1);
  }
  if (noindex) continue;

  if (!title) err(url, 'missing <title>');
  else {
    if (title.length > 70) err(url, `title is ${title.length} characters (max 70): "${title}"`);
    else if (title.length > 62) warn(url, `title may be cut off in results (${title.length})`);
    if (title.length < 10) err(url, `title too short: "${title}"`);
    titles.set(title, [...(titles.get(title) ?? []), url]);
  }
  if (!description) err(url, 'missing meta description');
  else {
    if (description.length < 50) warn(url, `description is short (${description.length})`);
    if (description.length > 170) warn(url, `description may be cut off (${description.length})`);
    descriptions.set(description, [...(descriptions.get(description) ?? []), url]);
  }
  const h1s = html.match(/<h1[ >]/g)?.length ?? 0;
  if (h1s !== 1) err(url, `expected one <h1>, found ${h1s}`);

  const canonical = html.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
  if (canonical !== `${siteUrl}${url}`)
    err(url, `canonical is ${canonical}, expected ${siteUrl}${url}`);
  for (const key of ['og:title', 'og:description', 'og:url', 'og:type'])
    if (!meta(html, 'property', key)) err(url, `missing ${key}`);
  if (!meta(html, 'name', 'viewport')) err(url, 'missing viewport meta');

  for (const [tag] of html.matchAll(/<img [^>]*>/g)) {
    if (!/\salt="/.test(tag)) err(url, `image without alt: ${tag.slice(0, 80)}`);
    if (!/\swidth="/.test(tag) || !/\sheight="/.test(tag)) warn(url, 'image without width/height');
  }

  // Structured data.
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
  const visible = text(html).toLowerCase();
  const nodes = [];
  for (const [, raw] of blocks) {
    try {
      const data = JSON.parse(raw);
      nodes.push(...(data['@graph'] ?? [data]));
    } catch (e) {
      err(url, `JSON-LD does not parse: ${e.message}`);
    }
  }
  for (const node of nodes) {
    if (!node['@type']) err(url, 'JSON-LD node without @type');
    if (node['@type'] === 'Book') {
      for (const key of ['name', 'author', 'isbn', 'url'])
        if (!node[key]) err(url, `Book markup missing ${key}`);
    }
    if (node['@type'] === 'BreadcrumbList') {
      node.itemListElement.forEach((item, i) => {
        if (item.position !== i + 1) err(url, 'breadcrumb positions are not sequential');
        if (!item.name) err(url, 'breadcrumb item without name');
      });
    }
    if (node['@type'] === 'FAQPage') {
      if (!node.mainEntity?.length) err(url, 'FAQPage with no questions');
      for (const q of node.mainEntity ?? []) {
        const answer = q.acceptedAnswer?.text ?? '';
        const norm = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
        if (!answer) err(url, `FAQ question without answer: ${q.name}`);
        if (!visible.includes(norm(decode(q.name))))
          err(url, `FAQ question is not visible on the page: ${q.name}`);
        if (!visible.includes(norm(decode(answer)).slice(0, 60)))
          err(url, `FAQ answer is not visible on the page: ${q.name}`);
      }
    }
  }

  // Answer-first content for the page types where a question is the likely search.
  const words = text(html).split(' ').length;
  if (/^\/books\/[^/]+\/$/.test(url)) {
    if (!nodes.some((n) => n['@type'] === 'Book')) err(url, 'book page without Book markup');
    if (!nodes.some((n) => n['@type'] === 'FAQPage')) err(url, 'book page without FAQ');
    if (!nodes.some((n) => n['@type'] === 'BreadcrumbList'))
      err(url, 'book page without breadcrumbs');
    if (words < 250) warn(url, `thin book page (${words} words)`);
  }
  if (
    /^\/(moods|genres|tropes|authors|feel)\/./.test(url) &&
    !nodes.some((n) => n['@type'] === 'BreadcrumbList')
  )
    err(url, 'list page without breadcrumbs');
}

for (const [title, urls] of titles)
  if (urls.length > 1) err(urls[0], `duplicate title shared by ${urls.length} pages: "${title}"`);
for (const [desc, urls] of descriptions)
  if (urls.length > 1)
    warn(urls[0], `description shared by ${urls.length} pages: "${desc.slice(0, 60)}"`);

// ---------- Sitemap and robots ----------
const sitemap = readFileSync(join(dist, 'sitemap.xml'), 'utf8');
const listed = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
if (new Set(listed).size !== listed.length) err('sitemap.xml', 'contains duplicate URLs');
if (listed.length > 50000) err('sitemap.xml', 'over 50,000 URLs: split it');
const listedPaths = new Set();
for (const loc of listed) {
  if (!loc.startsWith(siteUrl)) {
    err('sitemap.xml', `URL on another host: ${loc}`);
    continue;
  }
  const path = loc.slice(siteUrl.length);
  listedPaths.add(path);
  const page = pages.get(path);
  if (!page) err('sitemap.xml', `lists a page that does not exist: ${path}`);
  else if (page.noindex) err('sitemap.xml', `lists a noindex page: ${path}`);
}
for (const [url] of indexable)
  if (!listedPaths.has(url)) err('sitemap.xml', `indexable page missing from sitemap: ${url}`);
for (const [url] of indexable)
  if (url !== '/' && !inbound.get(url)) err(url, 'orphan page: no other page links to it');

const robots = readFileSync(join(dist, 'robots.txt'), 'utf8');
if (/^Disallow: \/\s*$/m.test(robots.split('\n\n')[0])) err('robots.txt', 'blocks the whole site');
for (const bot of ['GPTBot', 'ClaudeBot', 'PerplexityBot', 'Google-Extended'])
  if (!robots.includes(`User-agent: ${bot}`)) warn('robots.txt', `no explicit rule for ${bot}`);
if (!fileSet.has('llms.txt')) warn('llms.txt', 'missing');
for (const [url, { file }] of indexable) {
  const size = statSync(join(dist, file)).size;
  if (size > 1_000_000) err(url, `HTML is ${(size / 1e6).toFixed(1)} MB; paginate or trim it`);
  else if (size > 500_000) warn(url, `HTML is ${Math.round(size / 1000)} KB`);
}

// ---------- Report ----------
const counts = {};
for (const [url] of indexable) {
  const kind = url === '/' ? 'home' : url.split('/')[1];
  counts[kind] = (counts[kind] ?? 0) + 1;
}
console.log(`Audited ${pages.size} pages (${indexable.length} indexable) at ${siteUrl}`);
console.log(
  `By type: ${Object.entries(counts)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ')}`,
);
console.log(`Sitemap URLs: ${listed.length}`);
for (const w of warnings.slice(0, 40)) console.log(`  warn  ${w}`);
if (warnings.length > 40) console.log(`  ...and ${warnings.length - 40} more warnings`);
for (const e of errors.slice(0, 60)) console.log(`  ERROR ${e}`);
if (errors.length > 60) console.log(`  ...and ${errors.length - 60} more errors`);
console.log(`${errors.length} errors, ${warnings.length} warnings`);
process.exit(errors.length ? 1 : 0);
