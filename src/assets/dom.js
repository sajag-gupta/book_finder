// Small DOM helpers shared by the browser scripts. Everything is built with createElement and
// textContent, so book data (titles, authors, subjects) can never inject markup.

export const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** Same 0-35 bucket as the server-rendered covers, so a book keeps its colour everywhere. */
export function hue(key) {
  let h = 0;
  for (const ch of String(key)) h = (h * 31 + ch.charCodeAt(0)) % 36;
  return h;
}

/** A cover: generated typographic cover underneath, Open Library's image on top when it exists. */
/** Image address from a cover ref ("o123" Open Library id, "gXYZ" Google volume) or, failing that, an ISBN. */
export function coverSrc({ ref, isbn, size = 'M' }) {
  if (ref?.startsWith('o'))
    return `https://covers.openlibrary.org/b/id/${ref.slice(1)}-${size}.jpg?default=false`;
  if (ref?.startsWith('g'))
    return `https://books.google.com/books/content?id=${ref.slice(1)}&printsec=frontcover&img=1&zoom=1`;
  return isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-${size}.jpg?default=false` : null;
}

export function coverEl({ key, title, author, isbn, ref, size = 'M', width = 160, height = 240 }) {
  const cover = el('span', `cover hue-${hue(key)}`);
  const fallback = el('span', 'cover__fallback');
  fallback.setAttribute('aria-hidden', 'true');
  fallback.append(el('span', 'cover__title', title), el('span', 'cover__author', author ?? ''));
  cover.append(fallback);
  const src = coverSrc({ ref, isbn, size });
  if (src) {
    const img = el('img');
    img.src = src;
    img.alt = `Cover of ${title}`;
    img.width = width;
    img.height = height;
    img.loading = 'lazy';
    img.addEventListener('error', () => img.remove(), { once: true });
    cover.append(img);
  }
  return cover;
}

/** A book card linking to `href`, for result lists. */
export function resultCard({ href, key, title, author, isbn, ref, meta }) {
  const li = el('li', 'card');
  const link = el('a', 'card__link');
  link.href = href;
  const body = el('span', 'card__body');
  body.append(el('strong', 'card__title', title), el('span', 'card__author', author ?? ''));
  if (meta) body.append(el('span', 'card__meta', meta));
  link.append(coverEl({ key, title, author, isbn, ref }), body);
  li.append(link);
  return li;
}
