# Research: where trends and best sellers come from, and what readers expect

Snapshot from 16 October 2026. Features were read from each site's public pages; data was taken
only from official APIs or public lists, and nothing is copied from the sites into ours.

## Where "best selling" and "trending" data can actually come from

| Source                      | What it offers                                                                       | Usable?                                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hardcover API** (GraphQL) | Books most read over a date range (`books_trending`), search, popularity counts      | **Yes, used.** Official, free tier, aggregate data allowed with attribution. No user libraries or reviews, no model training.                      |
| **Wikipedia lists**         | All-time sales estimates                                                             | **Yes, used** for `/bestsellers/` (facts with the estimate caveat).                                                                                |
| **Goodreads**               | "Most read this week" and award lists (web pages only; the public API was shut down) | Read once for research. Not integrated: no API, and its terms restrict automated collection.                                                       |
| **Amazon**                  | Best Sellers charts by category                                                      | Blocked automated requests (HTTP 503). The Product Advertising API is limited to approved affiliates with sales. Revisit after affiliate approval. |
| **Google Books API**        | Search, ISBN lookup, previews                                                        | No bestseller or trending data. Used only as an advisory ISBN cross-check.                                                                         |
| **NYT Books API**           | Weekly bestseller lists                                                              | Free key available. A good next addition for a sourced "this week" list; needs an account.                                                         |

## What Goodreads' most-read list showed this week (11 Oct 2026)

Sarah J. Maas filled eight of the top 30 (the ACOTAR and Crescent City books). Rebecca Yarros
(_Threshing Day_, _Fourth Wing_), Freida McFadden (_The Witch_, _The Divorce_), Colleen Hoover
(_Verity_) and Matt Dinniman (_Dungeon Crawler Carl_ and sequels) were the other big names.
Hardcover's last-30-days data agrees: Dinniman's Carl series dominates, then Pierce Brown, Brandon
Sanderson, Orwell, _Project Hail Mary_, _Piranesi_ and _Harry Potter_. These gaps drove the
catalogue additions in this release.

## Feature comparison

| Feature                                                  | Hardcover | StoryGraph |  Goodreads  | Us (now)                                              |
| -------------------------------------------------------- | :-------: | :--------: | :---------: | ----------------------------------------------------- |
| Shelving statuses (want / reading / read / paused / DNF) |    yes    |    yes     |   partial   | **yes**                                               |
| Star ratings, half stars                                 |    yes    |    yes     | whole stars | **yes**                                               |
| Date read                                                |    yes    |    yes     |     yes     | **yes**                                               |
| Reading stats and charts                                 |    yes    |    yes     |   limited   | **yes** (genres, averages, by year)                   |
| Import from Goodreads / StoryGraph                       |    yes    |    yes     |     n/a     | **yes**, in the browser                               |
| Content warnings, revealed on request                    |    yes    |   filter   |     no      | **yes**                                               |
| Mood, pace and genre filters                             |   tags    |   strong   |   genres    | **yes**, plus length and content avoidance            |
| Trending books                                           |    yes    |     no     |    lists    | **yes**, from Hardcover's API                         |
| Best sellers with sales figures                          |    no     |     no     |     no      | **yes** (estimates, labelled)                         |
| Where to buy, borrow or listen, compared                 |    no     |     no     |    links    | **yes**: this is our core                             |
| Custom lists and tags                                    |    yes    |    yes     |   shelves   | not yet                                               |
| Reviews, friends, feed, clubs, buddy reads               |    yes    |    yes     |     yes     | no, by design: we are not a social network            |
| Reading goals and challenges                             |    yes    |    yes     |     yes     | not yet                                               |
| "Up next" queue                                          |    no     |    yes     |     no      | partly (the Want to read tab)                         |
| Mobile apps                                              |    yes    |    yes     |     yes     | no (the site is a fast, installable-feeling web page) |
| Accounts and sync across devices                         |    yes    |    yes     |     yes     | no: the shelf lives in the browser                    |

## What is worth building next

1. **Reading goals** (a yearly target and progress bar on the shelf page): small, uses data already stored.
2. **Custom lists** with a shareable link (the list encoded in the URL, no accounts).
3. **NYT Books API** for a sourced weekly "on the lists" shelf.
4. **Optional accounts** to sync the shelf across devices. This is a real step up in scope and in
   privacy responsibilities, so it should wait for traffic.
