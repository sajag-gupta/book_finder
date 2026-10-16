/**
 * Pure fact-check logic for the review workflow. No I/O: scripts/review.js fetches the public
 * pages and passes the results in, so every rule here is unit-tested.
 *
 * These checks cover objective facts only (title, author, first-publication year, page-count band,
 * ISBN). They do not judge the editorial text (summary, read-if, moods, warnings); a person does.
 */

export const LENGTH_BANDS = { short: [0, 299], medium: [300, 450], long: [451, Infinity] };

const norm = (s) =>
  String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // Shōgun = Shogun, Lapeña = Lapena
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Letters and digits only, minus a leading "the": "A. B. C. Murders" = "The ABC Murders". */
const compact = (s) => norm(s).replace(/^the /, '').replace(/ /g, '');

const surname = (author) => norm(author).split(' ').filter(Boolean).at(-1) ?? '';

export function lengthBand(pages) {
  return (
    Object.entries(LENGTH_BANDS).find(([, [lo, hi]]) => pages >= lo && pages <= hi)?.[0] ?? null
  );
}

export const finding = (level, check, detail) => ({ level, check, detail });

/** "Dune (novel)" is the article for the book "Dune"; "Chapterhouse: Dune" is not. */
export const wikiTitleMatches = (book, title) =>
  norm(String(title).replace(/\s*\([^)]*\)\s*$/, '')) === norm(book.title);

/**
 * From candidate Wikipedia pages, pick the article about this exact book: the title must match and
 * the intro must name the author. Returns undefined when none qualifies, so a near-miss page (a
 * bibliography, a sequel) can never count as a source.
 * @param {Array<{title: string, extract: string}>} pages
 */
export const pickWikiPage = (book, pages) =>
  pages.find(
    (page) =>
      page?.extract &&
      wikiTitleMatches(book, page.title) &&
      norm(page.extract).includes(surname(book.author)),
  );

/**
 * From Hardcover search hits, pick the record for this book: same title (ignoring a subtitle after
 * a colon) and the author's surname in the author list. The most-shelved match wins, because
 * editions and fan reprints share titles.
 * @param {Array<{title: string, slug: string, author_names?: string[], users_count?: number}>} docs
 */
export function pickHardcover(book, docs) {
  // "Dune: Special Edition" and "Babel, or the Necessity of Violence" are the book "Dune" and
  // "Babel", but "Dune Messiah" is a different book: a title may only extend past a punctuation mark.
  const base = (t) => String(t).replace(/\s*\([^)]*\)\s*$/, '');
  const head = (t) => base(t).split(/[:,]/)[0];
  const sameTitle = (d) =>
    compact(base(d.title)) === compact(base(book.title)) ||
    compact(head(d.title)) === compact(base(book.title));
  return docs
    .filter(
      (d) =>
        sameTitle(d) && (d.author_names ?? []).some((a) => norm(a).includes(surname(book.author))),
    )
    .sort((a, b) => (b.users_count ?? 0) - (a.users_count ?? 0))[0];
}

/**
 * @param {object} book  A record from data/books
 * @param {{edition?: object, work?: object, wiki?: object, hc?: object}} found  Fetched public data
 * @returns {Array<{level: 'ok'|'warn'|'fail', check: string, detail: string}>}
 */
