// Light/dark theme. Loaded as a plain blocking script in <head> so the theme is set before first
// paint (no flash). Without JavaScript the page follows the system setting through CSS alone.
(function () {
  const KEY = 'theme';
  const root = document.documentElement;
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  function saved() {
    try {
      const value = localStorage.getItem(KEY);
      return value === 'light' || value === 'dark' ? value : null;
    } catch {
      return null;
    }
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#191816' : '#ffffff');
  }

  apply(saved() || (media.matches ? 'dark' : 'light'));

  // Follow the system until the reader makes an explicit choice.
  media.addEventListener('change', function (event) {
    if (!saved()) apply(event.matches ? 'dark' : 'light');
  });

  document.addEventListener('DOMContentLoaded', function () {
    const button = document.querySelector('[data-theme-toggle]');
    if (!button) return;
    button.hidden = false;
    function sync() {
      const dark = root.getAttribute('data-theme') === 'dark';
      button.setAttribute('aria-pressed', String(dark));
      button.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
    }
    sync();
    button.addEventListener('click', function () {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      apply(next);
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* private mode: the choice just lasts for this page */
      }
      sync();
    });
  });
})();
