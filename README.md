# Book Finder

A mood-first book finder that also shows, for any book, every place to buy, borrow or listen to it
in every format, at the best price.

1. **Decide what to read.** Say how you want to feel, or name a book you loved. Get a short list with
   a plain reason for each pick, written by us. 700 books: the best sellers of all time plus genre
   staples, filterable by genre, mood, length, pace and content warnings.
2. **Get it the cheapest way.** Open a book and see print, ebook, audiobook and library options
   side by side. Library borrowing is always shown first.

Also: bestseller rankings, a nightly "Trending now" shelf from Hardcover's API, genre, mood, trope and
author pages, a private reading shelf (statuses, half-star ratings, stats, Goodreads/StoryGraph CSV
import), content warnings you can hide until you ask, a weekly email, and shareable cards. See [docs/catalogue.md](docs/catalogue.md) for how the catalogue is built and what
`checked` and `reviewed` mean.

Store buttons are affiliate links where a program exists. See [docs/product.md](docs/product.md) for
the product plan and [docs/architecture.md](docs/architecture.md) for how it is built.

> Working title: **After the Dragons**. It is set in one place (`site.name` in
> [scripts/build.js](scripts/build.js)).

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
filters, search suggestions and the saved shelf. Icons are inlined Lucide SVGs.

## Quick start

Requires Node.js 24 or newer (see [.nvmrc](.nvmrc)).

```bash
npm ci
npm run check        # lint, format check, data validation, tests
npm run build:preview
```

`build:preview` includes draft books and marks every page `noindex`. Serve `dist/` with any static
server to look at it. `npm run build` is the production build and publishes `reviewed` and `checked`
books (about 1,200 pages and 1,000 share cards).

| Command                   | What it does                                                                      |
| ------------------------- | --------------------------------------------------------------------------------- |
| `npm run check`           | Lint, format check, data validation and tests (what CI runs)                      |
| `npm run build`           | Production build to `dist/` (reviewed and checked books)                          |
| `npm run build:preview`   | Preview build including drafts, `noindex`                                         |
| `npm run validate`        | Validate every record in `data/` against the schema and vocab                     |
| `npm run email -- <date>` | Render a weekly issue to HTML and text (see docs/newsletter.md)                   |
| `npm run review`          | Fact-check drafts; `-- --mark-checked` or `-- --approve <slug> --reviewer "Name"` |
| `npm run enrich`          | Add Hardcover ratings, pages, series and reader warnings (needs HARDCOVER_TOKEN)  |
| `npm run discover -- 150` | List the most-read books we are missing (`--write` adds them to the catalogue)    |
| `npm run trending`        | Refresh data/trending.json from Hardcover's API (needs HARDCOVER_TOKEN)           |
| `npm run verify:isbns`    | Cross-check each ISBN against Open Library and Google Books                       |
| `npm run dev`             | Preview build plus `wrangler pages dev` (needs local Wrangler)                    |

## Repository layout

| Path                     | Purpose                                                              |
| ------------------------ | -------------------------------------------------------------------- |
| `data/books/`            | One JSON record per book: facts plus our editorial layer             |
| `data/series/`           | Reading-order lists                                                  |
| `data/vocab/`            | The fixed vocabulary of moods, tropes and content warnings           |
| `data/schema/`           | JSON Schema for book records                                         |
| `config/stores.json`     | Every retailer: URL templates, commission, cookie window             |
| `config/affiliates.json` | Public affiliate IDs (blank until approved)                          |
| `src/shared/`            | Code shared by the build and the edge function (links, offers, ISBN) |
| `src/site/`              | Page templates and data loading                                      |
| `src/assets/`            | CSS and the small browser scripts (site, browse, shelf, share)       |
| `functions/`             | Cloudflare Pages Functions (`/go/...`, `/api/subscribe`)             |
| `migrations/`            | D1 database migrations                                               |
| `scripts/`               | Build, validation and ISBN verification                              |
| `tests/`                 | Unit tests (`node --test`)                                           |
| `data/catalogue/`        | The 500-book list with ISBNs and sales estimates                     |
| `docs/`                  | Product, catalogue, architecture, editorial guide, deployment        |

## Adding a book

Read the [editorial guide](docs/editorial-guide.md). In short: copy an existing file in
`data/books/`, write original text, keep `status: "draft"`, run `npm run review -- <slug>`, then have a
person check it against two public sources before setting `status: "reviewed"`.

## Configuration and secrets

Copy [.env.example](.env.example) to `.env`. `.env` is git-ignored and is only used by local scripts.
The deployed site's one secret, `EMAIL_API_KEY` for the sign-up form, is a Cloudflare Pages secret. Deploy credentials live in GitHub repository secrets. See
[docs/deployment.md](docs/deployment.md).

## Ground rules

- No scraping of retailer or competitor pages. Facts come from open sources, text is ours.
- No hosting of, or links to, pirated copies.
- Sponsored placements, if ever added, are labelled and never mixed into mood results.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).

## License

All rights reserved. No license has been granted yet; see [CONTRIBUTING.md](CONTRIBUTING.md).
