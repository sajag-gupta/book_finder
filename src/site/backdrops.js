import { readFileSync } from 'node:fs';

/**
 * Background paintings (public domain, Art Institute of Chicago), downloaded by
 * `assets.mjs --get` into src/assets/bg with their credits. Sections and page headers carry a
 * `data-bg` address; site.js sets it as the background when the section nears the screen, so the
 * images load lazily and the page still reads fine without them.
 */
const credits = JSON.parse(
  readFileSync(new URL('../assets/bg/credits.json', import.meta.url), 'utf8'),
);

export const BACKDROPS = credits.map((c) => ({
  url: c.file.replace('src/assets', '/assets'),
  title: c.title,
  creator: c.creator,
  date: c.date,
  page: c.page,
  via: c.via,
}));

const find = (part) => BACKDROPS.find((b) => b.url.includes(part))?.url;

// Pictures chosen by feel: a mood page gets a painting that suits it.
const NAMED = {
  hero: find('window-overlooking'),
  home: {
    trending: find('petite-creuse'),
    sellers: find('bay-of-marseille'),
    how: find('catskill'),
    newsletter: find('poet-s-garden'),
    footer: find('nocturne'),
  },
  moods: {
    cozy: find('poet-s-garden'),
    comforting: find('window-overlooking'),
    swoony: find('bathers'),
    adventurous: find('cotopaxi'),
    epic: find('cotopaxi'),
    hopeful: find('sunrise'),
    inspiring: find('sunrise'),
    tense: find('approaching-storm'),
    dark: find('nocturne'),
    spooky: find('moonlight'),
    haunting: find('moonlight'),
    mysterious: find('moonlight'),
    heartbreaking: find('icebound'),
    melancholic: find('icebound'),
    thoughtful: find('moon-at-night'),
    nostalgic: find('poet-s-garden'),
    whimsical: find('bathers'),
    funny: find('beach'),
  },
};

export const HERO = NAMED.hero;
export const HOME = NAMED.home;

const hash = (text) => [...text].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 9973, 7);

/** A painting for a page: chosen by mood when there is one, otherwise a steady pick from the key. */
export function backdropFor(key, mood) {
  return NAMED.moods[mood] ?? BACKDROPS[hash(String(key)) % BACKDROPS.length].url;
}
