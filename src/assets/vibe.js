// "Describe it in your own words" on /feel/. Loads a compact index of the catalogue the first time
// it is needed, parses the sentence (see vibe-core.js) and shows the best matches.
import { resultCard } from './dom.js';
import { parseVibe, rankBooks } from './vibe-core.js';

const section = document.querySelector('[data-vibe]');
if (section) {
  const form = section.querySelector('[data-vibe-form]');
  const input = form.elements.vibe;
  const status = section.querySelector('[data-vibe-status]');
  const results = section.querySelector('[data-vibe-results]');
  let index;

  const load = () =>
    (index ??= fetch('/catalog.json').then((r) => {
      if (!r.ok) throw new Error(`index ${r.status}`);
      return r.json();
    }));

  const names = (list, vocab) => list.map((s) => vocab[s] ?? s);

  async function run() {
    const text = input.value.trim();
    results.replaceChildren();
    if (!text) {
      status.textContent = '';
      return;
    }
    status.textContent = 'Finding books…';
    try {
      const data = await load();
      const vibe = parseVibe(text, data);
      const ranked = rankBooks(data.books, vibe);
      const read = [
        ...names(vibe.moods, data.moodNames),
        ...names(vibe.genres, data.genreNames),
        ...vibe.tropes.map((s) => data.tropes.find((t) => t.s === s)?.n ?? s),
      ];
      const skip = [
        ...vibe.avoidWarnings,
        ...names(vibe.avoidGenres, data.genreNames),
        ...names(vibe.avoidMoods, data.moodNames),
      ];
      if (!ranked.length) {
        status.textContent = read.length
          ? 'No books matched all of that. Try fewer details.'
          : 'We could not tell what you are after. Try naming a mood (cozy, tense), a genre or a trope.';
        return;
      }
      status.textContent = `${ranked.length} books for: ${read.join(', ')}${skip.length ? `. Leaving out: ${skip.join(', ')}` : ''}.`;
      results.replaceChildren(
        ...ranked.map(({ book, why }) => {
          const card = resultCard({
            href: `/books/${book.s}/`,
            key: book.s,
            title: book.t,
            author: book.a,
            isbn: book.i,
            ref: book.c,
            meta: why.map((w) => data.moodNames[w] ?? data.genreNames[w] ?? w).join(' · '),
          });
          return card;
        }),
      );
    } catch {
      status.textContent = 'Search is unavailable right now. Try again in a moment.';
      results.replaceChildren();
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    run();
  });

  // Links such as /feel/?vibe=cozy+fantasy fill the box and run straight away.
  const preset = new URLSearchParams(location.search).get('vibe');
  if (preset) {
    input.value = preset;
    run();
  }
}
