// Renders the saved shelf from localStorage. Books are looked up in the search index; everything is
// built with DOM methods and textContent so book data can never inject markup.
const list = document.querySelector('[data-shelf]');
const emptyEl = document.querySelector('[data-shelf-empty]');

if (list && emptyEl) {
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

  const card = (book) => {
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
    body.append(
      el('strong', 'card__title', book.t),
      el('span', 'card__author', book.a),
      el('span', 'card__meta', String(book.y)),
    );
    link.append(cover, body);

    const button = el('button', 'save save--text', 'Remove');
    button.type = 'button';
    button.dataset.save = book.s;
    button.setAttribute('aria-pressed', 'true');
    button.setAttribute('aria-label', `Remove ${book.t} from my shelf`);
    li.append(link, button);
    return li;
  };

  const render = async () => {
    const saved = JSON.parse(localStorage.getItem('bf:shelf') ?? '[]');
    const index = await fetch('/search-index.json')
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => []);
    const bySlug = new Map(index.map((b) => [b.s, b]));
    const books = saved.map((s) => bySlug.get(s)).filter(Boolean);
    list.replaceChildren(...books.map(card));
    emptyEl.hidden = books.length > 0;
  };

  document.addEventListener('shelf:change', render);
  render();
}
