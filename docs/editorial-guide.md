# Editorial guide

The records in `data/books/` are the product. Facts come from open sources; everything else is ours.

## Rules

1. **Original text only.** Never copy or lightly reword a publisher blurb, a review or another site's
   list. Write from your own reading and from public facts.
2. **Verify.** Check each book against at least two public sources (for example Open Library and the
   publisher's page). A wrong plot detail costs trust.
3. **One reason per pick**, specific enough that a reader can tell why this book and not another.
4. **Content warnings are short and factual.** Use the fixed vocabulary in `data/vocab/warnings.json`.
5. **Stay inside the vocabulary.** Moods, tropes and warnings come from `data/vocab/`. Add a new tag
   there first (it should apply to several books).

## Record fields

See [data/schema/book.schema.json](../data/schema/book.schema.json). Highlights:

| Field                     | Notes                                                                    |
| ------------------------- | ------------------------------------------------------------------------ |
| `slug`                    | Kebab-case, must equal the file name                                     |
| `isbn13`                  | The identity across stores. Pick a widely stocked print edition          |
| `pace`, `length`          | `slow/medium/fast`; `short` < 300 pages, `medium` 300-450, `long` > 450  |
| `summary`                 | One or two sentences, up to 400 characters, no spoilers beyond the setup |
| `readIf`, `skipIf`        | One sentence each                                                        |
| `pairings`                | 2 or more "if you loved this" picks, each with a reason and `moodShift`  |
| `status`                  | `draft` until a person has checked it, then `reviewed`                   |
| `sources`                 | Public pages used to check facts. Two or more for `reviewed`             |
| `reviewedBy`/`reviewedOn` | Who checked it and when (`YYYY-MM-DD`)                                   |

## Adding or reviewing a book

1. Copy an existing file in `data/books/` and rename it to the new slug.
2. Write the fields. Leave `status` as `draft`.
3. If it belongs to a series, add or update the file in `data/series/`.
4. Run `npm run validate`, then `npm run review -- <slug>` (needs `OL_CONTACT` in `.env`).
5. Open `.review/report.md`. It shows the automatic fact checks and the text to read, with a
   checklist. Fix the record for any FAIL, and look into any WARN by hand.
6. When you have read the text and are satisfied, publish it under your name:
   `npm run review -- --approve <slug...> --reviewer "Your Name"`
   (add `--accept-warnings` once you have checked every warning). This records the sources, your
   name and today's date and sets `status` to `reviewed`.
7. Open a PR. `npm run build:preview` shows how the page looks.

## What the automatic check does and does not do

It compares **objective facts** with two independent public sources, Open Library and the book's
Wikipedia article: ISBN against title, author, first-publication year, and page count against the
`length` band. The Wikipedia article is accepted only if its title is this exact book and its intro
names the author. Sources are used to check facts, never to copy text.

It does **not** judge the summary, read-if/skip-if, moods, tropes, content warnings or pairing
reasons. That is the reviewer's job, and why approval needs a name. Do not approve what you have not read.

Where Open Library and Wikipedia disagree on the year, the check warns instead of failing, because
Open Library's work-level year is sometimes wrong. Settle it from a third source.

## The `checked` level

Most of the catalogue is `checked`: facts verified automatically, text not yet read by a person (see
[catalogue.md](catalogue.md)). To promote one, read its report entry
(`npm run review -- <slug>`), then run the `--approve` command above. Content warnings are the field
most worth your attention: they are written conservatively and can be incomplete.

## Status of the launch batch

The 13 records that ship with the scaffold are **drafts** written from general knowledge and
cross-checked only for ISBN and title. They need the review above before they go live.
