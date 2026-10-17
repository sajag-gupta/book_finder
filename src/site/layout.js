import { esc, jsonLd } from './html.js';
import { icon } from './icons.js';
import { searchForm, signupForm } from './components.js';

/**
 * @typedef {{name: string, url: string, preview: boolean}} Site
 */

const LOGO = `<svg class="brand__mark" viewBox="0 0 32 32" width="32" height="32" aria-hidden="true" focusable="false"><rect width="32" height="32" rx="9" fill="#FFC933"/><path d="M7 9h8a2 2 0 0 1 2 2v13a4 4 0 0 0-4-3H7zM25 9h-8a2 2 0 0 0-2 2v13a4 4 0 0 1 4-3h6z" fill="#14213D"/></svg>`;

/** Wraps page content in the shared document shell. */
export function layout({
  site,
  title,
  description,
  path,
  body,
  structuredData,
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
  const fullTitle = path === '/' ? title : `${title} | ${site.name}`;
  const robots = noindex || site.preview ? '<meta name="robots" content="noindex, nofollow">' : '';
  const ld = structuredData
    ? `<script type="application/ld+json">${jsonLd(structuredData)}</script>`
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
<meta property="og:site_name" content="${esc(site.name)}">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
${social}
<meta name="theme-color" content="#FFC933">
<meta name="color-scheme" content="light dark">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="preconnect" href="https://covers.openlibrary.org">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&family=Nunito+Sans:wght@400;600;700&display=swap">
<link rel="stylesheet" href="/assets/site.css">
${ld}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap bar">
    <a class="brand" href="/">${LOGO}<span>${esc(site.name)}</span></a>
    <nav class="nav" aria-label="Main">
      <a href="/books/">Browse</a>
      <a href="/bestsellers/">Bestsellers</a>
      <a href="/moods/">Moods</a>
      <a href="/genres/">Genres</a>
    </nav>
    <div class="bar__tools">
      ${searchForm('hq', { placeholder: 'Search books' })}
      <a class="shelf-link" href="/shelf/" aria-label="My shelf">${icon('bookmark', { size: 22 })}<span class="shelf-count" data-shelf-count hidden>0</span></a>
    </div>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
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
      <ul><li><a href="/about/how-we-pick/">How we pick</a></li><li><a href="/about/affiliate-disclosure/">Affiliate disclosure</a></li></ul>
    </nav>
    <div>
      <h2 class="footer__h">Weekly email</h2>
      ${signupForm('fq')}
    </div>
  </div>
  <div class="wrap footer__legal">
    <p>Some links on this site are affiliate links: if you buy through them we may earn a small commission at no extra cost to you. It never changes which books we recommend.</p>
    <p>Cover images are provided by Open Library. Reader ratings and reader-reported content warnings come from Hardcover readers. All descriptions and recommendations are written by us.</p>
  </div>
</footer>
${scriptTags}
</body>
</html>
`;
}
