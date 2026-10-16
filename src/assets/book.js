// Book page enhancements: the reader's shelf panel (status, half-star rating, date read) and the
// "reveal" control for content warnings. Both are progressive: without JavaScript the warnings are
// simply visible and the shelf panel stays hidden.
import { createStore } from './shelf-store.js';

const store = createStore();
const announce = () => document.dispatchEvent(new CustomEvent('shelf:change'));

// ---------- Shelf panel ----------
const panel = document.querySelector('[data-shelf-panel]');
if (panel) {
  const slug = panel.dataset.slug;
  const select = panel.querySelector('[data-status]');
  const dateRow = panel.querySelector('[data-date-row]');
  const date = panel.querySelector('[data-read-date]');
  const stars = panel.querySelector('[data-stars]');
  const starEls = [...stars.querySelectorAll('.star')];
  const clear = panel.querySelector('[data-clear-rating]');
  panel.hidden = false;

  const draw = () => {
    const item = store.get(slug);
    const rating = item?.rating ?? 0;
    select.value = item?.status ?? '';
    dateRow.hidden = item?.status !== 'read';
    date.value = item?.read ?? '';
    starEls.forEach((el, i) => {
      el.dataset.fill = rating >= i + 1 ? 'full' : rating >= i + 0.5 ? 'half' : 'none';
    });
    stars.setAttribute('aria-valuenow', String(rating));
    stars.setAttribute('aria-valuetext', rating ? `${rating} out of 5 stars` : 'Not rated');
    clear.hidden = rating === 0;
    document
      .querySelectorAll(`[data-save="${slug}"]`)
      .forEach((b) => b.setAttribute('aria-pressed', String(Boolean(item))));
  };

  const rate = (value) => {
    const item = store.get(slug);
    store.set(slug, { rating: value, ...(item ? {} : { status: 'read' }) });
    draw();
    announce();
  };

  select.addEventListener('change', () => {
    if (select.value === '') store.remove(slug);
    else store.set(slug, { status: select.value });
    draw();
    announce();
  });
  date.addEventListener('change', () => {
    store.set(slug, { read: date.value });
    draw();
  });
  stars.addEventListener('click', (event) => {
    const index = starEls.findIndex((el) => el.contains(event.target));
    if (index < 0) return;
    const box = starEls[index].getBoundingClientRect();
    rate(index + (event.clientX - box.left < box.width / 2 ? 0.5 : 1));
  });
  stars.addEventListener('keydown', (event) => {
    const current = store.get(slug)?.rating ?? 0;
    const step = { ArrowRight: 0.5, ArrowUp: 0.5, ArrowLeft: -0.5, ArrowDown: -0.5 }[event.key];
    if (step === undefined) return;
    event.preventDefault();
    rate(Math.min(5, Math.max(0, current + step)));
  });
  clear.addEventListener('click', () => rate(0));
  document.addEventListener('shelf:change', draw);
  draw();
}

// ---------- Content warnings: reveal on request ----------
const cw = document.querySelector('[data-cw]');
if (cw) {
  const body = cw.querySelector('[data-cw-body]');
  const toggle = cw.querySelector('[data-cw-toggle]');
  const pref = cw.querySelector('[data-cw-pref]');
  const KEY = 'bf:cw';
  const hidden = () => localStorage.getItem(KEY) === 'hide';
  let revealed = false;

  const sync = () => {
    const hide = hidden() && !revealed;
    body.hidden = hide;
    toggle.textContent = hide ? 'Reveal content warnings' : 'Hide content warnings';
    toggle.setAttribute('aria-expanded', String(!hide));
    pref.checked = hidden();
  };
  toggle.hidden = false;
  pref.closest('label').hidden = false;
  toggle.addEventListener('click', () => {
    if (hidden()) revealed = !revealed;
    else {
      // Hiding is a one-off here; use the checkbox to make it the default.
      body.hidden = !body.hidden;
      toggle.textContent = body.hidden ? 'Reveal content warnings' : 'Hide content warnings';
      toggle.setAttribute('aria-expanded', String(!body.hidden));
      return;
    }
    sync();
  });
  pref.addEventListener('change', () => {
    try {
      if (pref.checked) localStorage.setItem(KEY, 'hide');
      else localStorage.removeItem(KEY);
    } catch {
      // Storage blocked: the preference just applies to this visit.
    }
    revealed = false;
    sync();
  });
  sync();
}
