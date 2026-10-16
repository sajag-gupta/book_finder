// Progressive enhancement: the "Download share card" link works without JavaScript. This adds a
// native share sheet where the browser has one, and a copy-link button where it does not.
const button = document.querySelector('[data-share]');

if (button && (navigator.share || navigator.clipboard)) {
  const { title, url } = button.dataset;
  const label = button.textContent;
  button.hidden = false;
  if (!navigator.share) button.textContent = 'Copy link';

  button.addEventListener('click', async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        button.textContent = 'Link copied';
        setTimeout(() => {
          button.textContent = 'Copy link';
        }, 2000);
      }
    } catch {
      // The reader dismissed the share sheet or clipboard access was denied: nothing to do.
      button.textContent = navigator.share ? label : 'Copy link';
    }
  });
}
