import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { slugify } from '../src/shared/slug.js';
import { icon } from '../src/site/icons.js';
import { createContext } from '../src/site/context.js';
import { isPublished, loadData } from '../src/site/data.js';
import { handleSubscribe, isValidEmail } from '../src/shared/subscribe.js';
import { applyChecked, compareFacts, pickHardcover } from '../src/review/checks.js';

const root = fileURLToPath(new URL('..', import.meta.url));
const data = loadData(root);
const site = { name: 'Test', url: 'https://example.test', preview: false, includeDrafts: false };

test('slugify handles ampersands, apostrophes, accents and punctuation', () => {
  assert.equal(slugify('Legends & Lattes'), 'legends-and-lattes');
  assert.equal(
    slugify("Harry Potter and the Philosopher's Stone"),
    'harry-potter-and-the-philosophers-stone',
  );
  assert.equal(slugify('Shōgun'), 'shogun');
  assert.equal(slugify('Red, White & Royal Blue'), 'red-white-and-royal-blue');
  assert.equal(
    slugify('Do Androids Dream of Electric Sheep?'),
    'do-androids-dream-of-electric-sheep',
  );
});

test('every mood and genre names an icon that exists', () => {
  for (const item of [...data.moods, ...data.genres]) {
    assert.ok(item.icon, `${item.slug} has an icon`);
    assert.match(icon(item.icon), /^<svg class="icon"[^>]*aria-hidden="true"/, item.slug);
  }
});

test('the site uses icons, not emoji', () => {
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  for (const file of ['moods', 'genres', 'tropes', 'warnings']) {
    assert.ok(!emoji.test(JSON.stringify(data[file])), `${file} vocabulary has no emoji`);
  }
});

test('icon() sizes and classes the svg', () => {
  const svg = icon('search', { size: 40, className: 'extra' });
  assert.ok(svg.includes('width="40"') && svg.includes('height="40"'));
  assert.ok(svg.includes('class="icon extra"'));
});

test('reviewed and checked books publish; drafts only in previews', () => {
  assert.equal(isPublished({ status: 'reviewed' }), true);
  assert.equal(isPublished({ status: 'checked' }), true);
  assert.equal(isPublished({ status: 'draft' }), false);
  assert.equal(isPublished({ status: 'draft' }, true), true);
});

test('context groups books and ranks best sellers first', () => {
  const ctx = createContext({ data, site: { ...site, includeDrafts: true } });
  const sellers = ctx.topSellers.map((b) => b.soldMillions);
  assert.deepEqual(
    sellers,
    [...sellers].sort((a, b) => b - a),
  );
  assert.ok(ctx.byGenre.get('fantasy').length > 0);
  for (const [, books] of ctx.byAuthor) assert.ok(books.length > 0);
  const multi = ctx.published.find((b) => ctx.hasAuthorPage(b));
  assert.ok(ctx.byAuthor.get(ctx.authorSlug(multi)).length >= 2);
});

// ---------- Subscribe ----------
const post = (fields, headers = {}) => {
  const body = new URLSearchParams(fields);
  return new Request('https://example.test/api/subscribe', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      ...headers,
    },
    body,
  });
};
const ok = (status) => async () => new Response('{}', { status });

test('isValidEmail accepts normal addresses and rejects junk', () => {
  assert.equal(isValidEmail('reader@example.com'), true);
  assert.equal(isValidEmail('no-at-sign'), false);
  assert.equal(isValidEmail('a@b'), false);
  assert.equal(isValidEmail('spaces in@example.com'), false);
  assert.equal(isValidEmail('x'.repeat(250) + '@example.com'), false);
});

test('subscribe forwards a valid address to Buttondown with the secret key', async () => {
  let call;
  const response = await handleSubscribe(
    post({ email: ' reader@example.com ' }),
    { EMAIL_API_KEY: 'k' },
    async (url, init) => {
      call = { url, init };
      return new Response('{}', { status: 201 });
    },
  );
  assert.equal(response.status, 200);
  assert.equal(call.url, 'https://api.buttondown.com/v1/subscribers');
  assert.equal(call.init.headers.Authorization, 'Token k');
  assert.equal(JSON.parse(call.init.body).email_address, 'reader@example.com');
});