export function compareFacts(book, { edition, work, wiki, hc }) {
  const out = [];

  if (!edition) {
    out.push(finding('fail', 'isbn', `Open Library has no edition for ${book.isbn13}`));
  } else if (
    !compact(edition.title).includes(compact(book.title)) &&
    !compact(book.title).includes(compact(edition.title))
  ) {
    out.push(finding('fail', 'isbn', `ISBN belongs to "${edition.title}", not "${book.title}"`));
  } else {
    out.push(finding('ok', 'isbn', `ISBN matches "${edition.title}"`));
  }

  if (!work) {
    out.push(finding('warn', 'author-year', 'No Open Library work found by title and author'));
  } else {
    const authors = (work.author_name ?? []).map(norm).join(' | ');
    // Open Library sometimes lists authors in their own script (for example Japanese). When
    // Hardcover independently confirms the author, that mismatch is a note, not a failure.
    out.push(
      authors.includes(surname(book.author))
        ? finding('ok', 'author', `Author confirmed: ${work.author_name.join(', ')}`)
        : finding(
            hc ? 'warn' : 'fail',
            'author',
            `Open Library lists ${work.author_name?.join(', ') ?? 'no author'}` +
              (hc ? ` (Hardcover confirms ${book.author})` : ''),
          ),
    );
    const diff = Math.abs((work.first_publish_year ?? 0) - book.firstPublished);
    // Open Library's work-level year is sometimes wrong (an early or foreign edition). When the
    // independent Wikipedia intro confirms our year, the sources disagree: a warning to look at,
    // not a failure.
    const wikiConfirms = Boolean(wiki) && norm(wiki.extract).includes(String(book.firstPublished));
    const hcConfirms = hc?.release_year === book.firstPublished;
    if (!work.first_publish_year) {
      out.push(finding('warn', 'year', 'Open Library has no first-publication year'));
    } else if (diff === 0) {
      out.push(finding('ok', 'year', `First published ${work.first_publish_year}`));
    } else {
      out.push(
        finding(
          diff === 1 || wikiConfirms || hcConfirms ? 'warn' : 'fail',
          'year',
          `Record says ${book.firstPublished}, Open Library says ${work.first_publish_year}` +
            (wikiConfirms ? ` (Wikipedia confirms ${book.firstPublished})` : '') +
            (hcConfirms ? ` (Hardcover confirms ${book.firstPublished})` : ''),
        ),
      );
    }
  }

  const pages = edition?.number_of_pages ?? hc?.pages;
  if (typeof pages === 'number') {
    const band = lengthBand(pages);
    out.push(
      band === book.length
        ? finding('ok', 'length', `${pages} pages fits "${book.length}"`)
        : finding(
            'warn',
            'length',
            `${pages} pages suggests "${band}", record says "${book.length}"`,
          ),
    );
  } else {
    out.push(
      finding('warn', 'length', 'No page count on the Open Library edition; confirm by hand'),
    );
  }

  if (!wiki) {
    out.push(finding('warn', 'wikipedia', 'No Wikipedia article about this book found'));
  } else {
    const text = norm(`${wiki.title} ${wiki.extract}`);
    out.push(
      wikiTitleMatches(book, wiki.title)
        ? finding('ok', 'wikipedia-title', `Wikipedia article is "${wiki.title}"`)
        : finding('warn', 'wikipedia-title', `Wikipedia article "${wiki.title}" is not this book`),
    );
    out.push(
      text.includes(surname(book.author))
        ? finding('ok', 'wikipedia', `Wikipedia "${wiki.title}" names the author`)
        : finding('warn', 'wikipedia', `Wikipedia "${wiki.title}" does not mention ${book.author}`),
    );
    out.push(
      text.includes(String(book.firstPublished))
        ? finding('ok', 'wikipedia-year', `Wikipedia intro mentions ${book.firstPublished}`)
        : finding(
            'warn',
            'wikipedia-year',
            `Year ${book.firstPublished} not in the Wikipedia intro; confirm by hand`,
          ),
    );
  }
  if (hc) {
    out.push(
      finding('ok', 'hardcover', `Hardcover lists "${hc.title}" by ${hc.author_names.join(', ')}`),
    );
  }
  return out;
}

/** The public pages that back a record; stored in `sources` on approval. */
export function sourceUrls(book, { edition, wiki, hc }) {
  return [
    edition ? `https://openlibrary.org/isbn/${book.isbn13}` : null,
    wiki?.url ?? null,
    hc?.slug ? `https://hardcover.app/books/${hc.slug}` : null,
  ].filter(Boolean);
}

export const hasFailures = (findings) => findings.some((f) => f.level === 'fail');

/**
 * Returns a copy of `book` marked "checked": its facts matched two independent public sources and
 * nothing failed. A person has not read the text, so this is not "reviewed" and pages say so.
 * Warnings are allowed (they are listed in the review report), failures and a missing second
 * source are not.
 */
export function applyChecked(book, { sources, date, findings }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must be YYYY-MM-DD');
  if (hasFailures(findings)) {
    throw new Error(
      findings
        .filter((f) => f.level === 'fail')
        .map((f) => f.detail)
        .join('; '),
    );
  }
  if (sources.length < 2) throw new Error(`only ${sources.length} public source found`);
  // The second source must independently confirm the book: its Wikipedia article or a matching
  // Hardcover record (Open Library, the first source, is always present).
  const confirmed = findings.some(
    (f) => (f.check === 'wikipedia-title' || f.check === 'hardcover') && f.level === 'ok',
  );
  if (!confirmed) throw new Error('neither Wikipedia nor Hardcover confirms this exact book');
  return { ...book, status: 'checked', sources, checkedOn: date };
}

/**
 * Returns a copy of `book` marked reviewed. Throws when the evidence is not good enough, so the CLI
 * cannot publish a record that the validator would reject.
 */
export function applyApproval(book, { reviewer, sources, date, findings, acceptWarnings = false }) {
  if (!reviewer?.trim()) throw new Error('A reviewer name is required.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('date must be YYYY-MM-DD');
  if (sources.length < 2) throw new Error(`Need at least two sources, found ${sources.length}.`);
  if (hasFailures(findings)) throw new Error('Fact check has failures; fix the record first.');
  if (!acceptWarnings && findings.some((f) => f.level === 'warn')) {
    throw new Error(
      'Fact check has warnings; check them by hand and re-run with --accept-warnings.',
    );
  }
  return { ...book, status: 'reviewed', sources, reviewedBy: reviewer.trim(), reviewedOn: date };
}
