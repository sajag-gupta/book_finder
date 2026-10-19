/**
 * One-command local setup:  npm run setup
 *
 * Checks Node, installs dependencies, creates .env from the example, runs the checks, builds the
 * site and tells you how to open it. Safe to run again at any time. Needs no accounts or keys:
 * everything below works offline once dependencies are installed.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
// Run npm through the same npm that started this script, so there is no shell and no Windows quirks.
const npmCli = process.env.npm_execpath;
const run = (command, args) =>
  npmCli && command === 'npm'
    ? spawnSync(process.execPath, [npmCli, ...args], { cwd: root, stdio: 'inherit' })
    : spawnSync(command, args, { cwd: root, stdio: 'inherit' });
const step = (text) => console.log(`\n→ ${text}`);
const fail = (text) => {
  console.error(`\n✗ ${text}`);
  process.exit(1);
};

const wanted = Number(
  readFileSync(new URL('../.nvmrc', import.meta.url), 'utf8')
    .trim()
    .split('.')[0],
);
const have = Number(process.versions.node.split('.')[0]);
step(`Node ${process.versions.node} (needs ${wanted} or newer)`);
if (have < wanted) {
  fail(
    `Install Node.js ${wanted} or newer (https://nodejs.org, or "nvm install" in this folder), then run npm run setup again.`,
  );
}

// --ignore-scripts skips Wrangler's native download, which only `npm run dev` needs (run `npm rebuild` first).
step('Installing dependencies (npm ci)');
if (run('npm', ['ci', '--ignore-scripts']).status !== 0)
  fail('npm ci failed. Check your network and try again.');

step('Creating .env from .env.example');
if (existsSync(new URL('../.env', import.meta.url)))
  console.log('.env already exists, left as it is');
else {
  copyFileSync(new URL('../.env.example', import.meta.url), new URL('../.env', import.meta.url));
  console.log('.env created. It is optional: only the data-refresh scripts need keys.');
}

step('Checking the project (lint, format, data, tests)');
if (run('npm', ['run', 'check']).status !== 0)
  fail('The checks failed. Fix the problems above, then run npm run setup again.');

step('Building the site (without share cards, for speed)');
if (run('npm', ['run', 'build', '--', '--skip-share-cards']).status !== 0)
  fail('The build failed.');

console.log(`
✓ ReadYourMood is ready.

  Open it:      npm run serve        then visit http://127.0.0.1:8788
  Run checks:   npm run check
  Full build:   npm run build        (adds share cards, takes a few minutes)
  Learn more:   README.md and AGENTS.md
`);
