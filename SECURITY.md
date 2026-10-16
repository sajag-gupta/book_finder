# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub's
[private vulnerability reporting](https://github.com/sajag-gupta/book_finder/security/advisories/new)
rather than a public issue. Expect an acknowledgement within a few days.

## Scope notes

- The only server-side code is the `/go/<store>/<isbn13>` redirect. It resolves targets only from
  `config/stores.json` templates after validating the ISBN, so it cannot be used as an open redirect.
- The click log stores no IP address or user agent.
- Secrets live in a git-ignored `.env` locally and in GitHub repository secrets for deploys. If you
  find a secret in the history, report it so it can be rotated.
