# Deployment

Hosting is Cloudflare Pages (static files plus the `/go` function) with D1 for the click log.
Deploys run from GitHub Actions ([.github/workflows/deploy.yml](../.github/workflows/deploy.yml)),
because Wrangler's native dependencies do not run on some locked-down workstations.

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

## Production content

`npm run build` publishes **reviewed** books only. Until at least one book is `reviewed`, the
production site has no book pages. Review records first (see the [editorial guide](editorial-guide.md)).

## Affiliate IDs

Edit [config/affiliates.json](../config/affiliates.json) as programs approve you. Stores with a
missing ID serve plain links; no code change is needed. Verify each program's real link format after
approval and adjust `config/stores.json` if it differs.

## Before launch

- Confirm Open Library cover and data terms (openlibrary@archive.org).
- Read Cloudflare's current terms for commercial use of the free tier.
- Read Amazon's API terms before showing Amazon prices.
- Add the affiliate disclosure wording your networks require.
