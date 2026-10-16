// Progressive enhancement for the home-page search: without JavaScript the form goes to /books/.
const form = document.querySelector('form.search');
const input = document.getElementById('q');
const list = document.getElementById('results');

if (form && input && list) {
  let index = null;

  const load = async () => {
    if (index) return index;
    const response = await fetch('/search-index.json');
    index = response.ok ? await response.json() : [];
    return index;
  };

  const render = (matches) => {
    list.replaceChildren(
      ...matches.map(({ title, author, url }) => {
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = url;
        link.textContent = `${title} by ${author}`;
        item.append(link);
        return item;
      }),
    );
  };

  input.addEventListener('input', async () => {
    const query = input.value.trim().toLowerCase();
    if (query.length < 2) return render([]);
    const books = await load();
    render(books.filter((b) => `${b.title} ${b.author}`.toLowerCase().includes(query)).slice(0, 6));
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const query = input.value.trim().toLowerCase();
    const match = (await load()).find((b) => b.title.toLowerCase().includes(query));
    if (match) window.location.assign(match.url);
  });
}
