# Contributing to Corresponding

Small, reproducible fixes are especially helpful. For a bug report, include the
platform, steps, expected result, and extension version. Never post author PII,
private submission content, credentials, or unredacted portal HTML.

## Develop locally

Use Node.js 22.12+ and the committed lockfile:

```sh
npm ci
npm run dev
```

Run `npm run dev:web` in a second terminal for the manuscript workspace.
See the [install instructions](README.md#install) for loading a production build.

Before opening a pull request:

```sh
npm run typecheck
npm run lint:security
npm test
npm run build
npm run build:web
npx playwright install --with-deps chromium
npx playwright test
```

## Public CI

Continuous integration (CI) runs these checks on GitHub when a pull request is
opened or updated, and whenever code reaches `main`. Anyone can inspect the
[runs and logs](https://github.com/kylekimler/Corresponding/actions/workflows/ci.yml).
The README build badge links to those results.

The workflow uses an isolated Linux runner, synthetic/redacted fixtures, and a
test-only Chromium profile. It needs no publisher accounts or repository secrets,
has read-only repository permissions, and does not publish or deploy anything.
A green result is regression evidence, not live-portal certification. GitHub may
require maintainer approval before running a first-time external contributor's PR.

## Add a journal

Use real, redacted DOM evidence—not guessed selectors. Simple forms can use
declarative adapters; repeated dialogs need an existing or dedicated TypeScript
adapter. Start with the [adapter guide](docs/ADDING_AN_ADAPTER.md).

## Safety boundaries

Preserve non-empty fields by default. Keep author information local. Never
automate final submission, certification, legal declarations, payment, signatures,
or reviewer invitations. Add regression tests for changes to author identity,
ordering, affiliations, or storage. See [AGENTS.md](AGENTS.md) for architecture
constraints and [the privacy policy](docs/PRIVACY.md) for data handling.
