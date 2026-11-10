// The bottom dock: marks the current page and, with a mouse, magnifies the icons near the pointer
// (the idea of motion-primitives' Dock, without React). Touch screens just get the plain bar.
const dock = document.querySelector('[data-dock]');
if (dock) {
  const items = [...dock.querySelectorAll('[data-dock-item]')];
  const here = location.pathname;
  for (const item of items) {
    const path = new URL(item.href).pathname;
    if (path === here || (path !== '/' && here.startsWith(path))) {
      item.setAttribute('aria-current', 'page');
    }
  }

  const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
  const calm = matchMedia('(prefers-reduced-motion: reduce)');
  const reset = () => items.forEach((item) => item.style.setProperty('--s', '1'));

  dock.addEventListener('pointermove', (event) => {
    if (!finePointer.matches || calm.matches) return;
    for (const item of items) {
      const box = item.getBoundingClientRect();
      const distance = Math.abs(event.clientX - (box.left + box.width / 2));
      const scale = 1 + 0.55 * Math.max(0, 1 - distance / 140);
      item.style.setProperty('--s', scale.toFixed(3));
    }
  });
  dock.addEventListener('pointerleave', reset);
}
