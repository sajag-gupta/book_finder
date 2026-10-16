# Architecture

```
data/ (JSON, in git) ─► scripts/build.js ─► dist/ (static HTML) ─► Cloudflare Pages
                                                  │
reader clicks a store button ─► /go/<store>/<isbn13> (Pages Function)
                                   ├─ validate store + ISBN-13 checksum
                                   ├─ build URL from config/stores.json (+ affiliate IDs)
                                   ├─ log row to D1 (waitUntil, never blocks)
                                   └─ 302 to the store
```

## Decisions

**Editorial data lives in git, not a database.** Every change to a book is a reviewable diff, the
schema is enforced in CI, and there is nothing to host. D1 is used only for the click log. If the
catalogue outgrows files (thousands of books, frequent price writes), add a nightly job that loads
`data/` into D1 and move offers there first.

**One redirect owns all outbound links.** Pages never contain a retailer URL, so affiliate IDs and
store templates change in one config file. Links with no approved program fall back to a plain URL
automatically. Targets come only from `config/stores.json`; the optional `?q=` hint is URL-encoded
into a fixed template, so the endpoint cannot be used as an open redirect.

**Pure shared logic, tested.** `src/shared/` has no I/O: ISBN validation, URL building, offer ranking
and click records. The build and the edge function import the same code, so what a page links to and
what the redirect resolves cannot drift apart.

**Drafts never ship to production.** `status: "draft"` books are included only by `--include-drafts`
builds, which are marked `noindex` and disallowed in `robots.txt`. A book can only become `reviewed`
with two sources, a reviewer and a date; the validator enforces this.

**Privacy.** The click log stores store, ISBN, whether it was an affiliate link, the referring host
and country. No IP address, no user agent, no cookies.

**No scraping.** Facts come from open sources (Open Library, Hardcover, Google Books as a cross-check)
under their published limits. Prices come only from approved affiliate feeds.

## Any book, never a dead end

Our editorial catalogue is a curated layer, not the limit of what readers can find. Search
(header suggestions and `/books/?q=`) shows our books first, then fills in from Open Library through
`/api/search`. Choosing one opens `/b/?isbn=...`, a static shell that `/api/book` fills with facts
(title, authors, year, pages, publisher, subjects) and the full where-to-get-it table, library first.
If the ISBN is one of our books, the shell redirects to its full page.

- Only English editions' ISBNs are used (a work lists every translation's ISBN, and linking a reader
  to an Urdu edition of an English book would be worse than showing nothing).
- Open Library's free-text descriptions are not shown: they are often copied publisher blurbs. Books
  outside the catalogue get facts and subjects, not prose.
- Responses are cached at the edge (an hour for search, a day for a book), and empty search results
  for only two minutes so a hiccup cannot stick. `OL_CONTACT` (a Pages variable) identifies us to
  Open Library, which asks for it.

## Offers

`config/stores.json` lists every retailer with its kind (`library`, `print`, `used`, `ebook`,
`audio`), plain and affiliate URL templates, the IDs required for the affiliate form, a planning
commission rate and a cookie window. `src/shared/offers.js` ranks offers: lowest total price first,
unknown prices last, ties to the higher-paying program, library always kept.

Price data is optional: drop `data/offers/<isbn13>.json` (`[{ "store", "price", "shipping", "currency",
"checkedAt" }]`) and the book page shows prices and the lowest-price badge. Until a feed exists the
page says "Check price". Amazon prices must not be shown until its API terms are confirmed.

## Known gaps

- Ebook and audio links search by title and author, not by edition ISBN.
- Libby links are a generic OverDrive search; per-library deep links depend on the Title Link API terms.
- Cover images are loaded from Open Library by ISBN. Confirm their cover terms before launch.
- The price-refresh job is not built yet (see the offers section above).
- Share cards and the weekly email exist; see [newsletter.md](newsletter.md).
- Sending is manual: `npm run email` renders the issue and you paste it into the email service.
