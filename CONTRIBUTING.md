# Contributing

Thanks for helping. This is a small project, so the process is light.

## Workflow

1. Branch from `main` (`feat/...`, `fix/...`, `data/...`, `docs/...`).
2. Make the change and run `npm run check`. CI runs the same command.
3. Open a pull request using the template. Keep it focused: one concern per PR.
4. Squash-merge once CI is green.

Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/):
`feat:`, `fix:`, `data:`, `docs:`, `chore:`, `test:`, `refactor:`.

## Code

- Plain ESM JavaScript on Node 24. No framework and no build step beyond `scripts/build.js`.
- Prettier and ESLint are enforced. `npm run format` fixes style.
- Anything that decides where a reader is sent (`src/shared/links.js`, `offers.js`) needs tests. The
  site must never hide a cheaper option to favour a commission.
- Code in `src/shared/` also runs in the Cloudflare Workers runtime, so keep it free of Node-only APIs.

## Data

Book records are the product. Read the [editorial guide](docs/editorial-guide.md) first. Never paste
publisher blurbs, reviews or text from other sites.

## Licence

No licence has been granted yet, so the code and content are all rights reserved by default. If you
want to contribute, open an issue first so we can agree terms.
