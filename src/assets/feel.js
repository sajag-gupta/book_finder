// The two-step feeling picker. Without JavaScript the pills are plain links (a feeling opens its own
// page, a mood opens the mood page). With it, picking both goes straight to the matching page.
for (const root of document.querySelectorAll('[data-feel]')) {
  const pairs = new Set((root.dataset.pairs ?? '').split(' '));
  const nowLinks = [...root.querySelectorAll('[data-now]')];
  const wantLinks = [...root.querySelectorAll('[data-want]')];
  const go = root.querySelector('[data-feel-go]');
  const hint = root.querySelector('[data-feel-hint]');
  let now = null;
  let want = null;

  const target = () => {
    if (now && want)
      return pairs.has(`${now}:${want}`) ? `/feel/${now}/${want}/` : `/moods/${want}/`;
    if (want) return `/moods/${want}/`;
    return now ? `/feel/${now}/` : '/moods/';
  };

  function render() {
    for (const a of nowLinks) a.setAttribute('aria-pressed', String(a.dataset.now === now));
    const suggested = now
      ? new Set((nowLinks.find((a) => a.dataset.now === now)?.dataset.wants ?? '').split(' '))
      : new Set();
    for (const a of wantLinks) {
      a.setAttribute('aria-pressed', String(a.dataset.want === want));
      a.classList.toggle('pill--suggested', suggested.has(a.dataset.want));
    }
    if (hint) {
      hint.hidden = !now;
      hint.textContent = now
        ? 'Suggested for you are marked with a dot. Pick any mood you like.'
        : '';
    }
    go.href = target();
  }

  for (const a of [...nowLinks, ...wantLinks]) a.setAttribute('role', 'button');
  for (const a of nowLinks) {
    a.addEventListener('click', (event) => {
      event.preventDefault();
      now = now === a.dataset.now ? null : a.dataset.now;
      render();
      if (now)
        root
          .querySelector('[data-want]')
          ?.closest('.feel__step')
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }
  for (const a of wantLinks) {
    a.addEventListener('click', (event) => {
      event.preventDefault();
      want = want === a.dataset.want ? null : a.dataset.want;
      render();
    });
  }
  render();
}
