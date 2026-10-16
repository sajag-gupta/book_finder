// The shelf page: tabs by status, reading stats, and import/export. Everything runs in the browser
// against localStorage; nothing is uploaded. Books are built with DOM methods and textContent so book
// data can never inject markup.
import { STATUSES, createStore, migrate } from './shelf-store.js';
import { importRows, parseCsv } from './shelf-import.js';
import { readingStats } from './shelf-stats.js';

const root = document.querySelector('[data-shelf-app]');
if (root) {
  const store = createStore();
  const list = root.querySelector('[data-shelf]');
  const emptyEl = root.querySelector('[data-shelf-empty]');
  const tabs = root.querySelector('[data-tabs]');
  const statsEl = root.querySelector('[data-stats]');
  const message = root.querySelector('[data-import-msg]');
  const genreNames = JSON.parse(document.getElementById('genre-names')?.textContent ?? '{}');
  const labels = Object.fromEntries(STATUSES);
  let filter = 'all';
  let index = [];
  let bySlug = new Map();

  const hue = (slug) => {
    let h = 0;
    for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) % 36;
    return h;
  };
  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };

  function card(book, item) {
    const li = el('li', 'card');
    const link = el('a', 'card__link');
    link.href = `/books/${book.s}/`;
    const cover = el('span', `cover hue-${hue(book.s)}`);
    const fallback = el('span', 'cover__fallback');
    fallback.setAttribute('aria-hidden', 'true');
    fallback.append(el('span', 'cover__title', book.t), el('span', 'cover__author', book.a));
    const img = el('img');
    img.src = `https://covers.openlibrary.org/b/isbn/${book.i}-M.jpg?default=false`;
    img.alt = `Cover of ${book.t}`;
    img.width = 160;
    img.height = 240;
    img.loading = 'lazy';
    img.addEventListener('error', () => img.remove(), { once: true });
    cover.append(fallback, img);
    const body = el('span', 'card__body');
    const meta = [
      labels[item.status],
      item.rating ? `${item.rating} of 5 stars` : null,
      item.read,
    ].filter(Boolean);
    body.append(
      el('strong', 'card__title', book.t),
      el('span', 'card__author', book.a),
      el('span', 'card__meta', meta.join(' · ')),
    );
    link.append(cover, body);

    const select = el('select', 'card__status');
    select.setAttribute('aria-label', `Status of ${book.t}`);
    for (const [value, label] of STATUSES) {
      const option = el('option', '', label);
      option.value = value;
      option.selected = value === item.status;
      select.append(option);
    }
    select.addEventListener('change', () => {
      store.set(book.s, { status: select.value });
      render();
    });
    const remove = el('button', 'btn btn--ghost btn--small', 'Remove');
    remove.type = 'button';
    remove.addEventListener('click', () => {
      store.remove(book.s);
      render();
    });
    const controls = el('div', 'card__controls');
    controls.append(select, remove);
    li.append(link, controls);
    return li;
  }

  function renderTabs(counts) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    const entries = [['all', 'All', total], ...STATUSES.map(([k, label]) => [k, label, counts[k]])];
    tabs.replaceChildren(
      ...entries.map(([key, label, n]) => {
        const b = el('button', 'tab', `${label} (${n})`);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(filter === key));
        b.addEventListener('click', () => {
          filter = key;
          render();
        });
        return b;
      }),
    );
  }

  function renderStats(stats) {
    statsEl.hidden = stats.total === 0;
    if (stats.total === 0) return;
    const rows = [
      ['Books read', stats.counts.read],
      ['Reading now', stats.counts.reading],
      ['Want to read', stats.counts.want],
      ['Average rating', stats.averageRating ?? 'None yet'],
    ];
    const grid = el('dl', 'statgrid');
    for (const [label, value] of rows) {
      const box = el('div');
      box.append(el('dt', '', label), el('dd', '', String(value)));
      grid.append(box);
    }
    const parts = [el('h2', '', 'Your reading'), grid];
    if (stats.topGenres.length) {
      const wrap = el('div', 'bars');
      wrap.append(el('h3', '', 'Genres you read most'));
      const max = stats.topGenres[0][1];
      for (const [slug, n] of stats.topGenres) {
        const row = el('label', 'bar');
        row.append(el('span', '', genreNames[slug] ?? slug));
        const meter = el('meter');
        meter.max = max;
        meter.value = n;
        row.append(meter, el('span', 'muted', String(n)));
        wrap.append(row);
      }
      parts.push(wrap);
    }
    if (stats.booksByYear.length) {
      parts.push(
        el(
          'p',
          'muted',
          `Read by year: ${stats.booksByYear.map(([y, n]) => `${y} (${n})`).join(', ')}`,
        ),
      );
    }
    statsEl.replaceChildren(...parts);
  }

  function render() {
    const items = store.all();
    const stats = readingStats(items, bySlug);
    renderTabs(stats.counts);
    renderStats(stats);
    const shown = Object.entries(items)
      .filter(([slug, item]) => bySlug.has(slug) && (filter === 'all' || item.status === filter))
      .sort((a, b) => (b[1].added ?? 0) - (a[1].added ?? 0));
    list.replaceChildren(...shown.map(([slug, item]) => card(bySlug.get(slug), item)));
    emptyEl.hidden = shown.length > 0;
    document.dispatchEvent(new CustomEvent('shelf:count'));
  }

  // ---------- Import / export ----------
  const readFile = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsText(file);
    });

  root.querySelector('[data-import]').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const { items, matched, unmatched } = importRows(parseCsv(await readFile(file)), index);
      const added = store.merge(items);
      message.textContent = `Matched ${matched} books and added ${added} new. ${unmatched.length} were not in our catalogue and were skipped.`;
      render();
    } catch {
      message.textContent =
        'That file could not be read. Use the CSV export from Goodreads or StoryGraph.';
    }
    event.target.value = '';
  });

  root.querySelector('[data-restore]').addEventListener('change', async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      const added = store.merge(migrate(JSON.parse(await readFile(file))).items);
      message.textContent = `Restored ${added} books.`;
      render();
    } catch {
      message.textContent = 'That backup could not be read.';
    }
    event.target.value = '';
  });

  root.querySelector('[data-export]').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([store.exportJson()], { type: 'application/json' }));
    const a = el('a');
    a.href = url;
    a.download = 'my-shelf.json';
    a.click();
    URL.revokeObjectURL(url);
  });

  document.addEventListener('shelf:change', render);
  fetch('/search-index.json')
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [])
    .then((data) => {
      index = data;
      bySlug = new Map(data.map((b) => [b.s, b]));
      render();
    });
}
