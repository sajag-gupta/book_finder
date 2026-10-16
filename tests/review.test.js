import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyApproval,
  compareFacts,
  hasFailures,
  lengthBand,
  pickHardcover,
  pickWikiPage,
  sourceUrls,
} from '../src/review/checks.js';

const book = {
  slug: 'dune',
  title: 'Dune',
  author: 'Frank Herbert',
  isbn13: '9780441013593',
  firstPublished: 1965,
  length: 'long',
  status: 'draft',
};
const good = {
  edition: { title: 'Dune', number_of_pages: 528 },
  work: { author_name: ['Frank Herbert'], first_publish_year: 1965 },
  wiki: {
    title: 'Dune (novel)',
    url: 'https://en.wikipedia.org/wiki/Dune_(novel)',
    extract: 'Dune is a 1965 science fiction novel by American author Frank Herbert.',
  },
};
const levels = (findings) => findings.map((f) => f.level);

test('lengthBand follows the schema bands', () => {
  assert.equal(lengthBand(120), 'short');
  assert.equal(lengthBand(299), 'short');
  assert.equal(lengthBand(300), 'medium');
  assert.equal(lengthBand(450), 'medium');
  assert.equal(lengthBand(451), 'long');
});

test('a correct record passes every check', () => {
  const findings = compareFacts(book, good);
  assert.ok(
    findings.every((f) => f.level === 'ok'),
    JSON.stringify(findings),
  );
});

test('an ISBN that belongs to another book fails', () => {
  const findings = compareFacts(book, { ...good, edition: { title: 'Discount Armageddon' } });
  assert.ok(hasFailures(findings));
});

test('a missing edition fails', () => {
  assert.ok(hasFailures(compareFacts(book, { ...good, edition: undefined })));
});

test('a year off by one warns, further off fails', () => {
  const near = compareFacts(book, { ...good, work: { ...good.work, first_publish_year: 1966 } });
  assert.ok(near.some((f) => f.check === 'year' && f.level === 'warn'));
  const far = compareFacts(book, {
    ...good,
    wiki: undefined,
    work: { ...good.work, first_publish_year: 1980 },
  });
  assert.ok(far.some((f) => f.check === 'year' && f.level === 'fail'));
});

test('a wrong author fails', () => {
  const findings = compareFacts(book, {
    ...good,
    work: { ...good.work, author_name: ['Someone Else'] },
  });
  assert.ok(findings.some((f) => f.check === 'author' && f.level === 'fail'));
});

test('a page count outside the recorded band warns', () => {
  const findings = compareFacts(book, {
    ...good,
    edition: { title: 'Dune', number_of_pages: 250 },
  });
  assert.ok(findings.some((f) => f.check === 'length' && f.level === 'warn'));
});

test('missing Wikipedia is a warning, not a failure', () => {
  const findings = compareFacts(book, { ...good, wiki: undefined });
  assert.ok(!hasFailures(findings));
  assert.ok(levels(findings).includes('warn'));
});

test('Open Library disagreeing with a Wikipedia-confirmed year is a warning, not a failure', () => {
  const findings = compareFacts(book, {
    ...good,
    work: { ...good.work, first_publish_year: 1980 },
  });
  assert.ok(!hasFailures(findings));
  assert.ok(findings.some((f) => f.check === 'year' && f.detail.includes('Wikipedia confirms')));
});

test('pickWikiPage only accepts the article about this exact book', () => {
  const pages = [
    { title: 'Chapterhouse: Dune', extract: 'A 1985 novel by Frank Herbert.' },
    { title: 'Frank Herbert bibliography', extract: 'Works by Frank Herbert, including Dune.' },
    { title: 'Dune (novel)', extract: 'Dune is a 1965 novel by Frank Herbert.' },
    { title: 'Dune', extract: 'A disambiguation page with no author.' },
  ];
  assert.equal(pickWikiPage(book, pages).title, 'Dune (novel)');
  assert.equal(pickWikiPage(book, pages.slice(0, 2)), undefined);
  assert.equal(pickWikiPage(book, [{ title: 'Dune (novel)', missing: true }]), undefined);
});

test('a Wikipedia page that is not the book only warns', () => {
  const findings = compareFacts(book, {
    ...good,
    wiki: { ...good.wiki, title: 'Frank Herbert bibliography' },
  });
  assert.ok(findings.some((f) => f.check === 'wikipedia-title' && f.level === 'warn'));
});

test('sourceUrls lists the two public pages', () => {
  assert.deepEqual(sourceUrls(book, good), [
    'https://openlibrary.org/isbn/9780441013593',
    'https://en.wikipedia.org/wiki/Dune_(novel)',
  ]);
});

const approve = (overrides = {}) =>
  applyApproval(book, {
    reviewer: 'Sajag Gupta',
    date: '2026-10-16',
    sources: sourceUrls(book, good),
    findings: compareFacts(book, good),
    ...overrides,
  });

test('approval marks the record reviewed without mutating the input', () => {
  const result = approve();
  assert.equal(result.status, 'reviewed');
  assert.equal(result.reviewedBy, 'Sajag Gupta');
  assert.equal(result.reviewedOn, '2026-10-16');
  assert.equal(result.sources.length, 2);
  assert.equal(book.status, 'draft');
});

