/**
 * Hero illustration: a sunny reading corner, drawn in code so it ships as a few kilobytes of SVG
 * with no image licence to track. Decorative only, so it is hidden from screen readers.
 */
const spines = [
  ['#7c3a2d', 118],
  ['#d9a441', 96],
  ['#2f5d50', 124],
  ['#c9674f', 104],
  ['#3b4a6b', 120],
  ['#e6c88a', 92],
  ['#5b7f58', 112],
  ['#a34a4a', 100],
  ['#2d3a4f', 126],
  ['#d98b5f', 98],
  ['#6f8f72', 110],
  ['#8a5a3b', 116],
];
const shelfRow = (y, offset) => {
  let x = 640;
  return spines
    .slice(offset, offset + 8)
    .map(([fill, h], i) => {
      const w = 22 + ((i * 7) % 12);
      const rect = `<rect x="${x}" y="${y - h}" width="${w}" height="${h}" rx="2" fill="${fill}"/><rect x="${x + 4}" y="${y - h + 14}" width="${w - 8}" height="3" fill="#ffffff" opacity=".35"/>`;
      x += w + 3;
      return rect;
    })
    .join('');
};

export const HERO_ART = `<svg class="hero2__art" viewBox="0 0 900 640" role="presentation" aria-hidden="true" focusable="false" preserveAspectRatio="xMidYMid slice">
  <defs>
    <linearGradient id="ha-wall" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e7c6"/><stop offset="1" stop-color="#e5c58c"/></linearGradient>
    <linearGradient id="ha-ray" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff7da" stop-opacity=".85"/><stop offset="1" stop-color="#fff7da" stop-opacity="0"/></linearGradient>
  </defs>
  <rect width="900" height="640" fill="url(#ha-wall)"/>
  <polygon points="120,90 420,90 640,560 60,560" fill="url(#ha-ray)"/>
  <rect x="96" y="60" width="330" height="280" rx="10" fill="#7a5238"/>
  <rect x="110" y="74" width="302" height="252" rx="4" fill="#fff4d2"/>
  <path d="M110 200 L412 150 V326 H110Z" fill="#cfe3c5" opacity=".7"/>
  <path d="M110 250 C170 190 230 230 290 200 C340 176 380 196 412 180 V326 H110Z" fill="#9cc29a" opacity=".8"/>
  <rect x="258" y="74" width="8" height="252" fill="#7a5238"/><rect x="110" y="192" width="302" height="8" fill="#7a5238"/>
  <rect x="610" y="120" width="250" height="430" rx="8" fill="#4a2f22"/>
  <rect x="622" y="132" width="226" height="406" fill="#5c3b2b"/>
  <rect x="622" y="262" width="226" height="8" fill="#3b2318"/><rect x="622" y="398" width="226" height="8" fill="#3b2318"/><rect x="622" y="530" width="226" height="8" fill="#3b2318"/>
  ${shelfRow(262, 0)}${shelfRow(398, 4)}${shelfRow(530, 2)}
  <rect x="0" y="540" width="900" height="100" fill="#b07a45"/>
  <rect x="0" y="540" width="900" height="10" fill="#8f5f31"/>
  <g transform="translate(150 470)">
    <rect x="0" y="40" width="330" height="34" rx="3" fill="#2f4f5a"/><rect x="8" y="46" width="318" height="6" fill="#f3e9d2"/>
    <rect x="22" y="8" width="300" height="34" rx="3" fill="#c9674f"/><rect x="30" y="14" width="288" height="6" fill="#f3e9d2"/>
    <rect x="8" y="-26" width="290" height="36" rx="3" fill="#e6c88a"/><rect x="16" y="-20" width="276" height="6" fill="#fff8e6"/>
  </g>
  <g transform="translate(470 440)">
    <path d="M0 40 H92 V96 C92 116 76 128 46 128 C16 128 0 116 0 96Z" fill="#f4efe2"/>
    <path d="M92 52 C126 52 126 98 92 98" fill="none" stroke="#f4efe2" stroke-width="12"/>
    <ellipse cx="46" cy="40" rx="46" ry="10" fill="#6b4a33"/>
    <path d="M30 20 C20 6 40 -6 30 -22 M58 22 C48 8 68 -4 58 -20" fill="none" stroke="#fff7e8" stroke-width="5" stroke-linecap="round" opacity=".8"/>
  </g>
  <g transform="translate(40 410)">
    <path d="M60 130 H116 L108 190 H68Z" fill="#c98b5a"/>
    <path d="M88 130 C60 90 20 90 10 40 C50 52 80 80 88 130Z" fill="#4f8a5b"/>
    <path d="M88 130 C96 80 130 60 150 8 C160 56 124 90 88 130Z" fill="#3f7a50"/>
    <path d="M88 130 C70 100 90 60 82 20 C112 52 104 100 88 130Z" fill="#5fa06a"/>
  </g>
</svg>`;
