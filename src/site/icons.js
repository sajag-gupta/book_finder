import { readFileSync } from 'node:fs';

/**
 * Inline SVG icons from Lucide (ISC licence), read from node_modules at build time so pages ship
 * no icon font and no extra requests. Icons are decorative: they are hidden from screen readers
 * and every control that uses one also has visible or sr-only text.
 */
const dir = new URL('../../node_modules/lucide-static/icons/', import.meta.url);
const cache = new Map();

export function icon(name, { size = 20, className = '' } = {}) {
  let svg = cache.get(name);
  if (!svg) {
    svg = readFileSync(new URL(`${name}.svg`, dir), 'utf8')
      .replace(/<!--[\s\S]*?-->\s*/g, '')
      .replace(/\sclass="[^"]*"/, '')
      .replace(/\swidth="\d+"/, ' width="__W__"')
      .replace(/\sheight="\d+"/, ' height="__H__"')
      .replace('<svg', '<svg class="icon__C__" aria-hidden="true" focusable="false"')
      .trim();
    cache.set(name, svg);
  }
  return svg
    .replace('__W__', String(size))
    .replace('__H__', String(size))
    .replace('__C__', className ? ` ${className}` : '');
}
