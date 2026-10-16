// Imports a Goodreads or StoryGraph CSV export, entirely in the browser. Books are matched to this
// site's catalogue by ISBN-13, falling back to title plus the author's surname.

/** Minimal RFC 4180 CSV parser: quoted fields, escaped quotes, newlines inside quotes, BOM. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = text.startsWith('\uFEFF') ? text.slice(1) : text;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && source[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((cell) => cell !== '')) rows.push(row);

  const [header, ...body] = rows;
  if (!header) return [];
  return body.map((cells) =>
    Object.fromEntries(header.map((name, i) => [name.trim(), cells[i] ?? ''])),
  );
}

const norm = (s) =>
  String(s ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** "Fourth Wing (The Empyrean, #1)" -> "fourth wing". */
const cleanTitle = (title) =>
  norm(
    String(title)
      .replace(/\s*\([^)]*\)\s*$/, '')
      .split(':')[0],
  );
const surname = (author) => norm(author).split(' ').filter(Boolean).at(-1) ?? '';
const digits = (value) => String(value ?? '').replace(/\D/g, '');

const STATUS_MAP = {
  read: 'read',
  'to-read': 'want',
  'currently-reading': 'reading',
  'did-not-finish': 'dnf',
  paused: 'paused',
};

const isoDate = (value) => {
  const m = String(value ?? '').match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null;
};

/**
 * @param {Array<Record<string, string>>} rows  parseCsv output
 * @param {Array<{s: string, t: string, a: string, i: string}>} index  the site's search index
 * @returns {{items: Record<string, object>, matched: number, unmatched: string[]}}
 */
export function importRows(rows, index) {
  const byIsbn = new Map(index.map((b) => [b.i, b]));
  const byTitle = new Map();
  for (const b of index) {
    const key = cleanTitle(b.t);
    if (!byTitle.has(key)) byTitle.set(key, []);
    byTitle.get(key).push(b);
  }

  const items = {};
  const unmatched = [];
  for (const row of rows) {
    const title = row.Title ?? '';
    const author = row.Author ?? row.Authors ?? '';
    const isbn = digits(row.ISBN13 ?? row['ISBN/UID'] ?? '');
    const book =
      byIsbn.get(isbn) ??
      (byTitle.get(cleanTitle(title)) ?? []).find(
        (b) => surname(b.a) === surname(author.split(',')[0] || author),
      );
    if (!book) {
      if (title) unmatched.push(title);
      continue;
    }
    const shelf = (row['Exclusive Shelf'] ?? row['Read Status'] ?? 'to-read').trim().toLowerCase();
    const rating = Number(row['My Rating'] ?? row['Star Rating'] ?? 0) || 0;
    items[book.s] = {
      status: STATUS_MAP[shelf] ?? 'want',
      rating,
      read: isoDate(row['Date Read'] ?? row['Last Date Read']),
    };
  }
  return { items, matched: Object.keys(items).length, unmatched };
}
