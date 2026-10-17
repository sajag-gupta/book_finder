# Design decisions

Short record of why the UI looks the way it does. Tokens live at the top of
[`src/assets/site.css`](../src/assets/site.css).

## References used

- **Taste skill** (`Leonxlnx/taste-skill`): serif display headings with a sans body, a wide fluid
  container, tinted shadows, `text-wrap: balance`, visible focus, reduced-motion respect, no
  `transition: all`.
- **Vercel Web Interface Guidelines**: placeholders and loading text end with an ellipsis, curly
  quotes, `touch-action: manipulation` on controls, `color-scheme` and `theme-color` set, images with
  explicit width and height, accessible names on icon buttons.
- **awesome-design-md** (`getdesign`): Airbnb for the search-first pill with a circular action
  button, photo-first cards and a single shadow tier; Notion for the warm neutral canvas, quiet
  chrome and one blue accent.

The skill and reference files are fetched into git-ignored folders (`.claude/skills/`, `.work/`);
nothing from them is vendored into the repo.

## Decisions

| Area          | Decision                                                                                      | Why                                                    |
| ------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Search        | Pill input with a visible blue Search button in the header, hero and browse page              | Search was the weakest part: no visible way to submit  |
| Colour        | Warm off-white canvas, one blue accent; mood colours only as small tinted icons and top rules | Covers carry the colour, chrome stays quiet            |
| Type          | Fraunces (headings) and Inter (body)                                                          | Bookish without feeling dated; both are variable fonts |
| Width         | Container up to 90rem, gutter `clamp(1rem, 3.5vw, 3rem)`                                      | Uses wide screens instead of a narrow centred column   |
| Cards         | Cover first, one soft shadow, generated cover when the real one is missing                    | Handles missing covers, long titles and authors        |
| Search states | Loading, empty and error text for the Open Library results block                              | A search should never dead-end or fail silently        |
| Dark mode     | Follows the system; same tokens, warm dark greys                                              | No separate theme to maintain                          |

## Data attribution

Ratings, reader counts, page counts, series order and reader-reported content warnings come from
Hardcover's API. They are credited as plain text ("Hardcover readers") and never link out. A rating
is shown only when at least 20 readers rated the book. Sales figures are labelled estimates.
