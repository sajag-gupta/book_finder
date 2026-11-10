/**
 * Tiny HTTP helper for API calls from a shell where quoting JSON is painful (PowerShell mangles it).
 *
 *   BEARER=<token> node scripts/ops/http.mjs GET  https://api.cloudflare.com/client/v4/zones
 *   BEARER=<token> node scripts/ops/http.mjs POST <url> @body.json     (@file reads the body from a file)
 *   BASIC=user:pass node scripts/ops/http.mjs GET https://api.name.com/v4/hello
 *   MAX=5000 ...                                                       (how many characters to print)
 *
 * Why this exists: on the Dell laptop, Python's TLS check fails for some hosts ("Missing Authority Key
 * Identifier"), so API work is done with Node's fetch. Tokens come from the environment only.
 */
import { readFileSync } from 'node:fs';

const [, , method = 'GET', url, body] = process.argv;
if (!url) throw new Error('Usage: node scripts/ops/http.mjs <METHOD> <URL> [json | @file]');
const headers = {
  'Content-Type': 'application/json',
  'User-Agent': 'readyourmood-ops',
  Accept: 'application/json',
};
if (process.env.BEARER) headers.Authorization = `Bearer ${process.env.BEARER}`;
if (process.env.BASIC)
  headers.Authorization = `Basic ${Buffer.from(process.env.BASIC).toString('base64')}`;
const response = await fetch(url, {
  method,
  headers,
  body: body?.startsWith('@') ? readFileSync(body.slice(1), 'utf8') : body || undefined,
});
console.log(response.status);
console.log((await response.text()).slice(0, Number(process.env.MAX ?? 3000)));
