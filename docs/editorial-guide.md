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
4. Run `npm run validate`, then `npm run verify:isbns` (needs `OL_CONTACT` in `.env`).
5. Check the facts against two sources, fill `sources`, `reviewedBy`, `reviewedOn`, and set
   `status` to `reviewed`.
6. Open a PR. `npm run build:preview` shows how the page looks.

The 13 records that ship with the scaffold are **drafts** written from general knowledge and
cross-checked only for ISBN and title. They need the full review above before they go live.
