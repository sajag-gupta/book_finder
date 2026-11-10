# Rulebook: how work on ReadYourMood gets done

This is the exact process used to build and run the project. Follow it and a different person or AI
agent produces the same quality. [AGENTS.md](../AGENTS.md) is the short version; this is the full one.
If a rule here conflicts with a direct instruction from the owner (Sajag Gupta), the owner wins, but say
what you are changing and why.

## 0. The owner and how to talk to them

- The owner wants **speed, honesty and plain language**. Do not ask permission for routine steps; make
  the product decision, do it, and report. Ask only when something is genuinely theirs to decide
  (spending money, accepting terms, entering their payment or tax details, buying a domain).
- **Never claim what you did not verify.** Say "I checked X by doing Y" and "I did not check Z". If a
  test failed, say so with the reason. If a source did not answer, say that, do not guess.
- **Tokens are a budget.** Do not run long jobs "to be thorough" without saying how long they take.
  Prefer scripts over reading large files into the conversation. Stop background jobs you started
  when they are no longer needed.
- Style of messages: short sections, the answer first, no jargon without a one-line explanation, no
  emoji, no filler. When the owner asks "how much is done / what are you doing", answer in numbers and
  name what is running and what is waiting on them.
- The owner reads results on a phone and a company laptop that **blocks new websites** (see section 9),
  so give links they can open elsewhere and never say "open the site on this machine".

## 1. The environment (read before running anything)

The work machine is a locked-down Windows laptop. These facts cost hours when forgotten.

| Fact                                                                                                   | What to do                                                                                                                          |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| Node is a portable copy in `.tools/node` (Windows blocks installers and native `.exe` files).          | Put it on `PATH` for each command: PowerShell `$env:Path='<repo>\.tools\node;'+$env:Path`. Node 24 or newer is required (`.nvmrc`). |
| `npm ci` runs install scripts that try to download native binaries (esbuild, workerd) and are blocked. | Use `npm ci --ignore-scripts` (that is what `npm run setup` does). Wrangler is only needed for `npm run dev`; CI deploys.           |
| The Bash tool lacks `cat head tail grep wc rm cp mkdir ls sleep`.                                      | Use the dedicated Read, Grep, Glob and Edit tools, PowerShell, `git`, or a small Python or Node script.                             |
| PowerShell mangles quotes inside inline `node -e` / JSON strings.                                      | Write a script file (`.mjs`) and run it, or put JSON in a file and pass `@file` to `scripts/ops/http.mjs`.                          |
| Python's TLS check fails for some hosts here ("Missing Authority Key Identifier").                     | Use Node's `fetch` (`scripts/ops/http.mjs`, `scripts/ops/ship.mjs`) for API calls.                                                  |
| Python on Windows writes `\r\n` when you `open(p,'w')`.                                                | Always write with `newline='\n'`. Run `npx prettier --write` on what you touched; the repo is LF only.                              |
| Writing JS from Python strings breaks backslashes (`\d`, `\s`, `\u`).                                  | Write JS/CSS with the Write or Edit tool, and re-read the result.                                                                   |
| Process spawned in the background keeps running after the shell call.                                  | Track IDs; stop with `Stop-Process` when done. Before a rebuild, stop the dev server (`dist/` can be locked on Windows).            |
| `playwright-cli screenshot` needs an open session and an explicit filename.                            | `playwright-cli open --browser=msedge <url>` first; `--filename=out/qa/x.png`; check the file exists.                               |
| The company network blocks `readyourmood.app` (new domain).                                            | Test the same build through `https://book-finder-azs.pages.dev`; confirm the real domain from outside via a public checker.         |

Secrets are never typed into chat history by you and never committed (section 8).

## 2. The change workflow (every change, no exceptions)

1. **Start from fresh main.** `git fetch origin`, then `git switch -c <type>/<short-name> origin/main`.
   Branching from a stale local `main` silently reverts other people's merged work (this happened).
   Use a separate worktree (`git worktree add ../Book_finder_cat -b <branch>`) when a long job is
   running elsewhere; the junction trick for `node_modules` and `.tools` is in section 10.
2. **Make the smallest change that does the job.** Read the surrounding code first and match its style,
   naming and comment density. Do not refactor what you were not asked to touch.
