# Deployment

Hosting is Cloudflare Pages (static files plus the `/go` function) with D1 for the click log.
Deploys run from GitHub Actions ([.github/workflows/deploy.yml](../.github/workflows/deploy.yml)),
because Wrangler's native dependencies do not run on some locked-down workstations.

## Current state

The D1 database (`book-finder`) and the Pages project (`book-finder`, production branch `main`,
`DB` binding on production and preview) already exist, and the GitHub secrets and variables below
are set. The site is at <https://readyourmood.app> (also reachable at `www.` and the original `book-finder-azs.pages.dev`). Canonical links and the sitemap use `readyourmood.app`.
The steps below are kept for recreating the setup in another Cloudflare account.

## One-time setup

1. Create the D1 database and note its ID:
   `npx wrangler d1 create book-finder`, then put the ID in [wrangler.toml](../wrangler.toml).
2. Create the Pages project:
   `npx wrangler pages project create <name> --production-branch main`.
3. In the GitHub repository settings add:
   - **Secrets:** `CLOUDFLARE_API_TOKEN` (permissions: Pages Edit, D1 Edit, Workers Scripts Edit) and
     `CLOUDFLARE_ACCOUNT_ID`.
   - **Variables:** `CLOUDFLARE_PAGES_PROJECT` (the Pages project name) and `SITE_URL` (public URL, no
     trailing slash).
4. Bind the D1 database to the Pages project as `DB` (Pages project → Settings → Bindings), for both
   production and preview.

Pushing to `main` then validates, tests, builds, applies D1 migrations and publishes.

## Pages variables and secrets

| Name            | Kind     | Used by                                   |
| --------------- | -------- | ----------------------------------------- |
| `EMAIL_API_KEY` | secret   | `/api/subscribe` (Buttondown)             |
| `OL_CONTACT`    | variable | `/api/search`, `/api/book` (Open Library) |

## Nightly refresh

[deploy.yml](../.github/workflows/deploy.yml) also runs every night at 03:23 UTC. It refreshes
`data/trending.json` from Hardcover (secret `HARDCOVER_TOKEN`), rebuilds and redeploys, so the
"Trending now" shelf stays current without a commit. If the API is down, the committed snapshot is
used.

## Search engines

- **Bing, Yandex, Naver:** `npm run indexnow` submits every sitemap URL through the IndexNow
  protocol. No account is needed: the engines verify the key file in `public/`. Run it after a deploy.
- **Google:** has no IndexNow. Add the site in Google Search Console (URL prefix property), verify it,
  and submit `sitemap.xml` under Sitemaps. `robots.txt` also names the sitemap.

## Newsletter sign-up

The footer and home-page forms post to `/api/subscribe`
([functions/api/subscribe.js](../functions/api/subscribe.js)), which adds the address to Buttondown
with `EMAIL_API_KEY`. That key is a **Pages secret** (Pages project → Settings → Variables and
Secrets, or `wrangler pages secret put EMAIL_API_KEY`), never part of the repo or the build.
Buttondown sends the double opt-in confirmation. The handler uses a honeypot and a same-origin
check; add Cloudflare Turnstile if spam appears.

## Production content

`npm run build` publishes `reviewed` and `checked` books (see [catalogue.md](catalogue.md)).
Drafts only appear in `npm run build:preview`, which is `noindex`.

## Affiliate IDs

**Amazon (and Audible).** Join Amazon Associates, then put the store ID in `amazon_tag` in
`config/affiliates.json`. Until it is set, Amazon links are plain. Audible runs through the same account;
add the exact link format Associates gives you to `config/stores.json` before turning it on.

**Rakuten (Kobo).** Two different IDs exist. `kobo_partner_id` is the short alphanumeric code after
`id=` in your tracking links (not your numeric account/publisher ID). `kobo_merchant_id` is the
program's MID and only works once Rakuten approves you for that program: Kobo US is `37217`
(Brazil is `40380`, which only tracks Kobo's Brazilian store). This site is approved for Kobo US and
uses `37217`. Had it been left empty, the link builder would serve a plain Kobo link instead of a
broken one. A test (`tests/links.test.js`) pins the US MID and the `kobo.com/us` destination.

Edit [config/affiliates.json](../config/affiliates.json) as programs approve you. Stores with a
missing ID serve plain links; no code change is needed. Verify each program's real link format after
approval and adjust `config/stores.json` if it differs.

## Before launch

- Confirm Open Library cover and data terms (openlibrary@archive.org).
- Read Cloudflare's current terms for commercial use of the free tier.
- Read Amazon's API terms before showing Amazon prices.
- Add the affiliate disclosure wording your networks require.
