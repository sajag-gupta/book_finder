# Instructions for AI coding assistants

This file tells an assistant (Claude Code, Codex, Cursor, Copilot, Gemini and others) how to set up
and work on **ReadYourMood**, a book discovery site: "Books for wherever your mind is." Readers say
how they feel now and how they want to feel; the site matches books to that shift and shows every
way to borrow, buy or listen, library first.

## Set up (do this first)

```bash
npm run setup
```

That one command checks Node (needs the version in `.nvmrc`), runs `npm ci --ignore-scripts`, creates `.env` from
`.env.example`, runs lint, format check, data validation and the tests, and builds the site. It needs
no accounts, keys or network access beyond installing packages. If it fails, read the message: it
says what to fix. Then:

```bash
npm run serve        # http://127.0.0.1:8788, with /api/* and /go/* working locally
```

If the user only said "set it up", stop after `npm run serve` works and tell them the address.

## Everyday commands

| Command                               | Use                                                                  |
| ------------------------------------- | -------------------------------------------------------------------- |
| `npm run check`                       | Lint, format check, data validation, tests. Run before every commit. |
| `npm run build`                       | Full production build to `dist/` (share cards included, slower).     |
| `npm run build -- --skip-share-cards` | Fast build for local work.                                           |
| `npm run seo`                         | Audit `dist/` for SEO, structured data, links and the sitemap.       |
| `npm run serve`                       | Serve `dist/` locally with the real API handlers.                    |
| `npm run format`                      | Prettier on everything.                                              |

## How the project is laid out

- `data/books/*.json`: one record per book (our own text plus facts). `data/vocab/` is the fixed
  list of genres, moods, tropes, content warnings and feelings. `data/light/books.json` holds
  facts-only listings. Schema: `data/schema/book.schema.json`.
- `src/site/`: page templates (plain template strings). `src/assets/`: CSS and small browser scripts.
  `src/shared/`: code shared with the edge functions. `functions/`: Cloudflare Pages Functions.
- `scripts/`: build, validation and catalogue tools. `tests/`: `node --test`.
- Docs: `docs/architecture.md`, `docs/design.md`, `docs/seo.md`, `docs/catalogue.md`,
  `docs/deployment.md`, `docs/editorial-guide.md`.
- Brand: `src/assets/brand/` (logo and icons). Change the logo with `node scripts/make-brand.mjs`.

## Rules that are easy to break

1. **Original text only.** Never copy a publisher blurb, review or another site's wording into
   `data/`. Do not invent facts, awards or content warnings. If you do not know a book, skip it.
2. **No secrets in git.** `.env` is ignored. Affiliate IDs in `config/affiliates.json` are public
   IDs only. Never invent an affiliate ID or tracking parameter.
3. **The site's Content-Security-Policy (`public/_headers`) forbids inline scripts and `style="..."`
   attributes.** Use CSS classes and files in `src/assets/`. `npm run serve` sends the same policy,
   so a page that would break in production breaks locally.
4. **Hardcover data is credited as plain text** ("Hardcover readers") and never linked.
5. **No scraping of retailer pages.** Facts come from open sources and public APIs.
6. Keep the line endings LF and run `npm run format` before committing.
7. Store buttons go through `/go/<store>/<isbn>`; stores and URL templates live in
   `config/stores.json`.

## Definition of done

`npm run check` passes, `npm run build -- --skip-share-cards` succeeds, and for any change to pages
`npm run seo` reports 0 errors. Look at the page in a browser at desktop and phone width before
saying a visual change works.