3. **Run the checks** (section 3) until all pass. Never weaken a test to make it pass; if a test is
   wrong because behaviour legitimately changed, update it and say why in the PR.
4. **Look at it in a real browser** for any visual or page change (section 4).
5. **Commit** with a message that says what and why, ending with the co-author line required by the
   environment. One logical change per commit. Never commit `.env`, tokens, `dist/`, or scratch files.
6. **Push the branch, open a PR, wait for CI, squash-merge, wait for Deploy.**
   `node scripts/ops/ship.mjs <branch> "<title>" <bodyFile>` does all of it and refuses to merge unless
   every check run succeeded. For an already open PR: `node scripts/ops/ship.mjs --existing <n> "<title>"`.
   Never force-push. Never push straight to `main`.
7. **Verify live.** After Deploy succeeds, fetch the deployed pages and confirm the change is there
   (section 5). The deployed build is readable at `https://book-finder-azs.pages.dev`.
8. **Report** using section 11.

PR body: what changed, why, how it was verified (commands and numbers), and what was not done. End it
with the Claude Code attribution line the environment specifies.

## 3. The checks (what "passes" means)

Run from the repo root with Node on `PATH`:

```bash
npm run check                          # lint + prettier check + data validation + all tests
npm run build -- --skip-share-cards    # fast build, must succeed
npm run seo                            # audit dist/: 0 errors required (warnings are listed, not fatal)
```

- `npm run check` must exit 0. CI runs the same plus a full build (with share cards).
- `SITE_URL=https://readyourmood.app` should be set for builds whose canonical URLs you inspect.
- **Lighthouse** (optional but recommended for page changes): the taste skill's inspector or
  `npx lighthouse@12 <url> --only-categories=seo,accessibility,best-practices,performance` with
  `CHROME_PATH` pointing at Edge. Targets seen so far: SEO 100, accessibility 94 to 100, best practices
  96 to 100, performance 78 to 99.
- Generated files that Prettier must skip are listed in `.prettierignore` (`data/covers.json`,
  `data/light/books.json`). Add a generated file there rather than hand-formatting it.
- Cloudflare Pages allows 20,000 files per deploy. A full build is about 12,000 files. Check the count
  (`dist/`) before adding anything that multiplies pages or images.

## 4. Visual work

- Follow the design decisions in [docs/design.md](design.md): Fraunces headings, Inter text, flat
  surfaces (no shadows at rest, no hairlines, no gradients), sentence-case labels, one accent, real
  pictures. The `design-taste-frontend` skill is installed locally (`.claude/skills/`, git-ignored): run
  its `inspect.mjs` against the served site and fix every FAIL. Report which WARNs remain.
- **The Content-Security-Policy forbids inline scripts and `style="..."` attributes** (`public/_headers`).
  Use CSS classes. `npm run serve` sends the same policy, so breakage shows up locally. (A page once
  shipped with inline styles that only broke in production.)
- Screenshots: serve with `npm run serve`, drive Edge with `playwright-cli`, capture **desktop 1440,
  tablet 820 and phone 390 px**. For every changed page type check: no horizontal overflow
  (`document.documentElement.scrollWidth - clientWidth` is 0), no clipped text, readable contrast on
  both light and dark themes, keyboard focus visible, and headings no longer than two lines.
- Backgrounds are public-domain paintings in `src/assets/bg/` with credits in `credits.json`; new ones
  are fetched with the skill's `assets.mjs --get` (licence and credit recorded automatically) and
  listed on `/about/credits/`.
- Brand: master logo `src/assets/brand/logo.png`; `node scripts/make-brand.mjs` regenerates icons and
  the link-preview image. The transparent `mark.png` is cut by hand and committed.

## 5. Verifying a deploy

After Deploy succeeds, run a small Node script (not a browser) against the live build:

- canonical, `og:url` and `og:image` use `https://readyourmood.app`;
- `sitemap.xml` has the expected URL count and lists no `pages.dev` address;
- `robots.txt` has the Sitemap line and the AI-crawler rules; `llms.txt` mentions the domain;
- the page you changed contains the change; store redirects behave (`/go/<store>/<isbn>`, section 7);
- the deployed Content-Security-Policy header is present.

## 6. Content and data rules

- **Original text only.** Never copy a publisher blurb, review or another site's list. Never invent a
  plot detail, award, rating or content warning. **If you do not know a book, mark it `skip`.**
