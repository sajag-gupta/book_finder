<p align="center">
  <img src="docs/assets/logo.png" alt="ReadYourMood: a smiling open book reading a book. Books for wherever your mind is." width="420">
</p>

<h1 align="center">ReadYourMood</h1>

<p align="center">
  <strong>Books for wherever your mind is.</strong><br>
  Say how you feel and how you want to feel. Get books that fit, then see every way to borrow, buy or listen, library first.
</p>

<p align="center">
  <a href="https://readyourmood.app">Live site</a> ·
  <a href="docs/architecture.md">Architecture</a> ·
  <a href="docs/design.md">Design</a> ·
  <a href="docs/seo.md">SEO</a> ·
  <a href="CONTRIBUTING.md">Contributing</a>
</p>

---

## What it does

1. **Two questions, one right book.** Pick how you feel now (stressed, lonely, bored…) and how you
   want to feel (cozy, hopeful, tense…), or describe it in your own words. You get a short list
   with a plain reason for each pick, written by us, filterable by genre, mood, length, pace and
   content warnings.
2. **Get it the cheapest way.** Open a book and see print, ebook, audiobook and library options side
   by side. Borrowing from a library is always shown first.

Also: bestseller rankings, 120+ genres across fiction and non-fiction, a private reading shelf
(statuses, ratings, stats, Goodreads/StoryGraph CSV import), content warnings you can hide, light and
dark themes, a weekly email and shareable cards. How the catalogue is built, and what `checked` and
`reviewed` mean, is in [docs/catalogue.md](docs/catalogue.md). Store buttons are affiliate links where
a program exists; see [docs/product.md](docs/product.md).

## Set it up in one step

You need [Node.js](https://nodejs.org) 24 or newer (see [.nvmrc](.nvmrc)). Nothing else: no accounts
and no keys.

```bash
git clone https://github.com/sajag-gupta/book_finder.git
cd book_finder
npm run setup     # installs, checks, builds
npm run serve     # then open http://127.0.0.1:8788
```

**Or let an AI assistant do it.** Open the cloned folder in Claude Code, Codex, Cursor or any
coding assistant and paste:

> Read AGENTS.md, set this project up and start it so I can open the site in my browser.

[AGENTS.md](AGENTS.md) holds the exact steps, the rules to follow and what "done" means.

## Commands

| Command                   | What it does                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------- |
| `npm run setup`           | Check Node, install, create `.env`, run the checks, build                             |
| `npm run serve`           | Serve `dist/` on http://127.0.0.1:8788 with `/api/*` and `/go/*` working locally      |
| `npm run check`           | Lint, format check, data validation and tests (what CI runs)                          |
| `npm run build`           | Production build to `dist/` (add `-- --skip-share-cards` for a fast one)              |
| `npm run build:preview`   | Preview build including drafts, `noindex`                                             |
| `npm run seo`             | Audit the built site for SEO, structured data, links and sitemap                      |
| `npm run validate`        | Validate every record in `data/` against the schema and vocabulary                    |
| `npm run covers`          | Find a working cover image for each book (writes `data/covers.json`)                  |
| `npm run review`          | Fact-check drafts; `-- --mark-checked` or `-- --approve <slug> --reviewer "Name"`     |
| `npm run enrich`          | Add Hardcover ratings, pages, series and warnings (needs `HARDCOVER_TOKEN`)           |
| `npm run discover -- 150` | List the most-read books we are missing (`--write` adds them to the catalogue)        |
| `npm run trending`        | Refresh `data/trending.json` from Hardcover's API (needs `HARDCOVER_TOKEN`)           |
| `npm run email -- <date>` | Render a weekly issue to HTML and text (see [docs/newsletter.md](docs/newsletter.md)) |
| `npm run dev`             | Preview build plus `wrangler pages dev` (needs Wrangler)                              |

## How it works

A static site generator reads editorial records from [data/](data) and writes plain HTML to `dist/`.
Cloudflare Pages serves it. One edge function, `/go/<store>/<isbn13>`, logs the click to D1 and
redirects to the store with the right affiliate ID, so IDs can change without touching any page.

```
data/ ──► scripts/build.js ──► dist/ ──► Cloudflare Pages
                                   ├──► functions/go ──► D1 (click log) ──► 302 to store
                                   └──► functions/api/subscribe ──► Buttondown
```

No framework and no client-side rendering: every page is real HTML, and a few small scripts add
filters, search, the feeling picker and the saved shelf. Icons are inlined Lucide SVGs. Background
paintings are public domain, from the Art Institute of Chicago.

## Repository layout

| Path                     | Purpose                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| `data/books/`            | One JSON record per book: facts plus our editorial layer             |
| `data/light/`            | Facts-only listings for more of the most-read books (not indexed)    |
| `data/vocab/`            | Fixed vocabulary: genres, moods, tropes, content warnings, feelings  |
| `data/schema/`           | JSON Schema for book records                                         |
| `config/stores.json`     | Every retailer: URL templates, commission, cookie window             |
| `config/affiliates.json` | Public affiliate IDs (blank until a program approves us)             |
| `src/site/`              | Page templates and data loading                                      |
| `src/assets/`            | CSS, browser scripts, brand images (`brand/`) and paintings (`bg/`)  |
| `src/shared/`            | Code shared by the build and the edge functions                      |
| `functions/`             | Cloudflare Pages Functions (`/go/...`, `/api/...`)                   |
| `scripts/`               | Build, setup, validation, SEO audit and catalogue tools              |
| `tests/`                 | Unit tests (`node --test`)                                           |
| `docs/`                  | Product, architecture, design, SEO, catalogue, editorial, deployment |

## Adding a book

Read the [editorial guide](docs/editorial-guide.md). In short: copy a file in `data/books/`, write
original text, keep `status: "draft"`, run `npm run review -- <slug>`, then have a person check it
against two public sources before setting `status: "reviewed"`.

## Configuration and secrets

`npm run setup` creates `.env` from [.env.example](.env.example). `.env` is git-ignored and only
used by local data-refresh scripts, so you can leave it empty to run the site. The deployed site's
one secret, `EMAIL_API_KEY` for the sign-up form, is a Cloudflare Pages secret, and deploy
credentials live in GitHub repository secrets. See [docs/deployment.md](docs/deployment.md).

## Ground rules

- Original text only. No scraping of retailer or competitor pages; facts come from open sources.
- No hosting of, or links to, pirated copies.
- Affiliate links are disclosed next to the buttons and never change which books we recommend.
- Ratings come from Hardcover readers and are credited as text, never linked.

## Changing the logo

The master is `src/assets/brand/logo.png`. `node scripts/make-brand.mjs` regenerates the favicon,
app icons and link-preview image from it. The transparent mascot used in the header,
`src/assets/brand/mark.png`, is cut from the logo and committed.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

All rights reserved. No license has been granted yet; see [CONTRIBUTING.md](CONTRIBUTING.md).
Logo and brand images are the property of the project owner. Background paintings are public domain
(see `/about/credits/` on the site).
