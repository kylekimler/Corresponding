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
npm install          # expects WXT 0.21.4 and `found 0 vulnerabilities`
npm audit
npm test
npm run typecheck
npm run build
npm run dev
```

If `npm install` still prints `WXT 0.19.x` or reports critical vulnerabilities, the tree is stale — pull `main` and reinstall cleanly.

Load the unpacked extension from `.output/chrome-mv3` (Chrome → Extensions → Developer mode → Load unpacked), or use `npm run dev` with WXT.

### Manual smoke test

1. `npm run build` then load `.output/chrome-mv3`.
2. Open `fixtures/nature-mts-sample.html` in Chrome.
3. Import `fixtures/sample-authors.csv` in the popup (confirm mapping if prompted).
4. Click **Preview**, then **Fill**, then review validation. Confirm submit/certify controls were not touched.

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | WXT development build |
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