test('approval needs a reviewer, a valid date and two sources', () => {
  assert.throws(() => approve({ reviewer: ' ' }), /reviewer/);
  assert.throws(() => approve({ date: '16/10/2026' }), /YYYY-MM-DD/);
  assert.throws(() => approve({ sources: ['https://openlibrary.org/isbn/1'] }), /two sources/);
});

test('approval refuses failures, and warnings unless accepted', () => {
  const failing = compareFacts(book, { ...good, edition: undefined });
  assert.throws(() => approve({ findings: failing, acceptWarnings: true }), /failures/);
  const warned = compareFacts(book, { ...good, wiki: undefined });
  assert.throws(() => approve({ findings: warned }), /warnings/);
  assert.equal(approve({ findings: warned, acceptWarnings: true }).status, 'reviewed');
});

test('Open Library listing the author in another script only warns when Hardcover confirms', () => {
  const hc = { title: 'Dune', slug: 'dune-1965', author_names: ['Frank Herbert'] };
  const localised = { ...good, work: { ...good.work, author_name: ['フランク・ハーバート'] } };
  const withHc = compareFacts(book, { ...localised, hc });
  assert.ok(withHc.some((f) => f.check === 'author' && f.level === 'warn'));
  assert.ok(!hasFailures(withHc));
  const withoutHc = compareFacts(book, localised);
  assert.ok(withoutHc.some((f) => f.check === 'author' && f.level === 'fail'));
});

test('page counts fall back to Hardcover when Open Library has none', () => {
  const hc = { title: 'Dune', slug: 'dune-1965', author_names: ['Frank Herbert'], pages: 612 };
  const findings = compareFacts(book, { ...good, edition: { title: 'Dune' }, hc });
  assert.ok(findings.some((f) => f.check === 'length' && f.level === 'ok'));
});

test('sourceUrls includes the Hardcover page when there is one', () => {
  const hc = { slug: 'dune-1965' };
  assert.ok(
    sourceUrls(book, { edition: {}, hc }).includes('https://hardcover.app/books/dune-1965'),
  );
});

test('title matching ignores diacritics, punctuation and a leading "The"', () => {
  const by = (author) => ({ author_name: [author], first_publish_year: 1965 });
  const shogun = { ...book, title: 'Shōgun', author: 'James Clavell' };
  const shogunFacts = { ...good, work: by('James Clavell') };
  assert.ok(!hasFailures(compareFacts(shogun, { ...shogunFacts, edition: { title: 'Shogun' } })));
  const abc = { ...book, title: 'The ABC Murders', author: 'Agatha Christie' };
  const abcFacts = { ...good, work: by('Agatha Christie') };
  assert.ok(
    !hasFailures(compareFacts(abc, { ...abcFacts, edition: { title: 'A. B. C. Murders' } })),
  );
  const wrong = compareFacts(shogun, { ...shogunFacts, edition: { title: 'Dune' } });
  assert.ok(hasFailures(wrong), 'a different book still fails');
});

test('author surnames match across diacritics', () => {
  const lapena = { ...book, title: 'The Couple Next Door', author: 'Shari Lapena' };
  const work = { author_name: ['Shari Lapeña'], first_publish_year: book.firstPublished };
  const findings = compareFacts(lapena, {
    ...good,
    edition: { title: 'The Couple Next Door' },
    work,
  });
  assert.ok(findings.some((f) => f.check === 'author' && f.level === 'ok'));
});

test('Hardcover confirming the year turns a bad Open Library year into a warning', () => {
  const noisy = { ...good, work: { ...good.work, first_publish_year: 1934 }, wiki: undefined };
  assert.ok(hasFailures(compareFacts(book, noisy)));
  const hc = { title: 'Dune', slug: 'd', author_names: ['Frank Herbert'], release_year: 1965 };
  const confirmed = compareFacts(book, { ...noisy, hc });
  assert.ok(!hasFailures(confirmed));
  assert.ok(confirmed.some((f) => f.detail.includes('Hardcover confirms 1965')));
  const wrongYear = compareFacts(book, { ...noisy, hc: { ...hc, release_year: 1999 } });
  assert.ok(hasFailures(wrongYear), 'a Hardcover year that also disagrees does not rescue it');
});

test('pickHardcover accepts subtitles after punctuation but not sequels', () => {
  const dune = { ...book, title: 'Dune', author: 'Frank Herbert' };
  const docs = (title) => [{ title, slug: 's', author_names: ['Frank Herbert'], users_count: 1 }];
  assert.ok(pickHardcover(dune, docs('Dune: Deluxe Edition')));
  assert.ok(pickHardcover(dune, docs('Dune (Dune Chronicles #1)')));
  assert.equal(pickHardcover(dune, docs('Dune Messiah')), undefined);
  const babel = { ...book, title: 'Babel', author: 'R. F. Kuang' };
  const hit = [
    { title: 'Babel, or the Necessity of Violence', slug: 'b', author_names: ['R.F. Kuang'] },
  ];
  assert.ok(pickHardcover(babel, hit));
});
