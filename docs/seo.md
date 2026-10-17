# Search, answer-engine and AI-search optimisation

What we do for SEO (classic search), AEO (answer engines and featured answers) and GEO (generative
AI search), why, and how it is tested. This page separates what Google documents from what is
common advice.

## What the sources say

- **Google's own guidance** on AI Overviews and AI Mode
  ([AI features and your website](https://developers.google.com/search/docs/appearance/ai-features))
  says there are no extra requirements and no special optimisations: the page must be indexed and
  eligible for a snippet. It recommends allowing crawling, internal links, a good page experience,
  important content in text, structured data that matches the visible text, and verifying the site in
  Search Console. It does not require `llms.txt`, AI-specific files or special schema.
- **Structured data**: Google's
  [search gallery](https://developers.google.com/search/docs/appearance/structured-data/search-gallery)
  lists Breadcrumb and Organization as supported. FAQ rich results have been retired for most
  sites, so we do not expect FAQ snippets in Google. We still publish FAQ markup because it mirrors
  visible text and gives other machine readers clean question and answer pairs.
- **Third-party GEO advice** (vendor blogs) agrees on a few habits: answer the question first, use
  question-style headings, state facts with dates and sources, keep names consistent, and let AI
  crawlers in. Their traffic figures are self-reported and unverified, so treat them as ideas, not
  results.

## What the site does

| Area             | Implementation                                                                                                                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crawlability     | Every book, mood, genre, trope, author, feeling and list page is static HTML. Long lists are paginated (`/page/N/`) so every book is reachable by plain links.                                                          |
| Titles and meta  | Unique titles (about 60 characters, site name added only when it fits), unique descriptions (about 155), self-referencing absolute canonicals, `og:*` tags, `robots` with `max-image-preview:large`.                    |
| Sitemap          | `sitemap.xml` lists every indexable page once, with `lastmod` taken from each book's check date. `noindex` pages are never listed.                                                                                      |
| robots.txt       | Search and AI crawlers (GPTBot, OAI-SearchBot, ClaudeBot, Claude-SearchBot, PerplexityBot, Google-Extended, Applebot-Extended and others) are named and allowed; only `/go/`, `/api/`, `/shelf/` and `/b/` are blocked. |
| `llms.txt`       | A short plain-text map for AI assistants. Optional and unproven; it costs nothing and Google does not need it.                                                                                                          |
| Structured data  | One JSON-LD graph per page: `Book`, `WebPage` (with `dateModified`), `FAQPage`, `BreadcrumbList`, `ItemList`, `Person`, `Organization`, `WebSite`. We do not mark up third-party ratings.                               |
| Answer-first     | Book pages carry a visible "Quick answers" block (what it is about, who should read it, length and pace, content warnings, can I borrow it, what next). Feeling pages open with a direct answer naming real books.      |
| Freshness, trust | "Facts last checked" date on book pages; ratings credited in text to Hardcover readers; sales marked as estimates; affiliate disclosure on the page.                                                                    |
| Speed            | Static files, no client framework, explicit image sizes, first covers eager and the rest lazy, one small stylesheet.                                                                                                    |

## How it is tested

Run after a build:

```bash
npm run build
npm run seo
```

`scripts/seo-audit.js` reads `dist/` and fails on: missing or over-long titles, duplicate titles,
missing descriptions, not exactly one `h1`, wrong canonical, missing Open Graph tags, images without
`alt`, JSON-LD that does not parse or lacks required fields, FAQ markup whose text is not visible on
the page, breadcrumbs out of order, broken internal links, orphan pages, indexable pages missing from
the sitemap, `noindex` pages inside it, and HTML larger than 1 MB. It also warns about long
descriptions and missing AI-crawler rules.

Lighthouse (12, Edge, mobile emulation) was run against the local build on 2026-10-17. The latest
numbers are recorded in the pull request that introduced this page.

## What cannot be tested from here

- **Rankings and AI citations.** Nobody can promise them. Check Google Search Console (verify the
  site, submit the sitemap) and watch the Performance report; AI Overview and AI Mode traffic is
  counted there under the Web type.
- **Rich Results Test** and **Schema Markup Validator** need the public URL: run them on a few book
  pages after each deploy.
- **Crawl budget and indexing speed** depend on the live domain; a custom domain helps.
