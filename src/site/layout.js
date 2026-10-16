import { esc, jsonLd } from './html.js';

/**
 * @typedef {{name: string, url: string, preview: boolean}} Site
 */

/** Wraps page content in the shared document shell. */
export function layout({
  site,
  title,
  description,
  path,
  body,
  structuredData,
  image,
  noindex = false,
}) {
  const social = image
    ? `<meta property="og:image" content="${esc(site.url + image)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">`
    : '';
  const fullTitle = path === '/' ? title : `${title} | ${site.name}`;
  const robots = noindex || site.preview ? '<meta name="robots" content="noindex, nofollow">' : '';
  const ld = structuredData
    ? `<script type="application/ld+json">${jsonLd(structuredData)}</script>`
    : '';
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
<meta name="theme-color" content="#ffffff">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600&family=Nunito+Sans:wght@400;700&display=swap">
<link rel="stylesheet" href="/assets/site.css">
${ld}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <a class="brand" href="/">${esc(site.name)}</a>
  <nav aria-label="Main">
    <a href="/books/">All books</a>
    <a href="/about/how-we-pick/">How we pick</a>
  </nav>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <p>Some links on this site are affiliate links: if you buy through them we may earn a small
  commission at no extra cost to you. It never changes which books we recommend.
  <a href="/about/affiliate-disclosure/">Read more</a>.</p>
  <p>Borrowing from your library is always free, and always shown first.</p>
</footer>
</body>
</html>
`;
}

/** Adds a deferred first-party script to a rendered page. */
export const withScript = (html, name) =>
  html.replace('</body>', `<script src="/assets/${name}.js" defer></script>\n</body>`);

export const withSearchScript = (html) => withScript(html, 'search');
