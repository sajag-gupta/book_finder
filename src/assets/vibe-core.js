// Turns a sentence such as "a cozy fantasy with found family, no gore" into filters over our own
// catalogue. No server and no AI model: a small word list maps phrases to moods, genres, tropes and
// content warnings, and a word like "no" or "without" turns the next match into an exclusion.

const MOOD_WORDS = {
  cozy: ['cozy', 'cosy', 'snug', 'cuddly', 'hygge', 'low stakes', 'low-stakes'],
  comforting: ['comforting', 'comfort', 'soothing', 'calming', 'gentle', 'relaxing', 'soft'],
  swoony: ['swoony', 'swoon', 'romantic', 'steamy', 'butterflies', 'love story'],
  adventurous: ['adventurous', 'adventure', 'quest', 'journey', 'voyage', 'exciting'],
  hopeful: ['hopeful', 'uplifting', 'feel good', 'feel-good', 'optimistic', 'heartwarming'],
  tense: [
    'tense',
    'thrilling',
    'gripping',
    'suspenseful',
    'suspense',
    'page turner',
    'page-turner',
  ],
  heartbreaking: ['heartbreaking', 'tearjerker', 'make me cry', 'cry', 'tissues', 'devastating'],
  funny: ['funny', 'hilarious', 'laugh', 'humor', 'humour', 'comedy', 'comic'],
  thoughtful: ['thoughtful', 'philosophical', 'deep', 'reflective', 'thought provoking'],
  whimsical: ['whimsical', 'magical', 'quirky', 'charming', 'playful'],
  dark: ['dark', 'gritty', 'grim', 'bleak', 'brutal'],
  haunting: ['haunting', 'lingering', 'eerie', 'atmospheric'],
  mysterious: ['mysterious', 'mystery', 'whodunit', 'puzzle', 'clues'],
  spooky: ['spooky', 'scary', 'creepy', 'chilling', 'terrifying', 'frightening'],
  epic: ['epic', 'sweeping', 'grand', 'saga'],
  nostalgic: ['nostalgic', 'nostalgia', 'old school', 'childhood', 'classic feel'],
  witty: ['witty', 'clever', 'sharp', 'sarcastic', 'dry humour', 'dry humor'],
  melancholic: ['melancholic', 'melancholy', 'bittersweet', 'wistful'],
  'mind-bending': ['mind bending', 'mind-bending', 'twisty', 'plot twists', 'twist', 'trippy'],
  inspiring: ['inspiring', 'motivating', 'empowering', 'life changing', 'life-changing'],
};

const GENRE_WORDS = {
  romance: ['romance', 'love story', 'rom com', 'rom-com'],
  romantasy: ['romantasy'],
  fantasy: ['fantasy', 'magic', 'wizards', 'dragons'],
  'cozy-fantasy': ['cozy fantasy', 'cosy fantasy'],
  'epic-fantasy': ['epic fantasy', 'high fantasy'],
  'science-fiction': ['sci-fi', 'scifi', 'sci fi', 'science fiction', 'space', 'aliens'],
  dystopian: ['dystopian', 'dystopia', 'post apocalyptic'],
  thriller: ['thriller', 'thrillers'],
  mystery: ['mystery', 'mysteries', 'detective', 'whodunit'],
  crime: ['crime', 'true crime', 'noir'],
  horror: ['horror'],
  historical: ['historical', 'history', 'period drama'],
  'young-adult': ['ya', 'young adult', 'teen'],
  literary: ['literary'],
  classic: ['classic', 'classics'],
  adventure: ['adventure'],
  children: ['kids', 'children', 'childrens', "children's"],
};

// Words that mean "leave this out" when they follow a negation.
const WARNING_WORDS = {
  gore: ['gore', 'gory', 'graphic violence'],
  violence: ['violence', 'violent'],
  'sexual-content': ['sex', 'sexual content', 'spicy', 'explicit', 'smut', 'steam'],
  death: ['death', 'dying'],
  'animal-death': ['animal death', 'animals dying', 'dog dies'],
  grief: ['grief', 'grieving'],
  abuse: ['abuse'],
  suicide: ['suicide'],
  war: ['war'],
};

const NEGATIONS = [
  'no',
  'not',
  'without',
  'avoid',
  'avoiding',
  'except',
  'nothing',
  'minus',
  'skip',
];

const LENGTH_WORDS = {
  short: ['short', 'quick read', 'quick', 'novella', 'one sitting'],
  long: ['long', 'doorstopper', 'chunky', 'huge', 'massive', 'long read'],
};
const PACE_WORDS = {
  fast: ['fast', 'fast paced', 'fast-paced', 'page turner', 'page-turner', 'unputdownable'],
  slow: ['slow', 'slow paced', 'slow-paced', 'leisurely'],
};

const clean = (text) =>
  ` ${text
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^a-z0-9' -]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()} `;

