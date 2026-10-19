/**
 * Builds every logo-derived image from the one master logo, so the brand is changed in one place.
 *
 *   node scripts/make-brand.mjs
 *
 * Input:  src/assets/brand/logo.png  (the full logo with mascot, name and tagline, square)
 * Output: (mark.png, the transparent mascot for the header and footer, is cut from the logo by hand
 *         and committed; the other sizes below are generated)
 *         src/assets/brand/icon-32.png         favicon
 *         src/assets/brand/apple-touch-icon.png
 *         src/assets/brand/icon-192.png, icon-512.png   web app icons
 *         src/assets/brand/og-default.png      1200x630 link preview used on pages without their own
 *         docs/assets/logo.png                 for the README
 * Crops are drawn by resvg (WebAssembly), so no image library or native binary is needed.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Resvg, initWasm } from '@resvg/resvg-wasm';

const root = fileURLToPath(new URL('..', import.meta.url));
const at = (...p) => new URL(`../${p.join('/')}`, import.meta.url);
const GROUND = '#fdf9ee';
const logo = `data:image/png;base64,${readFileSync(at('src/assets/brand/logo.png')).toString('base64')}`;

await initWasm(readFileSync(at('node_modules/@resvg/resvg-wasm/index_bg.wasm')));

/** Renders the part of the logo inside (x, y, w, h), centred on a plain ground of `outW` x `outH`. */
function render({ crop, outW, outH = outW, pad = 0 }) {
  const [x, y, w, h] = crop;
  const scale = Math.min((outW - pad * 2) / w, (outH - pad * 2) / h);
  const dw = w * scale;
  const dh = h * scale;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${outW}" height="${outH}" viewBox="0 0 ${outW} ${outH}">
  <rect width="${outW}" height="${outH}" fill="${GROUND}"/>
  <svg x="${(outW - dw) / 2}" y="${(outH - dh) / 2}" width="${dw}" height="${dh}" viewBox="${x} ${y} ${w} ${h}">
    <image href="${logo}" width="1254" height="1254"/>
  </svg>
</svg>`;
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: outW } });
  const image = resvg.render();
  try {
    return image.asPng();
  } finally {
    image.free();
    resvg.free();
  }
}

const out = (name, bytes) => {
  writeFileSync(at('src/assets/brand', name), bytes);
  console.log(`src/assets/brand/${name}  ${Math.round(bytes.length / 1024)} KB`);
};

// The tighter crop of the character, used for tiny sizes.
const FACE = [385, 335, 520, 470];

mkdirSync(at('src/assets/brand'), { recursive: true });
mkdirSync(at('docs/assets'), { recursive: true });
out('icon-32.png', render({ crop: FACE, outW: 32, pad: 1 }));
out('apple-touch-icon.png', render({ crop: FACE, outW: 180, pad: 14 }));
out('icon-192.png', render({ crop: FACE, outW: 192, pad: 16 }));
out('icon-512.png', render({ crop: FACE, outW: 512, pad: 40 }));
out('og-default.png', render({ crop: [60, 190, 1134, 860], outW: 1200, outH: 630, pad: 20 }));
writeFileSync(
  at('docs/assets/logo.png'),
  render({ crop: [0, 150, 1254, 960], outW: 900, outH: 690, pad: 0 }),
);
console.log('docs/assets/logo.png');
console.log(`Done in ${root}`);
