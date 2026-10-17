# The catalogue (about 700 books)

How the catalogue was built, what the quality levels mean, and how to extend it.

## Scope

About 700 novels across romance and romantasy, fantasy, science fiction, thriller, mystery, crime, horror,
historical, young adult, literary fiction, classics and children's classics. Non-fiction and
self-help are out of scope for now: the mood, trope and content-warning tags are built for stories.

## Where the list comes from

| Group      | Count | Source                                                                                                                                   |
| ---------- | ----- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `all-time` | ~80   | Fiction titles from Wikipedia's "List of best-selling books", with its sales estimate. Estimates are approximate and vary widely.        |
| `modern`   | ~420  | Genre staples and current best sellers chosen for the launch genres: BookTok favourites, long-running series openers, enduring classics. |

Only `all-time` books carry `soldMillions`. The site ranks those on `/bestsellers/` and labels the
figure an estimate. Modern books have no sourced sales number, so they are never ranked by sales.
`data/catalogue/catalogue.json` is the list (title, author, first-publication year, genres, ISBN-13).

## Pipeline

1. **Catalogue** (`data/catalogue/catalogue.json`): the list above.
2. **ISBNs** (`npm run catalogue:isbns`): finds an English print ISBN-13 for each title through Open
   Library and keeps it only if it has a valid check digit and the Open Library edition's title
   matches. Resumable.
3. **Editorial drafts**: moods, tropes, content warnings, pace, length, summary, read-if/skip-if and
   2 to 3 "if you loved this" pairings, written from a fixed vocabulary (`data/vocab/`). Drafted in
   batches, validated by `node scripts/validate-drafts.js`.
4. **Merge** (`node scripts/merge-catalogue.js`): writes `data/books/<slug>.json` as `draft`.
5. **Fact check** (`npm run review -- --mark-checked`): see below.
6. **Human review** (`npm run review -- --approve ...`): upgrades a book to `reviewed`.

## Hardcover data

`npm run enrich` adds Hardcover's aggregate facts to `data/hardcover.json`: average rating and number of
ratings, number of readers, page count, series name, position and total, moods, and reader-reported
content warnings. Book pages show the rating (only with at least 20 ratings), page count, series
position, and any reader-reported warnings we do not already list, always crediting Hardcover with a
link. Browse can sort by "Most read on Hardcover".

Hardcover's terms allow aggregate data with attribution. We never store descriptions, reviews or
readers' libraries, and nothing from Hardcover is used to train a model. Our own text is still
written by us. Refresh with `npm run enrich -- --refresh`.

`npm run discover -- 150 --write` pages through Hardcover's most-read books, drops anything already
in the catalogue (matching titles and authors loosely, so "Liu Cixin" equals "Cixin Liu"), and
appends the rest. They then go through the usual steps below.

## Trending additions

`npm run trending` lists what readers are currently reading on Hardcover (last 30 days) that the
catalogue lacks. The first run added about 50 titles (Dungeon Crawler Carl and sequels, more Sarah J.
Maas and Colleen Hoover, Pierce Brown, Brandon Sanderson, current romantasy and thrillers) through
the same pipeline. Re-run it now and then to keep the catalogue current.

## Status levels

| Status     | Meaning                                                                                                                        | Published?       |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| `draft`    | Not verified, or verification failed.                                                                                          | Preview only     |
| `checked`  | Title, author, year and edition matched Open Library plus a second independent source (Wikipedia or Hardcover). Text not read. | Yes, with notice |
| `reviewed` | A person read it, checked it against two sources and signed off (name and date recorded).                                      | Yes              |

Every `checked` book page says the description has not yet been read by an editor. Nothing is ever
marked `reviewed` on someone's behalf.

## Held-back books

16 books are not published yet because a second independent source did not confirm them:
Babel, Behind Closed Doors, Blood of Elves, Dust, Heartstopper: Volume One, Icebreaker, Infinite Jest, Mistborn: Secret History, Pretty Girls, Rogue Protocol, The Girl Before, The Secret Life of Bees, The Unhoneymooners, There Is No Antimemetics Division, Twenty Thousand Leagues Under the Sea, Ulysses.
Either Open Library's work-level year is wrong for the book and neither Wikipedia nor Hardcover
states ours, or neither could be matched to the exact book. The records are believed correct, but
"checked" has to mean verified, so a person should confirm each and then run
`npm run review -- --approve <slug> --reviewer "Name"`.

Eight more books were drafted but have no usable English ISBN yet (mostly translations and
unusual titles) and are left out of the catalogue's merged records: I Who Have Never Known Men,
Before the Coffee Gets Cold, Tender Is the Flesh, The Sword of Kaigen, The Seven Deaths of Evelyn
Hardcastle, The Girl Who Kicked the Hornet's Nest, The Serpent and the Wings of Night, and The
Waste Lands. Add an ISBN to `data/catalogue/catalogue.json` and rerun the merge to include them.

## What the automatic check does

Per book, it compares the record with Open Library (the ISBN's edition, the work's author and
first-publication year, the edition's page count against the `length` band), with the Wikipedia
article whose title is exactly this book, and with Hardcover's record. It fails on a wrong ISBN, a
wrong author, or a year more than one off that nothing confirms. Disagreements between sources
(Open Library's work-level year is often an early or foreign edition) are warnings.

It does not judge the editorial text. Content warnings in particular are written conservatively from
general knowledge and can be incomplete: `reviewed` is the level that means a person checked them.

## Adding books

1. Append entries to `data/catalogue/catalogue.json` (without `isbn13`).
2. `npm run catalogue:isbns`, then `npm run catalogue:index` to regenerate the reference list.
3. Draft records to `.work/records/*.json` (see `scripts/validate-drafts.js` for the format).
4. `node scripts/merge-catalogue.js`, `npm run validate`, then `npm run review -- --mark-checked`.
