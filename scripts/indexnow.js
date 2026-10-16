/**
 * Tells Bing, Yandex, Naver and other IndexNow search engines which URLs exist, so new pages are
 * crawled in hours instead of weeks. Needs no account: the engines check the key file we host at
 * /<key>.txt. Google does not support IndexNow; use Search Console for Google.
 *
 *   npm run indexnow            submit every URL in dist/sitemap.xml
 *
 * Run after a deploy. If you automate it, submit changed URLs only: resubmitting everything on a
 * loop is discouraged by the protocol.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const keyFile = readdirSync(join(root, 'public')).find((f) => /^[a-f0-9]{32}\.txt$/.test(f));
if (!keyFile) throw new Error('No IndexNow key file (<32 hex>.txt) in public/.');
const key = keyFile.replace(/\.txt$/, '');

const siteUrl = (process.env.SITE_URL || '').replace(/\/$/, '');
if (!siteUrl) throw new Error('Set SITE_URL in .env to the live site address.');
const host = new URL(siteUrl).host;

const sitemap = readFileSync(join(root, 'dist', 'sitemap.xml'), 'utf8');
const urlList = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

// The key file must already be live, or the engines reject the submission.
const live = await fetch(`${siteUrl}/${keyFile}`);
if (!live.ok || (await live.text()).trim() !== key) {
  throw new Error(`${siteUrl}/${keyFile} is not live yet. Deploy first.`);
}

const response = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host, key, keyLocation: `${siteUrl}/${keyFile}`, urlList }),
});
console.log(`Submitted ${urlList.length} URLs: HTTP ${response.status} ${response.statusText}`);
if (![200, 202].includes(response.status)) process.exit(1);
