# Corresponding

Local-first scientific identity and submission assistance. The Chrome Manifest V3 extension fills manuscript **author** forms from a canonical local roster — never the final submit.

You import authors once (CSV, saved local roster, or future Google Sheets read-only), preview the fill plan on the active portal, then fill and validate. **Final submission, certification, copyright, payment, and signatures always stay with the human.**

## Status

Active development. Supported adapters:

- **Nature MTS / eJournalPress** — synthetic fixture based on observed field IDs
- **bioRxiv / medRxiv author entry** — capture-backed repeated Add Author dialog;
  automated fixture coverage complete, first live smoke pending
- **Editorial Manager author form** — capture-backed `FirstName` / `LastName` /
  `Email` fields inside the manuscript-data iframe (PLOS ONE 2026-08-15).
  Fills the open Add/Edit Author form only; never writes title, abstract,
  funding, or submit. Live multi-author Save + Add Another Author still needs
  a smoke on a real journal tab.

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

1. WXT builds Corresponding in development mode (Vite server on `http://localhost:3000`).
2. Chrome opens automatically with Corresponding already installed.
3. Chrome opens the **synthetic Nature MTS fixture** at  
   `http://localhost:3000/fixtures/nature-mts-sample.html`  
   (served by the same WXT server — not a second process, not your everyday Chrome).
4. That Chrome window uses a **dedicated test profile** at `.wxt/chrome-data`.
5. Rosters you import, cookies, and test-site logins in this window survive stopping and restarting `npm run dev`.

Then: click the Corresponding icon → import `fixtures/sample-authors.csv` →
optional **Preview** → **Fill**. Fill always performs a fresh internal preflight
even when the visible Preview step is skipped.

Leave this terminal open while you test.

### Cursor / remote terminal: automated real-browser test

Remote terminals often have no desktop surface, so `npm run dev` may launch a
browser that you cannot see. Use the Playwright MV3 test environment instead:

```bash
npm install
npx playwright install chromium   # once per machine/environment
npm run test:e2e
```

This builds the production extension, verifies its shipped permission boundary,
loads it into an isolated current Chromium profile, intercepts the localhost
fixture without starting another server, and exercises popup → CSV import →
Preview → stale-Preview invalidation → Fill → validate. It also verifies that
submit, certify, copyright, and payment controls remain untouched.

Failure artifacts are written to `playwright-report/` and `test-results/`:

```bash
npm run test:e2e:report
```

On a local desktop, use `npm run test:e2e:headed` to watch the automated browser
or `npm run test:e2e:ui` for Playwright's interactive runner.

The E2E harness copies the production build into ignored `.wxt/` test output and
adds a localhost-only host grant to that copy. This is necessary because a
programmatically opened popup does not receive Chrome's toolbar `activeTab`
gesture. The test fails first if the real production manifest has any host
permission, automatic content script, or permissions beyond `activeTab`,
`storage`, and `scripting`.

### Testing a bioRxiv submission

bioRxiv author-entry filling is capture-backed and fixture-tested. Start on an
empty author table, import the roster, optionally Preview, then Fill. Corresponding
preflights the complete roster and saves one Add Author dialog per author. It
refuses to append when author rows already exist, leaves ORCID authorization
manual, and never clicks `CA_continue`, final submission, certification,
copyright, payment, or legal actions.

An authenticated live bioRxiv workflow still requires a visible local browser.
Use the dedicated WXT profile locally, or load `.output/chrome-mv3` unpacked into
a separate Chrome profile. Do not connect automated tests to a normal Chrome
profile or store portal credentials in the repository.

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
- If port **3000** is already in use, stop the other process (or free the port) before `npm run dev`. Corresponding pins that port so the fixture URL stays stable.
- You may see Chrome launched with `--disable-blink-features=AutomationControlled`. That flag is injected by **web-ext** (not our config) so pages do not treat the debug browser as an automated bot. Leave it alone.

### Manual smoke test (without `npm run dev`)

1. `npm run build` then load `.output/chrome-mv3`.
2. Open `fixtures/nature-mts-sample.html` in Chrome (or serve it locally).
3. Import `fixtures/sample-authors.csv` in the popup (confirm mapping if prompted).
4. Click **Preview**, then **Fill**, then review validation. Confirm submit/certify controls were not touched.

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | WXT dev + Chrome (persistent `.wxt/chrome-data`) opens Nature fixture |
| `npm run build` | Production Chrome MV3 build |
| `npm run test:e2e` | Headless Chromium MV3 popup → Preview → Fill → validate |
| `npm run test:e2e:headed` | Watch the E2E browser on a local desktop |
| `npm run test:e2e:ui` | Open Playwright's interactive local runner |
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

### Manuscript author-table import

### Choosing files

Chrome destroys an extension popup when a native file dialog takes focus, which
silently cancels the import. Dragging a file onto the popup works, and choosing
a file opens `import.html` in a tab, where the dialog is safe. Both paths share
the same local roster storage.

**Upload manuscript (.docx)** parses the Word archive locally and looks only
for a table with separate given-name and family-name columns. The extracted
table uses the same mapping/review flow as spreadsheet paste. Manuscript prose
is not returned by the parser or stored.

Paragraph-style front matter, superscript-only affiliation layouts, PDF, and
OCR intentionally fail closed until anonymized fixtures establish reliable
rules.

## Architecture

- `src/schema` — canonical Author / Roster model (Zod)
- `src/adapters` — platform adapters (`detect` / `inspect` / `fill` / `validate`)
- `src/import` — CSV + column mapping
- `src/roster` — local saved rosters
- `src/sheets` — Google Sheets read-only abstraction (credentials blocked)
- `src/diagnostics` — redacted form probe for new portals (walks same-origin iframes)
- `entrypoints/popup` — React UI
- `docs/` — product, privacy, roadmap, backlog, threat model, release checklist

See `AGENTS.md` for autonomous agent rules.

## Safety

Never automates: final submit, certification, copyright acceptance, COI attestations, payment, signatures, reviewer invitations.

Never stores: passwords, cookies, auth tokens, unrelated browsing history.

## License

Proprietary — all rights reserved (commercial product).
