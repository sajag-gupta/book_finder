import { esc, jsonLd } from './html.js';
import { icon } from './icons.js';
import { searchForm, signupForm } from './components.js';
import { HOME } from './backdrops.js';

/**
 * @typedef {{name: string, url: string, preview: boolean}} Site
 */

const LOGO = `<svg class="brand__mark" viewBox="0 0 32 32" width="34" height="34" aria-hidden="true" focusable="false"><path d="M16 8.5C13.5 6.6 9.6 6 5 6.6v16.8c4.6-.6 8.5 0 11 1.9 2.5-1.9 6.4-2.5 11-1.9V6.6c-4.600-.6-8.500 0-11 1.900zM16 8.500v16.800" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Wraps page content in the shared document shell. */
export function layout({
  site,
  title,
  description,
  path,
  body,
  structuredData,
  breadcrumbs,
  crumbsVisible = true,
  image,
  scripts = [],
  noindex = false,
}) {
  const social = image
    ? `<meta property="og:image" content="${esc(site.url + image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">`
    : '<meta name="twitter:card" content="summary">';
  // The site name is added only when the whole title still fits in a search result (about 60 characters).
  const withName = `${title} | ${site.name}`;
  const fullTitle = path === '/' || withName.length > 60 ? title : withName;
  const robots =
    noindex || site.preview
      ? '<meta name="robots" content="noindex, nofollow">'
      : '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">';
  // One JSON-LD block per page: any structured data plus the breadcrumb trail, as a single graph.
  const trail = breadcrumbs?.length
    ? {
        '@type': 'BreadcrumbList',
        itemListElement: [['Home', '/'], ...breadcrumbs].map(([name, href], i, all) => ({
          '@type': 'ListItem',
          position: i + 1,
          name,
          ...(i < all.length - 1 || href ? { item: site.url + href } : {}),
        })),
      }
    : null;
  const nodes = [
    ...(structuredData ? (structuredData['@graph'] ?? [structuredData]) : []),
    ...(trail ? [trail] : []),
  ].map((node) => Object.fromEntries(Object.entries(node).filter(([k]) => k !== '@context')));
  const ld = nodes.length
    ? `<script type="application/ld+json">${jsonLd({ '@context': 'https://schema.org', '@graph': nodes })}</script>`
    : '';
  const crumbNav =
    breadcrumbs?.length && crumbsVisible
      ? `<nav class="wrap crumbs crumbs--page" aria-label="Breadcrumb"><a href="/">Home</a>${breadcrumbs
          .map(([name, href], i) =>
            i < breadcrumbs.length - 1 && href
              ? `${icon('chevron-right', { size: 14 })}<a href="${esc(href)}">${esc(name)}</a>`
              : `${icon('chevron-right', { size: 14 })}<span aria-current="page">${esc(name)}</span>`,
          )
          .join('')}</nav>`
      : '';
  const scriptTags = ['site', ...scripts]
    .map((name) => `<script type="module" src="/assets/${name}.js"></script>`)
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(site.url + path)}">
${robots}
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(site.url + path)}">
<meta property="og:locale" content="en_US">
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
${social}
<meta name="theme-color" content="#f8f4ea">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://covers.openlibrary.org">
<link rel="preconnect" href="https://books.google.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;600&family=Inter:wght@400;500;600&display=swap">
<link rel="stylesheet" href="/assets/site.css">
<script src="/assets/theme.js"></script>
${ld}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap site-bar">
    <a class="brand" href="/">${LOGO}<span>${esc(site.name)}</span></a>
    <nav class="nav" aria-label="Main">
      <a href="/">Home</a>
      <a href="/books/">Explore</a>
      <a href="/feel/">Mood finder</a>
      <a href="/bestsellers/">Top lists</a>
      <a href="/genres/">Genres</a>
    </nav>
    <div class="bar__tools">
      ${searchForm('hq', { placeholder: 'Search books, authors, or moods…' })}
      <button type="button" class="theme-toggle" data-theme-toggle hidden aria-pressed="false" aria-label="Switch to dark theme"><span class="theme-toggle__sun">${icon('sun', { size: 22 })}</span><span class="theme-toggle__moon">${icon('moon', { size: 22 })}</span></button>
      <a class="shelf-link" href="/shelf/" aria-label="My shelf">${icon('bookmark', { size: 22 })}<span class="shelf-count" data-shelf-count hidden>0</span></a>
    </div>
  </div>
</header>
<main id="main">
${crumbNav}${body}
</main>
<footer class="site-footer" data-bg="${HOME.footer}">
  <div class="wrap footer__grid">
    <div>
      <p class="brand brand--footer">${LOGO}<span>${esc(site.name)}</span></p>
      <p class="muted">Pick a book by how you want to feel, then see every way to borrow, buy or listen to it. Library first, always.</p>
    </div>
    <nav aria-label="Explore">
      <h2 class="footer__h">Explore</h2>
      <ul><li><a href="/books/">All books</a></li><li><a href="/bestsellers/">Bestsellers</a></li><li><a href="/moods/">Moods</a></li><li><a href="/genres/">Genres</a></li><li><a href="/tropes/">Tropes</a></li><li><a href="/shelf/">My shelf</a></li></ul>
    </nav>
    <nav aria-label="About">
      <h2 class="footer__h">About</h2>
      <ul><li><a href="/about/how-we-pick/">How we pick</a></li><li><a href="/about/affiliate-disclosure/">Affiliate disclosure</a></li><li><a href="/about/credits/">Image credits</a></li></ul>
    </nav>
    <div>
      <h2 class="footer__h">Weekly email</h2>
      ${signupForm('fq')}
    </div>
  </div>
  <div class="wrap footer__legal">
    <p>Some links on this site are affiliate links: if you buy through them we may earn a small commission at no extra cost to you. It never changes which books we recommend.</p>
    <p>Cover images are provided by Open Library. Reader ratings and reader-reported content warnings come from Hardcover readers. All descriptions and recommendations are written by us. Background paintings are public domain, from the Art Institute of Chicago (<a href="/about/credits/">credits</a>).</p>
  </div>
</footer>
${scriptTags}
</body>
</html>
`;
}
