// Site-wide progressive enhancement. Every page works without this script: it adds the saved shelf,
// search suggestions, newsletter sign-up feedback, and hides covers that failed to load.
import { createStore } from './shelf-store.js';

// ---------- Saved shelf (stored in this browser only) ----------
const store = createStore();

function syncShelf() {
  const shelf = store.all();
  for (const button of document.querySelectorAll('[data-save]')) {
    button.setAttribute('aria-pressed', String(button.dataset.save in shelf));
  }
  const count = Object.keys(shelf).length;
  for (const badge of document.querySelectorAll('[data-shelf-count]')) {
    badge.textContent = String(count);
    badge.hidden = count === 0;
  }
}

// The bookmark on a card adds a book as "want to read" or takes it off the shelf.
document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-save]');
  if (!button) return;
  const slug = button.dataset.save;
  if (store.get(slug)) store.remove(slug);
  else store.set(slug, { status: 'want' });
  syncShelf();
  document.dispatchEvent(new CustomEvent('shelf:change'));
});
document.addEventListener('shelf:change', syncShelf);
syncShelf();

// ---------- Covers: drop images that failed so the generated cover shows ----------
for (const img of document.querySelectorAll('img[data-cover]')) {
  if (img.complete && img.naturalWidth === 0) img.remove();
  else img.addEventListener('error', () => img.remove(), { once: true });
}

// ---------- Search suggestions ----------
let indexPromise;
const loadIndex = () =>
  (indexPromise ??= fetch('/search-index.json')
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => []));

for (const input of document.querySelectorAll('input[data-search]')) {
  const list = input.closest('form').querySelector('[data-suggest]');
  let active = -1;

  const close = () => {
    list.hidden = true;
    active = -1;
    input.removeAttribute('aria-activedescendant');
  };
  const items = () => [...list.querySelectorAll('a')];
  const highlight = (index) => {
    const links = items();
    active = (index + links.length) % links.length;
    links.forEach((link, i) => link.setAttribute('aria-selected', String(i === active)));
    links[active]?.scrollIntoView({ block: 'nearest' });
  };

  input.addEventListener('focus', loadIndex);
  input.addEventListener('input', async () => {
    const query = input.value.trim().toLowerCase();
    if (query.length < 2) return close();
    const words = query.split(/\s+/);
    const books = await loadIndex();
    const matches = books
      .filter((b) => words.every((w) => `${b.t} ${b.a}`.toLowerCase().includes(w)))
      .sort(
        (a, b) =>
          Number(b.t.toLowerCase().startsWith(query)) - Number(a.t.toLowerCase().startsWith(query)),
      )
      .slice(0, 6);
    list.replaceChildren(
      ...matches.map((b) => {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `/books/${b.s}/`;
        const title = document.createElement('strong');
        title.textContent = b.t;
        const by = document.createElement('span');
        by.className = 'muted';
        by.textContent = `${b.a}, ${b.y}`;
        a.append(title, by);
        li.append(a);
        return li;
      }),
    );
    list.hidden = matches.length === 0;
    active = -1;
  });
  input.addEventListener('keydown', (event) => {
    if (list.hidden) return;
    if (event.key === 'ArrowDown') (event.preventDefault(), highlight(active + 1));
    else if (event.key === 'ArrowUp') (event.preventDefault(), highlight(active - 1));
    else if (event.key === 'Escape') close();
    else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      items()[active].click();
    }
  });
  document.addEventListener('click', (event) => {
    if (!input.closest('form').contains(event.target)) close();
  });
}

// ---------- Newsletter sign-up ----------
for (const form of document.querySelectorAll('form[data-subscribe]')) {
  const message = form.querySelector('[data-msg]');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    message.textContent = 'Subscribing...';
    try {
      const response = await fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        body: new FormData(form),
      });
      const result = await response.json().catch(() => ({}));
      message.textContent =
        result.message ??
        (response.ok ? 'Check your email to confirm.' : 'Something went wrong. Please try again.');
      if (response.ok) form.reset();
    } catch {
      message.textContent = 'Could not reach the server. Please try again.';
    } finally {
      button.disabled = false;
    }
  });
}