const has = (text, phrase) => text.includes(` ${phrase} `) || text.includes(` ${phrase}s `);

/** Position of the first word of `phrase` in `text`, or -1. */
const at = (text, phrase) => {
  const a = text.indexOf(` ${phrase} `);
  return a >= 0 ? a : text.indexOf(` ${phrase}s `);
};

/** True when a negation sits within the three words before `index`. */
function negated(text, index) {
  const before = text.slice(0, index).trim().split(' ').slice(-3);
  return before.some((w) => NEGATIONS.includes(w));
}

/**
 * @param {string} input what the reader typed
 * @param {{moods: string[], genres: string[], tropes: {s: string, n: string}[], feelings: {s: string, words: string[], wants: string[]}[]}} lexicon
 */
export function parseVibe(input, lexicon) {
  const text = clean(input);
  const found = {
    moods: [],
    genres: [],
    tropes: [],
    avoidWarnings: [],
    avoidGenres: [],
    avoidMoods: [],
  };
  const push = (list, value) => {
    if (!list.includes(value)) list.push(value);
  };

  // Longest phrases first so "cozy fantasy" is read as one genre, not as "cozy" plus "fantasy".
  const scan = (table, valid, onHit) => {
    for (const [slug, words] of Object.entries(table)) {
      if (valid && !valid.includes(slug)) continue;
      for (const word of [...words].sort((a, b) => b.length - a.length)) {
        const index = at(text, word);
        if (index >= 0) {
          onHit(slug, index);
          break;
        }
      }
    }
  };

  scan(GENRE_WORDS, lexicon.genres, (slug, index) =>
    negated(text, index) ? push(found.avoidGenres, slug) : push(found.genres, slug),
  );
  if (found.genres.includes('cozy-fantasy') || found.genres.includes('epic-fantasy')) {
    found.genres = found.genres.filter((g) => g !== 'fantasy');
  }
  scan(MOOD_WORDS, lexicon.moods, (slug, index) => {
    // "cozy fantasy" names a genre; do not also demand the cozy mood from it.
    if (found.genres.includes('cozy-fantasy') && slug === 'cozy') return;
    negated(text, index) ? push(found.avoidMoods, slug) : push(found.moods, slug);
  });
  scan(WARNING_WORDS, null, (slug, index) => {
    if (negated(text, index)) push(found.avoidWarnings, slug);
  });
  for (const trope of lexicon.tropes) {
    const name = trope.n.toLowerCase();
    if (has(text, name) || has(text, name.replace(/-/g, ' ')))
      if (!negated(text, at(text, name))) push(found.tropes, trope.s);
  }

  // Current-feeling words ("I am stressed") suggest moods, but never override what was asked for.
  const feelings = [];
  for (const feeling of lexicon.feelings) {
    if (feeling.words.some((w) => has(text, w))) {
      feelings.push(feeling.s);
      if (found.moods.length === 0) for (const m of feeling.wants.slice(0, 2)) push(found.moods, m);
    }
  }

  const pick = (table) => Object.keys(table).find((k) => table[k].some((w) => has(text, w)));
  return {
    ...found,
    feelings,
    length: pick(LENGTH_WORDS) ?? null,
    pace: pick(PACE_WORDS) ?? null,
  };
}

const LENGTH_OF = { short: ['short'], long: ['long'] };

/** Scores books against a parsed vibe. Each book is `{s,t,a,g,m,tr,w,l,p,sold,users}` (see build). */
export function rankBooks(books, vibe, limit = 36) {
  const wantsAnything =
    vibe.moods.length || vibe.genres.length || vibe.tropes.length || vibe.length || vibe.pace;
  if (!wantsAnything) return [];
  const scored = [];
  for (const book of books) {
    if (vibe.avoidWarnings.some((w) => book.w.includes(w))) continue;
    if (vibe.avoidGenres.some((g) => book.g.includes(g))) continue;
    if (vibe.avoidMoods.some((m) => book.m.includes(m))) continue;
    let score = 0;
    const why = [];
    for (const m of vibe.moods) if (book.m.includes(m)) ((score += 3), why.push(m));
    for (const g of vibe.genres) if (book.g.includes(g)) ((score += 3), why.push(g));
    for (const t of vibe.tropes) if (book.tr.includes(t)) ((score += 2.5), why.push(t));
    if (vibe.length && LENGTH_OF[vibe.length]?.includes(book.l))
      ((score += 1), why.push(vibe.length));
    if (vibe.pace && book.p === vibe.pace) ((score += 1), why.push(vibe.pace));
    if (!why.length) continue;
    // Break ties toward books many people have read, without letting popularity beat a better match.
    score += Math.min(0.9, Math.log10(1 + (book.users || 0) + (book.sold || 0) * 1000) / 8);
    scored.push({ book, score, why });
  }
  scored.sort((a, b) => b.score - a.score || a.book.t.localeCompare(b.book.t));
  return scored.slice(0, limit);
}
