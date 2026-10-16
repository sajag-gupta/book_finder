/**
 * Renders a weekly issue to HTML and plain text for pasting into your email service.
 *
 *   npm run email -- 2026-10-23          renders data/newsletter/2026-10-23.json
 *
 * Writes out/email/<date>.html and .txt (git-ignored) and prints the subject and any warnings.
 * Reads SITE_URL from .env so links point at the live site.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadData, validateData } from '../src/site/data.js';
import { getSite } from '../src/site/config.js';
import { renderIssue } from '../src/email/template.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const date = process.argv[2];
if (!date) {
  console.error('Usage: npm run email -- <issue-date>   (for example 2026-10-23)');
  process.exit(1);
}

const data = loadData(root);
const errors = validateData(data);
const issue = data.issues.find((i) => i.date === date);
if (!issue) {
  console.error(`No issue data/newsletter/${date}.json`);
  process.exit(1);
}
if (errors.length) {
  console.error(`Fix these first:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}

const site = getSite();
if (!process.env.SITE_URL) {
  console.error('Set SITE_URL in .env (the live site address) so the email links work.');
  process.exit(1);
}
const config = JSON.parse(readFileSync(join(root, 'config', 'newsletter.json'), 'utf8'));
const { subject, html, text, warnings } = renderIssue(issue, {
  bySlug: new Map(data.books.map((b) => [b.slug, b])),
  moods: data.moods,
  site,
  config,
});

const dir = join(root, 'out', 'email');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, `${date}.html`), html);
writeFileSync(join(dir, `${date}.txt`), text);

console.log(`Subject: ${subject}`);
console.log(`Wrote out/email/${date}.html and ${date}.txt`);
for (const warning of warnings) console.log(`WARNING: ${warning}`);