- Ratings come from Hardcover readers and are credited as the plain text "Hardcover readers", never
  linked. Show a rating only with at least 20 ratings. Sales figures are labelled estimates.
- Do not scrape retailer pages or reviews. Facts come from open sources and official APIs (Open
  Library, Hardcover API, Google Books API, Wikipedia API). Do not store Hardcover descriptions.
- Content warnings are conservative and factual, from the fixed vocabulary in `data/vocab/warnings.json`.
- Quality tiers: `draft` (not published), `checked` (facts verified against two sources, text not read
  by a person; pages say so), `reviewed` (a person signed off). **Never mark anything `reviewed` on
  someone's behalf.** Light listings (`data/light/books.json`) are facts-only, `noindex`, and give way to
  a written page as soon as one is published.
- Titles: long subtitles are cut at the colon for page titles and slugs (see `.work/shorten` logic in
  the history: `title.split(':')[0]` when longer than 48 characters). The SEO audit fails titles over 70
  characters.

### Growing the catalogue

1. Sources are collected into `.work/research/*.json` (title, author, year, kind, list names). They
   come from public lists, awards and top-author lists; the files are scratch (git-ignored).
2. `node scripts/build-candidates.js --target=N --nonfiction=M --lookups=0` ranks candidates
   (Hardcover readers, number of lists, author rank, sales) against Hardcover's 10,000 most-read books
   cached in `.work/hardcover-top.json` (`--fetch-only` refreshes the cache). Add `--lookups=N` only if
   you accept about one second per lookup.
3. `node scripts/prepare-batches.js --size=50`, then one drafting agent per batch using
   `.work/batches/INSTRUCTIONS.md` and `VOCAB.md` (agents write `.work/records/new-NNN.json`; no
   `pairings`, no `length`; `skip` when they do not know the book).
4. `node scripts/validate-drafts.js .work/records/*.json`, then `node scripts/merge-catalogue.js`
   (creates `data/books/*.json` as `draft`), merge Hardcover facts into `data/hardcover.json`.
5. `npm run review -- --mark-checked` fact-checks drafts (slow: about 3 books a minute; run it in the
   background and commit what has passed). Fix the slug and title length afterwards.
6. `npm run covers` finds a working cover per book (Open Library by id, then Google Books). Google
   rate-limits (429): keep concurrency low and never delete entries when a lookup fails.
7. `node scripts/build-light.js` rebuilds the facts-only listings; a book with a written page is removed.
8. `npm run trending:now` and `npm run trending:now:google` keep `data/trending-now.json` (the monthly
   chart list the owner pastes in) resolvable on the site. The list is titles and authors only.

## 7. Money: affiliates and store links

- Every store button goes through `/go/<store>/<isbn13>` (edge function). Stores and URL templates live
  in `config/stores.json`; IDs in `config/affiliates.json`. A store with a missing required ID falls
  back to a plain link. **Never invent an affiliate ID or tracking parameter**; copy the format a
  program gives you and test the generated link.
- **Kobo** (Rakuten Advertising): `kobo_partner_id` is the link ID, `kobo_merchant_id` is `37217`
  (Kobo US; Brazil 40380 is a different approval and is not used). The generated link was verified to
  302 to `kobo.com/us` with `ranMID=37217`.
- **Amazon Associates**: tag `readyourmood-20`. The sentence "As an Amazon Associate I earn from
  qualifying purchases." must stay visible on the site (footer, beside store buttons, disclosure and
  About pages). **Amazon forbids affiliate links in email**, so `/go/amazon/...` with
  `utm_medium=email` redirects without the tag (tested). The first 3 qualifying sales are due within
  180 days of joining. Amazon US payouts need a US bank account; the owner is arranging payment.
- **Audible** runs through Associates. The button ("Try Audible") goes to the Amazon Audible membership
  page (`node=18145289011`, link supplied by the owner from SiteStripe) with the `readyourmood-20` tag;
  it pays a bounty on membership sign-ups, not on single audiobooks, and is not per book. Google Play
  Books has no public affiliate program, so it was removed from the store list.
- **Removed for good:** Awin, Bookshop.org, Libro.fm (Awin rejected the applications), Impact,
  ThriftBooks, AbeBooks, Barnes & Noble. There is a test that none of them reappear.
