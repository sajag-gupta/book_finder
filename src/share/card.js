/**
 * Share-card layout: a plain element tree that satori turns into SVG. Pure (no I/O), so the layout
 * logic is testable without rendering. Cards carry text only: no cover art, because cover rights
 * are not settled (see docs/architecture.md).
 */

export const SIZES = {
  portrait: { width: 1080, height: 1350 }, // Instagram / TikTok photo posts
  og: { width: 1200, height: 630 }, // link previews
};

const INK = '#14213D';
const SKY = '#EAF5FF';
const COLORS = {
  sunshine: { bg: '#FFC933', fg: INK },
  coral: { bg: '#FF6B6B', fg: INK },
  violet: { bg: '#5A43E0', fg: '#FFFFFF' },
  mint: { bg: '#3DDC97', fg: INK },
};

const el = (type, style, children) => ({ type, props: { style, children } });
// border-box everywhere: satori defaults to content-box, so padding on a 100%-sized box overflows.
const div = (style, children) =>
  el('div', { display: 'flex', boxSizing: 'border-box', ...style }, children);

/** Shrinks the title as it gets longer so it always fits. */
export function titleSize(title, variant) {
  const scale = variant === 'og' ? 0.62 : 1;
  const size = title.length <= 18 ? 120 : title.length <= 30 ? 96 : title.length <= 44 ? 78 : 64;
  return Math.round(size * scale);
}

/**
 * @param {object} book
 * @param {{moods: Array<{slug: string, name: string, color: string}>, host: string,
 *          siteName: string, variant?: 'portrait'|'og'}} options
 */
export function cardTree(book, { moods, host, siteName, variant = 'portrait' }) {
  const og = variant === 'og';
  const pad = og ? 56 : 80;
  const chips = book.moods
    .slice(0, 3)
    .map((slug) => moods.find((m) => m.slug === slug))
    .filter(Boolean)
    .map((mood) => {
      const { bg, fg } = COLORS[mood.color] ?? COLORS.sunshine;
      return div(
        {
          background: bg,
          color: fg,
          borderRadius: 999,
          padding: og ? '8px 24px' : '12px 36px',
          fontFamily: 'Nunito Sans',
          fontWeight: 700,
          fontSize: og ? 26 : 38,
        },
        mood.name,
      );
    });

  const readIf = og
    ? null
    : div(
        {
          flexDirection: 'column',
          background: SKY,
          borderRadius: 32,
          padding: 48,
          fontFamily: 'Nunito Sans',
          fontSize: 40,
          lineHeight: 1.35,
          color: INK,
        },
        [
          el('span', { fontWeight: 700, marginBottom: 12 }, 'Read this if'),
          el('span', { fontWeight: 400 }, book.readIf),
        ],
      );

  const lead = moods.find((m) => m.slug === book.moods[0]);
  const strip = (COLORS[lead?.color] ?? COLORS.sunshine).bg;

  return div(
    {
      position: 'relative',
      flexDirection: 'column',
      justifyContent: 'space-between',
      width: '100%',
      height: '100%',
      background: '#FFFFFF',
      padding: pad,
      color: INK,
    },
    [
      div(
        {
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: og ? 16 : 28,
          background: strip,
        },
        '',
      ),
      div({ flexDirection: 'column' }, [
        div(
          {
            fontFamily: 'Fredoka',
            fontWeight: 600,
            fontSize: og ? 30 : 44,
            marginBottom: og ? 24 : 56,
          },
          siteName,
        ),
        div(
          {
            fontFamily: 'Fredoka',
            fontWeight: 600,
            fontSize: titleSize(book.title, variant),
            lineHeight: 1.05,
          },
          book.title,
        ),
        div(
          {
            fontFamily: 'Nunito Sans',
            fontSize: og ? 34 : 48,
            marginTop: 20,
            marginBottom: og ? 24 : 40,
          },
          `by ${book.author}`,
        ),
        div({ flexWrap: 'wrap', gap: 16 }, chips),
      ]),
      ...(readIf ? [readIf] : []),
      div({ flexDirection: 'column', fontFamily: 'Nunito Sans' }, [
        div({ fontSize: og ? 26 : 38, fontWeight: 700 }, 'Borrow it free, or compare every format'),
        div(
          { fontSize: og ? 24 : 34, color: '#4A5568', marginTop: 8 },
          `${host}/books/${book.slug}`,
        ),
      ]),
    ],
  );
}
