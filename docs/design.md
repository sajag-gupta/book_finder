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

## Two questions, one right book

The product rests on two ideas: how the reader feels now, and how they want to feel. The home page
and `/feel/` ask both, as two rows of pills. Picking a current feeling marks three suggested target
moods with a dot; picking both opens `/feel/<now>/<want>/`, a ranked list with a direct answer on top.
Without JavaScript the pills are plain links. A free-text box ("a cozy fantasy with found family,
no gore") maps words to moods, genres, tropes and exclusions with a small word list, no AI model, and
ranks our own catalogue. `data/vocab/feelings.json` holds the feelings and their suggested moods.

## Theme

A sun/moon button in the header switches light and dark. The choice is saved in `localStorage`; with
no saved choice the system setting is followed, and without JavaScript the CSS media query applies.
`assets/theme.js` runs before first paint so the page never flashes the wrong theme. Book rows scroll
sideways with arrow buttons instead of a scrollbar.

## Data attribution

Ratings, reader counts, page counts, series order and reader-reported content warnings come from
Hardcover's API. They are credited as plain text ("Hardcover readers") and never link out. A rating
is shown only when at least 20 readers rated the book. Sales figures are labelled estimates.