- Every affiliate link is disclosed near the buttons and on `/about/affiliate-disclosure/`, carries
  `rel="sponsored nofollow noopener"`, and never changes which books are recommended.

## 8. Secrets and credentials

- **Never commit a token, key or `.env`.** The repository is **public**. A secret pushed once is
  readable in git history forever; deleting the file later does not help, only rotating the key does.
- Local keys live in `.env` (git-ignored); names are listed in `.env.example`. Deploy and CI keys live
  in GitHub Actions secrets and variables (`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`,
  `CLOUDFLARE_PAGES_PROJECT`, `SITE_URL`) and the Pages secret `EMAIL_API_KEY`.
- To hand the working keys to another machine or agent **without exposing them**, use the encrypted
  vault: `secrets/env.enc.json` is `.env` encrypted with AES-256-GCM (scrypt key). Unlock it with
  `VAULT_PASSPHRASE=<passphrase> node scripts/ops/vault.mjs unlock`. The passphrase is held by the owner
  only and is never written in the repo. Re-lock after changing `.env`:
  `VAULT_PASSPHRASE=... node scripts/ops/vault.mjs lock`.
- The vault is only as strong as the passphrase and is public. If a key may have leaked, rotate it:
  Cloudflare (My Profile, API Tokens), GitHub (Settings, Developer settings), Hardcover, Google Cloud,
  the email provider, Name.com (Account, API Access).
- Token permission limits already found (do not retry what cannot work): the Cloudflare token can
  manage Pages and read zones but **cannot create zones or DNS records**; the Awin token is obsolete;
  Name.com works with username = account email.

## 9. Domain, DNS and hosting

- Live site: `https://readyourmood.app` (apex and `www`), served by Cloudflare Pages project
  `book-finder` (default address `book-finder-azs.pages.dev`). The domain is registered at Name.com,
  with nameservers pointing at Cloudflare (zone `readyourmood.app`). DNS records `@` and `www` are
  CNAMEs to `book-finder-azs.pages.dev`, proxied. HTTPS is issued by Cloudflare.
- Changing the public address means: the `SITE_URL` GitHub variable, the default in
  `src/site/config.js`, then a deploy so canonicals, sitemap, robots, `llms.txt` and link previews follow.
- The company network blocks the new domain. That is the filter, not the site (the same build opens on
  `pages.dev`, and from outside the domain returns 200).
- Cloudflare Pages Functions give `/go/*`, `/api/search`, `/api/book` and `/api/subscribe`; D1 stores the
  click log. Never log personal data.

## 10. Useful mechanics

- Worktree with shared tools: `git worktree add ../Book_finder_cat -b <branch>`, then (PowerShell)
  `cmd /c mklink /J <wt>\node_modules <main>\node_modules` and the same for `.tools`, and copy `.env`.
- Long jobs: run in the background, write progress to a log, and check the log, do not poll in a loop.
- Parallel drafting or research: one subagent per independent batch with a self-contained brief that
  names the files, the output path and the validation command. Check each result; a subagent report is
  a claim, not proof. A subagent that stops on a content-filter error should be restarted with a
  narrower scope that avoids printing page text.
- `scripts/ops/http.mjs` for one-off API calls; `scripts/ops/ship.mjs` for PRs; `scripts/ops/vault.mjs`
  for secrets.

## 11. Definition of done and the report

A change is done when: `npm run check` and `npm run seo` pass, the page was looked at in a browser at
three widths (or the reason it was not is stated), the PR is merged, Deploy succeeded, and the live
build was fetched and shows the change.

Report to the owner, briefly: what changed and where to see it; what you verified and how; what you did
not verify or could not do; anything that needs their action (with exact steps); and the PR link. Say
"live" only after the live check.

## 12. Mistakes already made (do not repeat)

- Branching from a stale `main` (fetch first). Treating a draft record as published when removing
  duplicates (published means `checked` or `reviewed`). Inline `style` attributes (blocked by CSP).
  Quadratic title matching over 20,000 rows (index by normalised title). Deleting Google cover entries
  when a lookup was rate-limited. Opening a PR from a script whose helper path had moved (keep helpers
  in `scripts/ops/`). Telling the owner to "open the site" from a laptop that blocks it. Saying a task
  was running when its process had been stopped. Printing secrets in a command line.
