# Weekly email and share cards

## Weekly email: three picks and one deal

Each issue is one file, `data/newsletter/<date>.json`:

```json
{
  "date": "2026-10-23",
  "subject": "Three cozy reads for a tired week",
  "intro": "One or two sentences in your own voice.",
  "picks": [
    { "slug": "legends-and-lattes" },
    { "slug": "the-hobbit" },
    { "slug": "dune", "note": "Optional line replacing the default 'Read this if'." }
  ],
  "deal": null
}
```

- Exactly **3 picks**, each a **reviewed** book. `npm run validate` enforces this, so a draft can
  never reach a subscriber.
- `deal` is optional because there are no price feeds yet. We only share a price we have checked.
  When there is one:
  `{ "slug": "dune", "store": "kobo", "headline": "Dune ebook is on sale", "detail": "Optional.", "checkedOn": "2026-10-22" }`.
  `checkedOn` is required and printed in the email ("Price seen ..."), so a stale price is visible.
  The deal button goes through `/go/...`, so it is an affiliate link as soon as that store's ID is set.

Render and send:

```bash
npm run email -- 2026-10-23
```

This needs `SITE_URL` in `.env` and writes `out/email/<date>.html` and `.txt` (git-ignored). Paste the
HTML into your email service's HTML/source editor (or import it as a template), send yourself a test,
then schedule it. Every link carries `utm_source=newsletter&utm_medium=email&utm_campaign=<date>`.

### Compliance

Commercial email needs a physical postal address and a working unsubscribe link. Most services add
both from your account settings. The command warns until you either fill in
[config/newsletter.json](../config/newsletter.json) or confirm in a test send that your service adds
them. The email also carries the affiliate disclosure.

## Share cards

`npm run build` writes two PNGs per published book into `dist/share/`:

| File                   | Size      | Use                                  |
| ---------------------- | --------- | ------------------------------------ |
| `/share/<slug>.png`    | 1080x1350 | Instagram, TikTok photo posts, chats |
| `/share/<slug>-og.png` | 1200x630  | Link previews (`og:image`)           |

The book page shows the card with a download link, and a share or copy-link button where the browser
supports it. Cards are text only (title, author, up to three mood chips, the read-this-if line and
the page address): no cover art, because cover rights are not settled.

Rendering uses `satori` (layout to SVG) and `@resvg/resvg-wasm` (SVG to PNG). Both are pure
JavaScript/WebAssembly, so no native binaries are needed. Fonts (Fredoka, Nunito Sans) come from
`@fontsource` under the SIL OFL licence. `npm run build -- --skip-share-cards` skips them for quick
local iterations.
