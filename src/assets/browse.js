// Client-side filtering for /books/. The full list is in the HTML, so this only hides, orders and
// reveals cards; the URL keeps the state so a filtered view can be shared or bookmarked.
import { resultCard } from './dom.js';

const form = document.querySelector('[data-filters]');
const list = document.querySelector('[data-results]');

if (form && list) {
  const PAGE = 60;
  const cards = [...list.children];
  const countEl = document.querySelector('[data-count]');
  const emptyEl = document.querySelector('[data-empty]');
  const moreBtn = document.querySelector('[data-more]');
  const multi = ['genre', 'mood', 'length', 'pace', 'avoid'];
  let shown = PAGE;

  const sorters = {
    top: (a, b) => b.sold - a.sold || a.title.localeCompare(b.title),
    popular: (a, b) => b.users - a.users || a.title.localeCompare(b.title),
    az: (a, b) => a.title.localeCompare(b.title),
    newest: (a, b) => b.year - a.year || a.title.localeCompare(b.title),
    oldest: (a, b) => a.year - b.year || a.title.localeCompare(b.title),
  };
  const info = new Map(
    cards.map((el) => [
      el,
      {
        title: el.querySelector('.card__title').textContent,
        sold: Number(el.dataset.sold),
        users: Number(el.dataset.users),
        year: Number(el.dataset.year),
      },
    ]),
  );

  const chosen = (name) =>
    [...form.querySelectorAll(`input[name="${name}"]:checked`)].map((i) => i.value);
  const tokens = (value) => (value ?? '').split(' ').filter(Boolean);

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

  function writeUrl() {
    const params = new URLSearchParams();
    const q = form.elements.q.value.trim();
    if (q) params.set('q', q);
    if (form.elements.sort.value !== 'top') params.set('sort', form.elements.sort.value);
    for (const name of multi) for (const value of chosen(name)) params.append(name, value);
    const query = params.toString();
    history.replaceState(null, '', query ? `?${query}` : location.pathname);
  }

  // When our own list has few matches, Open Library fills in the rest so a search never dead-ends.
  const remoteBox = document.querySelector('[data-remote]');
  const remoteList = document.querySelector('[data-remote-list]');
  const remoteQuery = document.querySelector('[data-remote-q]');
  const known = new Set(cards.map((c) => c.dataset.isbn));
  let remoteTimer;

  function loadRemote(query, localCount) {
    clearTimeout(remoteTimer);
    if (query.length < 3 || localCount >= 12) {
      remoteBox.hidden = true;
      return;
    }
    remoteTimer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        if (!response.ok) return;
        const results = (await response.json()).results.filter((r) => !known.has(r.isbn13));
        remoteList.replaceChildren(
          ...results.map((r) =>
            resultCard({
              href: `/b/?isbn=${r.isbn13}`,
              key: r.isbn13,
              title: r.title,
              author: r.author,
              isbn: r.isbn13,
              meta: r.year ? String(r.year) : '',
            }),
          ),
        );
        remoteQuery.textContent = query;
        remoteBox.hidden = results.length === 0;
      } catch {
        remoteBox.hidden = true;
      }
    }, 350);
  }

  function apply(resetPage = true) {
    if (resetPage) shown = PAGE;
    const words = form.elements.q.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const want = Object.fromEntries(multi.map((n) => [n, chosen(n)]));
    const anyOf = (picked, have) => picked.length === 0 || picked.some((p) => have.includes(p));

    const matches = cards.filter((el) => {
      const d = el.dataset;
      return (
        words.every((w) => d.title.includes(w)) &&
        anyOf(want.genre, tokens(d.genres)) &&
        anyOf(want.mood, tokens(d.moods)) &&
        anyOf(want.length, [d.length]) &&
        anyOf(want.pace, [d.pace]) &&
        !want.avoid.some((w) => tokens(d.warnings).includes(w))
      );
    });
    matches.sort((a, b) => sorters[form.elements.sort.value](info.get(a), info.get(b)));

    const visible = new Set(matches.slice(0, shown));
    list.append(...matches, ...cards.filter((el) => !matches.includes(el)));
    for (const el of cards) el.hidden = !visible.has(el);

    countEl.textContent = `${matches.length} ${matches.length === 1 ? 'book' : 'books'}`;
    emptyEl.hidden = matches.length > 0;
    loadRemote(form.elements.q.value.trim(), matches.length);
    moreBtn.hidden = matches.length <= shown;
    writeUrl();
  }

  form.addEventListener('input', () => apply());
  form.addEventListener('submit', (event) => event.preventDefault());
  form.querySelector('[data-reset]').addEventListener('click', () => {
    form.reset();
    apply();
  });
  moreBtn.addEventListener('click', () => {
    shown += PAGE;
    apply(false);
  });

  readUrl();
  apply();
}
