/**
 * Local stand-in for Cloudflare Pages, so contributors can try the whole site without wrangler:
 * it serves dist/ and runs the real /api/search, /api/book and /go handlers.
 *
 *   npm run build && npm run serve        then open http://127.0.0.1:8788
 *
 * Not for production. Click logging and /api/subscribe are not emulated.
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleBook, handleSearch } from '../src/shared/book-api.js';
import { onRequestGet as go } from '../functions/go/[store]/[isbn].js';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT ?? 8788);
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.xml': 'application/xml',
  '.txt': 'text/plain',
};
const env = { OL_CONTACT: process.env.OL_CONTACT };

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  try {
    const request = new Request(url, { headers: req.headers });
    let response;
    if (url.pathname === '/api/search') response = await handleSearch(request, env);
    else if (url.pathname === '/api/book') response = await handleBook(request, env);
    else if (url.pathname.startsWith('/go/')) {
      const [, , store, isbn] = url.pathname.split('/');
      response = await go({ params: { store, isbn }, request, env: {}, waitUntil() {} });
    }
    if (response) {
      res.writeHead(response.status, Object.fromEntries(response.headers));
      return res.end(Buffer.from(await response.arrayBuffer()));
    }
    let path = normalize(join(root, decodeURIComponent(url.pathname)));
    if (!path.startsWith(root)) throw new Error('outside dist');
    if (url.pathname.endsWith('/')) path = join(path, 'index.html');
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': types[extname(path)] ?? 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  }
}).listen(port, '127.0.0.1', () => console.log(`dev server on http://127.0.0.1:${port}`));
