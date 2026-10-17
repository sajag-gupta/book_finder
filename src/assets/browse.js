// Filters, search and sorting for /books/. The server renders one page of the list so the page works
// without JavaScript; this script loads the catalogue index (catalog.json) and takes over. The URL
// keeps the state, so a filtered view can be shared or bookmarked.
import { coverEl, el } from './dom.js';

const form = document.querySelector('[data-filters]');
const wrap = document.querySelector('[data-results-wrap]');
const list = document.querySelector('[data-results]');

if (form && wrap && list) {
  const PAGE = 60;
  const countEl = document.querySelector('[data-count]');
  const emptyEl = document.querySelector('[data-empty]');
  const moreBtn = document.querySelector('[data-more]');
  const pagerEl = document.querySelector('[data-pager]');
  const multi = ['genre', 'mood', 'length', 'pace', 'avoid'];
  const total = Number(countEl.textContent.replace(/\D/g, '')) || 0;
  let shown = PAGE;
  let catalog = null;
  let loading = null;

  const sorters = {
    top: (a, b) => b.sold - a.sold || a.t.localeCompare(b.t),
    popular: (a, b) => b.users - a.users || a.t.localeCompare(b.t),
    az: (a, b) => a.t.localeCompare(b.t),
    newest: (a, b) => b.y - a.y || a.t.localeCompare(b.t),
    oldest: (a, b) => a.y - b.y || a.t.localeCompare(b.t),
  };

  const chosen = (name) =>
    [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);

  function readUrl() {
    const params = new URLSearchParams(location.search);
    form.elements.q.value = params.get('q') ?? '';
    form.elements.sort.value = sorters[params.get('sort')] ? params.get('sort') : 'top';
    for (const name of multi) {
      const wanted = new Set(params.getAll(name));
      for (const input of form.querySelectorAll(`input[name="${name}"]`))
        input.checked = wanted.has(input.value);
    }
  }

  const hasState = () =>
    form.elements.q.value.trim() ||
    form.elements.sort.value !== 'top' ||
    multi.some((n) => chosen(n).length);

  function writeUrl() {
    const params = new URLSearchParams();
    const q = form.elements.q.value.trim();
    if (q) params.set('q', q);
    if (form.elements.sort.value !== 'top') params.set('sort', form.elements.sort.value);
    for (const name of multi) for (const value of chosen(name)) params.append(name, value);
    const query = params.toString();
    history.replaceState(null, '', query ? `?${query}` : location.pathname);
  }

  const bookmark =
    '<svg class="icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"/></svg>';

  function card(book) {
    const li = el('li', 'card');
    const link = el('a', 'card__link');
    link.href = `/books/${book.s}/`;
    const body = el('span', 'card__body');
    body.append(
      el('strong', 'card__title', book.t),
      el('span', 'card__author', book.a),
      el('span', 'card__meta', [book.y, catalog.genreNames[book.g[0]]].filter(Boolean).join(' · ')),
    );
    link.append(
      coverEl({ key: book.s, title: book.t, author: book.a, isbn: book.i, ref: book.c }),
      body,
    );
    const save = el('button', 'save');
    save.type = 'button';
    save.dataset.save = book.s;
    save.setAttribute('aria-pressed', 'false');
    save.setAttribute('aria-label', `Save ${book.t} to my shelf`);
    save.innerHTML = bookmark;
    li.append(link, save);
    return li;
  }

  // When our own list has few matches, Open Library fills in the rest so a search never dead-ends.
  const remoteBox = document.querySelector('[data-remote]');
  const remoteList = document.querySelector('[data-remote-list]');
  const remoteQuery = document.querySelector('[data-remote-q]');
  const remoteStatus = document.querySelector('[data-remote-status]');
  let known = new Set();
  let lightIndex = null;
  let remoteTimer;
  let remoteRun = 0;
  const say = (text) => {
    remoteStatus.hidden = !text;
    remoteStatus.textContent = text ?? '';
  };

  function remoteCard(r) {
    const li = el('li', 'card');
    const link = el('a', 'card__link');
    link.href = r.href ?? `/b/?isbn=${r.isbn13}`;
    const body = el('span', 'card__body');
    body.append(
      el('strong', 'card__title', r.title),
      el('span', 'card__author', r.author ?? ''),
      el('span', 'card__meta', r.year ? String(r.year) : ''),
    );
    link.append(
      coverEl({
        key: r.isbn13,
        title: r.title,
        author: r.author,
        isbn: r.isbn13,
        ref: r.coverId ? `o${r.coverId}` : undefined,
      }),
      body,
    );
    li.append(link);
    return li;
  }

  function loadRemote(query, localCount) {
    clearTimeout(remoteTimer);
    if (query.length < 3 || localCount >= 12) {
      remoteBox.hidden = true;
      return;
    }
    remoteTimer = setTimeout(async () => {
      const run = ++remoteRun;
      remoteQuery.textContent = query;
      remoteList.replaceChildren();
      say('Searching more books…');
      remoteBox.hidden = false;
      try {
        // Books we list with facts only (no write-up yet) come first; they are one small file.
        lightIndex ??= await fetch('/light-index.json')
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []);
        const words = query.toLowerCase().split(/\s+/).filter(Boolean);
        const listed = lightIndex
          .filter((b) => words.every((w) => `${b.t} ${b.a}`.toLowerCase().includes(w)))
          .slice(0, 24);
        for (const b of listed) known.add(b.i);
        remoteList.replaceChildren(
          ...listed.map((b) =>
            remoteCard({
              href: `/books/${b.s}/`,
              isbn13: b.i,
              title: b.t,
              author: b.a,
              year: b.y,
            }),
          ),
        );
        if (run !== remoteRun) return;
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (run !== remoteRun) return;
        if (!response.ok) throw new Error(`search ${response.status}`);
        const results = (await response.json()).results.filter((r) => !known.has(r.isbn13));
        const total = remoteList.children.length + results.length;
        say(
          total || localCount
            ? ''
            : `No books found for “${query}”. Check the spelling or try just the author’s name.`,
        );
        remoteList.append(...results.map(remoteCard));
        remoteBox.hidden = total === 0 && localCount > 0;
      } catch {
        if (run !== remoteRun) return;
        say('Open Library search is unavailable right now. Try again in a moment.');
      }
    }, 350);
  }

  function apply(resetPage = true) {
    if (resetPage) shown = PAGE;
    const words = form.elements.q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const want = Object.fromEntries(multi.map((n) => [n, chosen(n)]));
    const anyOf = (picked, have) => picked.length === 0 || picked.some((p) => have.includes(p));

    const matches = catalog.books.filter(
      (b) =>
        words.every((w) => b.k.includes(w)) &&
        anyOf(want.genre, b.g) &&
        anyOf(want.mood, b.m) &&
        anyOf(want.length, [b.l]) &&
        anyOf(want.pace, [b.p]) &&
        !want.avoid.some((w) => b.w.includes(w)),
    );
    matches.sort(sorters[form.elements.sort.value]);

    list.replaceChildren(...matches.slice(0, shown).map(card));
    document.dispatchEvent(new CustomEvent('shelf:change'));
    countEl.textContent = `${matches.length} ${matches.length === 1 ? 'book' : 'books'}`;
    emptyEl.hidden = matches.length > 0;
    moreBtn.hidden = matches.length <= shown;
    loadRemote(form.elements.q.value.trim(), matches.length);
    writeUrl();
  }

  async function load() {
    loading ??= fetch('/catalog.json')
      .then((r) => {
        if (!r.ok) throw new Error(`catalog ${r.status}`);
        return r.json();
      })
      .then((data) => {
        for (const b of data.books) b.k = `${b.t} ${b.a}`.toLowerCase();
        catalog = data;
        known = new Set(data.books.map((b) => b.i));
        pagerEl.hidden = true;
      });
    await loading;
  }

  // The first interaction (or a shared link with filters in it) loads the index and takes over.
  async function activate(resetPage = true) {
    try {
      await load();
      apply(resetPage);
    } catch {
      emptyEl.hidden = false;
      emptyEl.textContent =
        'Filters are unavailable right now. Use the page links to keep browsing.';
    }
  }

  form.addEventListener('input', () => activate());
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    activate().then(() => list.scrollIntoView({ block: 'start', behavior: 'smooth' }));
  });
  form.querySelector('[data-reset]').addEventListener('click', () => {
    form.reset();
    activate();
  });
  moreBtn.addEventListener('click', () => {
    shown += PAGE;
    activate(false);
  });
  // Warm the index while the reader looks at the filters, so the first click is instant.
  form.addEventListener('focusin', () => load().catch(() => {}), { once: true });
  form.addEventListener('pointerenter', () => load().catch(() => {}), { once: true });

  readUrl();
  if (hasState()) activate();
  else countEl.textContent = `${total} books`;
}
