# Corresponding

Local-first scientific identity and submission assistance. The Chrome Manifest V3 extension fills manuscript **author** forms from a canonical local roster — never the final submit.

You import authors once (CSV, saved local roster, or future Google Sheets read-only), preview the fill plan on the active portal, then fill and validate. **Final submission, certification, copyright, payment, and signatures always stay with the human.**

## Status

Active development. First supported platform: **Nature MTS / eJournalPress** (synthetic DOM fixture based on observed field IDs).

## Quick start

Run these from the **repository root** (not `.output/`):

```bash
git pull origin main
rm -rf node_modules
npm install          # expects WXT 0.21.4 + web-ext (auto-opens Chrome in dev)
npm audit --omit=dev # production deps only — expect 0 vulnerabilities
npm test
npm run typecheck
npm run build
npm run dev          # opens a dedicated Chrome test profile (see below)
```

If `npm install` still prints `WXT 0.19.x`, the tree is stale — pull `main` and reinstall cleanly.

For a one-off production build without the dev browser, load the unpacked extension from `.output/chrome-mv3` (Chrome → Extensions → Developer mode → Load unpacked).

## Kyle's testing workflow

This is the simplest day-to-day loop. You do **not** need to load the extension by hand when using `npm run dev`.

### Normal start

From the repository root:

```bash
npm run dev
```

What happens:

1. WXT builds Corresponding in development mode.
2. Chrome opens automatically with Corresponding already installed.
3. That Chrome window uses a **dedicated test profile** at `.wxt/chrome-data` — not your normal Chrome.
4. Rosters you import, cookies, and test-site logins in this window survive stopping and restarting `npm run dev`.

Leave this terminal open while you test.

### When new code landed on GitHub (dev still running)

Keep `npm run dev` running. Open a **second** terminal in the same repo folder:

```bash
git pull --ff-only
```

WXT watches source files. After the pull, changed files should hot-reload into the open test Chrome. You usually do **not** need to restart.

### When `package.json` or `package-lock.json` changed

Dependencies may have changed. Restart cleanly:

1. In the `npm run dev` terminal, press **Ctrl+C** to stop.
2. Then:

```bash
npm install
npm run dev
```

### Tips

- Always run commands from the **repository root** (the folder that contains `package.json`).
- Do not run `npm install` inside `.output/` — that can install the wrong dependency tree.
- Your everyday Chrome profile is never used or modified by this workflow.
- `.wxt/` (including the test profile at `.wxt/chrome-data`) stays on your machine and is gitignored.
- `web-ext` is a development tool that launches Chrome; it is not part of the shipped extension.

### Manual smoke test

1. `npm run build` then load `.output/chrome-mv3`.
2. Open `fixtures/nature-mts-sample.html` in Chrome.
3. Import `fixtures/sample-authors.csv` in the popup (confirm mapping if prompted).
4. Click **Preview**, then **Fill**, then review validation. Confirm submit/certify controls were not touched.

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | WXT dev build + Chrome with persistent test profile (`.wxt/chrome-data`) |
| `npm run build` | Production Chrome MV3 build |
| `npm test` / `npm run test:all` | Full Vitest suite |
| `npm run test:adapters` | Adapter contract tests |
| `npm run test:fuzz` | Chaos + property tests |
| `npm run test:fixtures` | Corpus replay + recognition |
| `npm run benchmark` | Synthetic perf thresholds |
| `npm run test:coverage` | Coverage report |
| `npm run typecheck` | TypeScript `--noEmit` |

See `docs/ADDING_AN_ADAPTER.md` for the fixture → adapter workflow.

## Permissions (local-first)

- `activeTab` — operate on the current tab when you invoke the extension
- `storage` — save rosters locally
- `scripting` — inject fill/inspect logic on demand

No broad host permissions for form filling. Author PII is not sent to a journal-autofill backend.

## Workflow

1. Open a manuscript submission portal.
2. Click the extension.
3. Select or import an author roster (CSV / saved local).
4. Confirm column mapping when import headings are ambiguous.
5. Review detected platform, missing fields, and conflicts.
6. **Preview** (dry-run) then **Fill**.
7. Review validation summary (`filled` / `preserved` / `missing email` / `conflicts`).
8. Complete submission and legal steps yourself.

## Architecture

- `src/schema` — canonical Author / Roster model (Zod)
- `src/adapters` — platform adapters (`detect` / `inspect` / `fill` / `validate`)
- `src/import` — CSV + column mapping
- `src/roster` — local saved rosters
- `src/sheets` — Google Sheets read-only abstraction (credentials blocked)
- `src/diagnostics` — redacted form probe for new portals
- `entrypoints/popup` — React UI
- `docs/` — product, privacy, roadmap, backlog, threat model, release checklist

See `AGENTS.md` for autonomous agent rules.

## Safety

Never automates: final submit, certification, copyright acceptance, COI attestations, payment, signatures, reviewer invitations.

Never stores: passwords, cookies, auth tokens, unrelated browsing history.

## License

Proprietary — all rights reserved (commercial product).
