// /b/?isbn=...: a page for any book Open Library knows, so a search never dead-ends. Our own books
// redirect to their full page; everything else gets the facts and the where-to-get-it table.
import { coverEl, el } from './dom.js';

const root = document.querySelector('[data-lookup]');
if (root) {
  const isbn = (new URLSearchParams(location.search).get('isbn') ?? '').replace(/\D/g, '');
  const stores = JSON.parse(document.getElementById('stores')?.textContent ?? '[]');
  const titles = JSON.parse(document.getElementById('format-titles')?.textContent ?? '{}');
  const status = root.querySelector('[data-status]');
  const body = root.querySelector('[data-body]');

  const fail = (message) => {
    status.textContent = message;
    body.hidden = true;
  };

  const offers = (book) => {
    const query = [book.title, book.authors[0]].filter(Boolean).join(' ');
    const table = el('table');
    const head = el('thead');
    const row = el('tr');
    for (const label of ['Store', 'Price']) row.append(el('th', '', label));
    row.append(el('th'));
    head.append(row);
    table.append(head);
    for (const kind of Object.keys(titles)) {
      const group = stores.filter((s) => s.kind === kind);
      if (!group.length) continue;
      const tbody = el('tbody');
      const title = el('tr', 'group');
      const th = el('th', '', titles[kind]);
      th.colSpan = 3;
      th.scope = 'rowgroup';
      title.append(th);
      tbody.append(title);
      for (const store of group) {
        const tr = el('tr');
        const link = el('a', `btn${kind === 'library' ? ' btn--library' : ''}`, store.label);
        link.href = `/go/${store.id}/${isbn}${store.q ? `?q=${encodeURIComponent(query)}` : ''}`;
        link.rel = kind === 'library' ? 'nofollow noopener' : 'sponsored nofollow noopener';
        link.target = '_blank';
        const go = el('td', 'offer__go');
        go.append(link);
        tr.append(
          el('td', 'offer__store', store.name),
          el('td', 'offer__price', kind === 'library' ? 'Free with a library card' : 'Check price'),
          go,
        );
        tbody.append(tr);
      }
      table.append(tbody);
    }
    return table;
  };

  const show = (book) => {
    document.title = `${book.title} | where to buy or borrow`;
    const author = book.authors.join(', ');
    status.hidden = true;
    body.hidden = false;
    body
      .querySelector('[data-cover]')
      .replaceChildren(
        coverEl({ key: isbn, title: book.title, author, isbn, size: 'L', width: 220, height: 330 }),
      );
    body.querySelector('[data-title]').textContent = book.title;
    body.querySelector('[data-author]').textContent = author ? `by ${author}` : '';
    const facts = [
      ['First published', book.year],
      ['Pages', book.pages],
      ['Publisher', book.publisher],
    ].filter(([, value]) => value);
    body.querySelector('[data-facts]').replaceChildren(
      ...facts.map(([label, value]) => {
        const div = el('div');
        div.append(el('dt', '', label), el('dd', '', String(value)));
        return div;
      }),
    );
    body
      .querySelector('[data-subjects]')
      .replaceChildren(...book.subjects.map((s) => el('li', 'tag', s)));
    body.querySelector('[data-offers]').replaceChildren(offers(book));
  };

  if (!/^97[89]\d{10}$/.test(isbn)) {
    fail('That does not look like a valid book number.');
  } else {
    // Books we have written about get their full page instead.
    fetch('/search-index.json')
      .then((r) => (r.ok ? r.json() : []))
      .catch(() => [])
      .then((index) => {
        const known = index.find((b) => b.i === isbn);
        if (known) return location.replace(`/books/${known.s}/`);
        return fetch(`/api/book?isbn=${isbn}`)
          .then(async (r) => {
            if (r.status === 404) return fail('We could not find that book.');
            if (!r.ok) return fail('Book details are unavailable right now. Please try again.');
            show((await r.json()).book);
          })
          .catch(() => fail('Book details are unavailable right now. Please try again.'));
      });
  }
}
