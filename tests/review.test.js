import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyApproval,
  compareFacts,
  hasFailures,
  lengthBand,
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