test('subscribe says the same thing for an existing address (no list enumeration)', async () => {
  const fresh = await (
    await handleSubscribe(post({ email: 'a@example.com' }), { EMAIL_API_KEY: 'k' }, ok(201))
  ).json();
  const dupe = await (
    await handleSubscribe(post({ email: 'a@example.com' }), { EMAIL_API_KEY: 'k' }, ok(400))
  ).json();
  assert.deepEqual(dupe, fresh);
});

test('subscribe rejects bad email, cross-origin posts and missing config', async () => {
  const env = { EMAIL_API_KEY: 'k' };
  assert.equal((await handleSubscribe(post({ email: 'nope' }), env, ok(201))).status, 400);
  assert.equal(
    (
      await handleSubscribe(
        post({ email: 'a@example.com' }, { Origin: 'https://evil.test' }),
        env,
        ok(201),
      )
    ).status,
    403,
  );
  assert.equal((await handleSubscribe(post({ email: 'a@example.com' }), {}, ok(201))).status, 503);
});

test('the honeypot looks like success but never calls the email service', async () => {
  let called = false;
  const response = await handleSubscribe(
    post({ email: 'a@example.com', website: 'http://spam' }),
    { EMAIL_API_KEY: 'k' },
    async () => {
      called = true;
      return new Response('{}', { status: 201 });
    },
  );
  assert.equal(response.status, 200);
  assert.equal(called, false);
});

test('subscribe maps provider errors and redirects non-JS form posts', async () => {
  const env = { EMAIL_API_KEY: 'k' };
  assert.equal((await handleSubscribe(post({ email: 'a@example.com' }), env, ok(429))).status, 429);
  assert.equal((await handleSubscribe(post({ email: 'a@example.com' }), env, ok(500))).status, 502);
  const failing = async () => {
    throw new Error('network');
  };
  assert.equal((await handleSubscribe(post({ email: 'a@example.com' }), env, failing)).status, 502);
  const plain = await handleSubscribe(
    post({ email: 'a@example.com' }, { Accept: 'text/html' }),
    env,
    ok(201),
  );
  assert.equal(plain.status, 303);
  assert.equal(plain.headers.get('Location'), 'https://example.test/subscribed/');
});

// ---------- Hardcover and "checked" status ----------
const book = {
  slug: 'x',
  title: 'Icebreaker',
  author: 'Hannah Grace',
  isbn13: '9781982186715',
  firstPublished: 2022,
  length: 'medium',
};

test('pickHardcover matches title and author and prefers the most-shelved record', () => {
  const docs = [
    { title: 'Icebreaker: A Novel', slug: 'a', author_names: ['Hannah Grace'], users_count: 5 },
    { title: 'Icebreaker', slug: 'b', author_names: ['Hannah Grace'], users_count: 900 },
    { title: 'Icebreaker', slug: 'c', author_names: ['Someone Else'], users_count: 5000 },
    { title: 'Holiday Ever After', slug: 'd', author_names: ['Hannah Grace'], users_count: 9000 },
  ];
  assert.equal(pickHardcover(book, docs).slug, 'b');
  assert.equal(pickHardcover(book, [docs[3]]), undefined);
});

const facts = {
  edition: { title: 'Icebreaker', number_of_pages: 400 },
  work: { author_name: ['Hannah Grace'], first_publish_year: 2022 },
};

test('a book confirmed by Open Library and Hardcover can be marked checked', () => {
  const hc = { title: 'Icebreaker', slug: 'icebreaker-2016', author_names: ['Hannah Grace'] };
  const findings = compareFacts(book, { ...facts, hc });
  const checked = applyChecked(book, {
    sources: ['https://openlibrary.org/isbn/1', 'https://hardcover.app/books/icebreaker-2016'],
    date: '2026-10-16',
    findings,
  });
  assert.equal(checked.status, 'checked');
  assert.equal(checked.checkedOn, '2026-10-16');
  assert.equal(checked.reviewedBy, undefined, 'a checked book is not attributed to a reviewer');
});

test('checked needs a second confirming source and no failures', () => {
  const sources = ['https://openlibrary.org/isbn/1', 'https://openlibrary.org/isbn/2'];
  const date = '2026-10-16';
  assert.throws(
    () => applyChecked(book, { sources, date, findings: compareFacts(book, facts) }),
    /neither Wikipedia nor Hardcover/,
  );
  const bad = compareFacts(book, { ...facts, edition: undefined });
  assert.throws(() => applyChecked(book, { sources, date, findings: bad }), /no edition/);
  assert.throws(
    () => applyChecked(book, { sources: sources.slice(0, 1), date, findings: [] }),
    /only 1/,
  );
});
