/**
 * Opens a pull request for a pushed branch, waits for CI, squash-merges it, and waits for the deploy.
 *
 *   node scripts/ops/ship.mjs <branch> "<title>" <bodyFile>      open the PR, then merge it
 *   node scripts/ops/ship.mjs --existing <prNumber> "<title>"    wait for an open PR, then merge it
 *
 * Needs GITHUB_TOKEN (in .env, or the environment). It retries network errors, because a single DNS
 * hiccup must not leave a PR half finished. It never merges unless every check run succeeded, and it
 * never force-pushes. The deploy is the "Deploy" workflow that runs on every push to main.
 */
import { existsSync, readFileSync } from 'node:fs';

const REPO = 'sajag-gupta/book_finder';
const envFile = process.env.ENV_FILE ?? new URL('../../.env', import.meta.url);
const fileEnv = existsSync(envFile)
  ? Object.fromEntries(
      readFileSync(envFile, 'utf8')
        .split(/\r?\n/)
        .filter((line) => /^[A-Z_]+=/.test(line))
        .map((line) => [line.split('=')[0], line.slice(line.indexOf('=') + 1).trim()]),
    )
  : {};
const token = process.env.GITHUB_TOKEN ?? fileEnv.GITHUB_TOKEN;
if (!token) throw new Error('Set GITHUB_TOKEN (see AGENTS.md and docs/RULEBOOK.md).');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function api(method, path, body) {
  for (let attempt = 0; attempt < 12; attempt++) {
    try {
      const response = await fetch(`https://api.github.com/repos/${REPO}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'readyourmood-ops',
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      return await response.json();
    } catch {
      await sleep(10_000);
    }
  }
  throw new Error('GitHub is unreachable.');
}

const args = process.argv.slice(2);
let pr;
let title;
if (args[0] === '--existing') {
  pr = await api('GET', `/pulls/${args[1]}`);
  title = args[2];
} else {
  const [head, prTitle, bodyFile] = args;
  title = prTitle;
  pr = await api('POST', '/pulls', {
    title,
    head,
    base: 'main',
    body: readFileSync(bodyFile, 'utf8'),
  });
  if (!pr.number) throw new Error(`Could not open the PR: ${JSON.stringify(pr).slice(0, 300)}`);
}
console.log(pr.html_url);

let sha = pr.merge_commit_sha;
if (!pr.merged) {
  let runs = [];
  for (let i = 0; i < 90; i++) {
    runs = (await api('GET', `/commits/${pr.head.sha}/check-runs`)).check_runs ?? [];
    if (runs.length && runs.every((run) => run.status === 'completed')) break;
    await sleep(20_000);
  }
  console.log(runs.map((run) => [run.name, run.conclusion]));
  if (!runs.length || !runs.every((run) => run.conclusion === 'success')) {
    console.error('CI did not pass. Not merging.');
    process.exit(1);
  }
  const merged = await api('PUT', `/pulls/${pr.number}/merge`, {
    merge_method: 'squash',
    commit_title: `${title} (#${pr.number})`,
  });
  console.log('merged', merged.merged);
  sha = merged.sha;
  await sleep(25_000);
}
for (let i = 0; i < 90; i++) {
  const workflows = (await api('GET', `/actions/runs?head_sha=${sha}`)).workflow_runs ?? [];
  if (workflows.length && workflows.every((run) => run.status === 'completed')) {
    console.log(workflows.map((run) => [run.name, run.conclusion]));
    process.exit(workflows.every((run) => run.conclusion === 'success') ? 0 : 1);
  }
  await sleep(20_000);
}
console.error('The deploy did not finish in time. Check the Actions tab.');
process.exit(1);
