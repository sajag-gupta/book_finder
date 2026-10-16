/**
 * Review workflow: fact-check draft book records against public sources, then publish the ones a
 * person signs off on.
 *
 *   npm run review                              check every draft, write .review/report.md
 *   npm run review -- dune fourth-wing          check only these slugs
 *   npm run review -- --approve dune fourth-wing --reviewer "Your Name" [--accept-warnings]
 *
 * Checks are objective only (ISBN, title, author, year, page-count band) and use Open Library and
 * Wikipedia as two independent public sources. Approving re-runs the checks, records the sources,
 * your name and today's date, and sets status "reviewed". The editorial text is for you to judge:
 * read the report before approving. Needs OL_CONTACT in .env (Open Library asks for a contact).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { format } from 'prettier';
import { loadData } from '../src/site/data.js';
import {
  applyApproval,
  compareFacts,
  hasFailures,
  pickWikiPage,
  sourceUrls,
} from '../src/review/checks.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const { OL_CONTACT } = process.env;
if (!OL_CONTACT) {
  console.error('Set OL_CONTACT in .env (your contact email) first.');
  process.exit(1);
}
const headers = { 'User-Agent': `BookFinder/0.1 (${OL_CONTACT})` };

function parseArgs(argv) {
  const args = { slugs: [], approve: false, reviewer: '', acceptWarnings: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--approve') args.approve = true;
    else if (a === '--accept-warnings') args.acceptWarnings = true;
    else if (a === '--reviewer') args.reviewer = argv[++i] ?? '';
    else if (a.startsWith('--')) throw new Error(`Unknown option ${a}`);
    else args.slugs.push(a);
  }
  return args;
}

const getJson = async (url) => {
  const response = await fetch(url, { headers });
  await sleep(350); // stay well inside Open Library's 3 requests/second
  return response.ok ? response.json() : null;
};
const enc = encodeURIComponent;

async function fetchPublicData(book) {
  const edition = await getJson(`https://openlibrary.org/isbn/${book.isbn13}.json`);
  const search = await getJson(
    `https://openlibrary.org/search.json?title=${enc(book.title)}&author=${enc(book.author)}` +
      '&fields=title,author_name,first_publish_year&limit=1',
  );
  const work = search?.docs?.[0];

  // Wikipedia: try the conventional article titles, then the top search hits. Only a page whose
  // title is this exact book and whose intro names the author is accepted (see pickWikiPage).
  const hits = await getJson(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=3` +
      `&srsearch=${enc(`${book.title} ${book.author}`)}`,
  );
  const candidates = [
    `${book.title} (novel)`,
    book.title,
    ...(hits?.query?.search ?? []).map((hit) => hit.title),
  ];
  const result = await getJson(
    `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1` +
      `&exlimit=max&redirects=1&format=json&titles=${enc([...new Set(candidates)].join('|'))}`,
  );
  const pages = Object.values(result?.query?.pages ?? {});
  const page = pickWikiPage(book, pages);
  const wiki = page && {
    title: page.title,
    extract: page.extract,
    url: `https://en.wikipedia.org/wiki/${enc(page.title.replace(/ /g, '_')).replace(/%28/g, '(').replace(/%29/g, ')')}`,
  };
  return { edition, work, wiki };
}

const ICON = { ok: 'PASS', warn: 'WARN', fail: 'FAIL' };
const MANUAL = [
  'Summary is accurate, spoiler-light and in my own words (not a blurb)',
  'Moods and tropes fit the book as I know it',
  'Content warnings are complete and correct',
  'Read-if / skip-if are fair and specific',
  'Each pairing reason is true and useful',
];

function section(book, findings, sources) {
  const lines = [
    `## ${book.title} (${book.author}), \`${book.slug}\``,
    '',
    '**Automatic checks**',
    ...findings.map((f) => `- [${ICON[f.level]}] ${f.check}: ${f.detail}`),
    '',
    '**Sources recorded on approval**',
    ...sources.map((s) => `- ${s}`),
    '',
    '**Text to review**',
    `- Summary: ${book.summary}`,
    `- Read this if: ${book.readIf}`,
    `- Skip this if: ${book.skipIf}`,
    `- Moods: ${book.moods.join(', ')}. Tropes: ${book.tropes.join(', ') || 'none'}.`,
    `- Content warnings: ${book.warnings.join(', ') || 'none'}`,
    ...(book.pairings ?? []).map((p) => `- Pairs with ${p.slug} (${p.moodShift}): ${p.reason}`),
    '',
    '**Your checklist**',
    ...MANUAL.map((m) => `- [ ] ${m}`),
    '',
  ];
  return lines.join('\n');
}

async function writeBook(book) {
  const { _file, ...record } = book;
  const path = join(root, 'data', 'books', _file);
  const text = await format(JSON.stringify(record), {
    parser: 'json',
    ...JSON.parse(readFileSync(join(root, '.prettierrc.json'), 'utf8')),
  });
  writeFileSync(path, text);
}

const args = parseArgs(process.argv.slice(2));
const all = loadData(root).books;
const targets = args.slugs.length
  ? args.slugs.map(
      (slug) =>
        all.find((b) => b.slug === slug) ??
        (() => {
          throw new Error(`Unknown book "${slug}"`);
        })(),
    )
  : all.filter((b) => b.status === 'draft');

if (args.approve && (!args.slugs.length || !args.reviewer.trim())) {
  console.error(
    'Usage: npm run review -- --approve <slug...> --reviewer "Your Name" [--accept-warnings]',
  );
  process.exit(1);
}

const report = [
  `# Review report`,
  '',
  `Generated ${new Date().toISOString().slice(0, 10)}. Draft records: ${targets.length}.`,
  '',
];
let blocked = 0;
let approved = 0;
for (const book of targets) {
  const found = await fetchPublicData(book);
  const findings = compareFacts(book, found);
  const sources = sourceUrls(book, found);
  const status = hasFailures(findings)
    ? 'FAIL'
    : findings.some((f) => f.level === 'warn')
      ? 'WARN'
      : 'PASS';
  console.log(`${status.padEnd(5)} ${book.slug}`);
  for (const f of findings.filter((x) => x.level !== 'ok'))
    console.log(`        ${ICON[f.level]} ${f.check}: ${f.detail}`);
  report.push(section(book, findings, sources));

  if (args.approve) {
    try {
      const date = new Date().toISOString().slice(0, 10);
      const next = applyApproval(book, {
        reviewer: args.reviewer,
        sources,
        date,
        findings,
        acceptWarnings: args.acceptWarnings,
      });
      await writeBook(next);
      approved++;
      console.log(`        APPROVED by ${args.reviewer.trim()}`);
    } catch (error) {
      blocked++;
      console.log(`        NOT approved: ${error.message}`);
    }
  }
}

mkdirSync(join(root, '.review'), { recursive: true });
writeFileSync(join(root, '.review', 'report.md'), report.join('\n'));
console.log(`\nReport: .review/report.md`);
if (args.approve) console.log(`${approved} approved, ${blocked} not approved.`);
process.exit(blocked ? 1 : 0);
