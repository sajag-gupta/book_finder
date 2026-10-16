import { readFileSync } from 'node:fs';
import satori from 'satori';
import { Resvg, initWasm } from '@resvg/resvg-wasm';
import { SIZES, cardTree } from './card.js';

// satori reads TTF/OTF/WOFF (not WOFF2). Fonts ship via npm (@fontsource, SIL OFL licence).
const font = (pkg, file) =>
  readFileSync(new URL(`../../node_modules/@fontsource/${pkg}/files/${file}`, import.meta.url));

let fonts;
let wasmReady;

function loadFonts() {
  fonts ??= [
    {
      name: 'Fredoka',
      data: font('fredoka', 'fredoka-latin-600-normal.woff'),
      weight: 600,
      style: 'normal',
    },
    {
      name: 'Nunito Sans',
      data: font('nunito-sans', 'nunito-sans-latin-400-normal.woff'),
      weight: 400,
      style: 'normal',
    },
    {
      name: 'Nunito Sans',
      data: font('nunito-sans', 'nunito-sans-latin-700-normal.woff'),
      weight: 700,
      style: 'normal',
    },
  ];
  return fonts;
}

/** Renders a share card to PNG bytes. resvg runs as WebAssembly, so no native binaries are needed. */
export async function renderCardPng(book, options) {
  const variant = options.variant ?? 'portrait';
  const { width, height } = SIZES[variant];
  wasmReady ??= initWasm(
    readFileSync(new URL('../../node_modules/@resvg/resvg-wasm/index_bg.wasm', import.meta.url)),
  );
  await wasmReady;
  const svg = await satori(cardTree(book, { ...options, variant }), {
    width,
    height,
    fonts: loadFonts(),
  });
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
}
