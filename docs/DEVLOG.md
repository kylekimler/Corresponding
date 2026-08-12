# Development Log

Chronological overnight / autonomous iteration log.

---

### 2026-08-12 16:20 UTC
- commits: `0d284b0` founder context and strategic backlog alignment; `9770509` one-click sample roster
- changed: Added `docs/FOUNDER_CONTEXT.md`; made it required reading in `AGENTS.md`; aligned product/privacy naming; added Now/Soon/Later/Explicitly deferred opportunities to roadmap and backlog without removing existing tasks.
- architecture review: Current local-first canonical schema, deterministic adapter interface, confidence hierarchy, dry-run, and validation align with founder direction. No large redesign needed.
- user-visible: Empty state now offers “Try a sample roster”; creates three canonical example authors, saves/selects locally, and leads directly to Preview → Fill → validate on the synthetic Nature fixture.
- tests: canonical sample/storage/fresh-ID coverage; first-use sample journey proves Preview does not mutate, then Fill and validation succeed; full suite 155 passed, typecheck and build passed.
- follow-up commits: `163fba4` persists the selected roster in local extension storage; `3cc1990` tightens storage-backend typing.
- repeated-use workflow: reopening the popup restores a valid remembered roster, falls back safely after deletion, and clears the preference when no rosters remain.
- verification: preference unit tests + full suite 158 passed, typecheck and build passed.
- next: Add author-block Preview confidence.

### 2026-08-12 16:15 UTC
- commit: `c7e2fdc` `npm run dev` opens Nature fixture via `webExt.startUrls`
- changed: Pin WXT Vite port 3000 (`strictPort`); Vite middleware serves `fixtures/` at `/fixtures/*` on the existing server; `webExt.startUrls` → `http://localhost:3000/fixtures/nature-mts-sample.html`. Document that `--disable-blink-features=AutomationControlled` comes from web-ext (not our chromiumArgs). No production permission changes; no second server.
- tests: typecheck, suite, build; verify Chrome opens fixture URL + `--load-extension=...chrome-mv3-dev`.
- next: Kyle Preview/Fill against auto-opened fixture.

### 2026-08-12 16:00 UTC
- commit: `898e41d` persistent Chromium profile for `npm run dev`
- changed: `wxt.config.ts` `webExt.chromiumArgs` → `--user-data-dir=./.wxt/chrome-data` (official WXT Mac/Linux pattern). Added `web-ext` **10.6.0** as a devDependency so WXT auto-opens Chrome (without it, WXT falls back to “load unpacked manually”). README “Kyle's testing workflow”. `.wxt` already gitignored; no extension permission changes.
- verified: first `npm run dev` created `.wxt/chrome-data` + Default/Cookies; after Ctrl+C and second `npm run dev`, marker file + Cookies inode unchanged; Chrome cmdline includes `--user-data-dir=./.wxt/chrome-data`.
- audit note: `npm audit --omit=dev` stays clean; full `npm audit` may report `web-ext` → `addons-linter` → `image-size` highs (dev-only launcher).
- tests: typecheck, full suite, build.
- next: Kyle day-to-day testing against Nature MTS with surviving rosters/cookies.

### 2026-08-12 15:30 UTC
- commit: `8283484` popup crash fix — `Cannot read properties of undefined (reading 'type')`
- changed: `sendToActiveTab` now always returns a typed `ExtensionResponse`. Chrome `tabs.sendMessage` can resolve to `undefined` when the content script does not reply; callers were reading `res.type` and crashing the popup on load (DETECT). Added `normalizeTabResponse`, safer ensure/inject/retry, unit tests.
- tests: tabBridge unit tests + full suite.
- next: User must rebuild (`.output/chrome-mv3`) and reload the unpacked extension; stale builds still show old tagline/Sheets OAuth UI.

### 2026-08-12 15:20 UTC
- commit: `b4f1200` (harmonize merge of PR #2 + PR #3 into main)
- changed: Merged security hardening (Semgrep/ESLint, roster quarantine, linked-PID/corr conflicts, diagnostic redaction, CSV formula escape, message Zod, WXT audit fix) with first-use UX (compact popup, Preview results, paste/CSV import, Manage roster, Sheets/Excel architecture).
- tests: full suite after merge.
- next: Persist selected roster; sample import; live Sheets when credentials arrive.

### 2026-08-12 15:15 UTC
- commit: `6253f5261fb6700c2b07d9897eb14691fdc87556`
- changed: First-use UX — compact main popup; Preview result card (exact/semantic/preserved/unresolved/conflicts) with dry-run safety; detection error recovery; Manage roster secondary view; unified Import authors (paste TSV, CSV drag-drop, Excel stub, Sheets “Choose Google Sheet” coming-soon); attention-first author list; Advanced diagnostics; Sheets/Excel architecture docs. No package dependency changes.
- tests: `npm test` (128 passed), `npm run typecheck`, `npm run build`. New: pasteTable, previewSummary, authorAttention, fileKinds, first-use journey (3/75/500).
- limitations: Excel parse deferred (docs/EXCEL_IMPORT.md); Google Picker + OAuth credentials still blocked for live Sheets; no sample-roster one-click yet.
- next: Persist selected roster; sample import; live Sheets when credentials arrive.

### 2026-08-12 15:00 UTC
- commit: `c2aad211eb6bd5ce1fc0aea124ba8d330aec6a02`
- tooling decision: **Semgrep CE** as primary OSS SAST (`p/javascript`, `p/typescript`, `p/security-audit`) + **ESLint eslint-plugin-security** for IDE/CI + **npm audit** for deps + **Gitleaks** for secrets. CodeQL deferred (needs GH Advanced Security workflow); Snyk/Sonar commercial skipped.
- changed: WXT `0.19.29` → `0.21.4` (clears npm audit CVEs). Hardening: roster storage no longer silent-wipes invalid docs (salvage + durable quarantine key); linked-PID conflict when roster email missing or portal identity blank; corresponding block skips on contrib conflict; inspect strips field values; safety normalizes snake_case (`final_submit`); diagnostic label/option/URL hash/userinfo redaction with fail-closed `redactionComplete` + UI export block; CSV formula neutralization + import denature; Zod validation of extension messages; Sheets API errors sanitized; skip disabled/readOnly fields; safer country select matching; inject only http(s) tabs.
- tests: `npm test` (126 passed), `npm run typecheck`, `npm run build`, `npm audit` (0), `npm run lint:security` (0), `npm run semgrep` (0 findings), gitleaks (no leaks).
- next: wire audit log to chrome.storage; empty-state sample roster; live Nature MTS HTML when available.

### 2026-08-12 04:28 UTC
- commit: `aa054cb924ee04dd6f32258dcbc128c5639d0745`
- changed: Greenfield scaffold of journal-autofill as WXT + React + TS MV3 extension; canonical Zod author schema; adapter interface + Nature MTS adapter with synthetic fixture; CSV import + column mapping; local roster storage; Google Sheets read-only abstraction/mocks; diagnostics probe; adapter registry + stubs; popup Preview/Fill UX; commercial docs (privacy, threat model, CWS permissions, release checklist, Sheets setup). Manifest ships without automatic `content_scripts` (activeTab inject only).
- tests: `npm test` (37 passed), `npm run typecheck`, `npm run build` → `.output/chrome-mv3` with permissions `activeTab`, `storage`, `scripting` only.
- limitations: Nature MTS based on observed IDs (synthetic fixture, not live HTML); Google OAuth credentials unavailable; popup roster CRUD UI incomplete (storage API ready); Sheets UI not yet in popup.
- next: Popup roster management UI; Sheets import UI over mocks; real Nature MTS HTML fixture from Kyle.

### 2026-08-12 04:31 UTC
- commit: `762d98d42802ccc9236420dc193c2cea82206515`
- changed: Popup roster CRUD (create/rename/duplicate/delete/export JSON|CSV, author edit/reorder); Sheets import flow + popup UI gated on OAuth config; local HTML/CSV fixtures; `docs/BLOCKERS.md`; richer preview conflict/missing lists.
- tests: `npm test` (44 passed), `npm run typecheck`, `npm run build`.
- limitations: Sheets still blocked without Kyle OAuth credentials; Nature MTS still synthetic; no live portal validation.
- next: OAuth credentials; live Nature MTS HTML; portal diagnostic captures for ScholarOne/EM.

### 2026-08-12 04:32 UTC
- commit: `d2d1e82495c714fff4d111f8bf6c4e07b8dba231`
- changed: ORCID normalization on import/edit; add/remove author rows in popup; mutation tests.
- tests: `npm test` (48 passed), `npm run typecheck`, `npm run build`.
- limitations: Further reliable portal adapters blocked on real DOM fixtures and OAuth credentials from Kyle.
- next: Stop on external blockers; Kyle provides OAuth + live HTML captures.

### 2026-08-12 05:30 UTC
- changed: Identity schema v2 (`identityV2.ts`) with optional expansions; v1↔v2 migration bridges (`migrate.ts`); provenance model; local-only audit log (`audit/localLog.ts`) with PII redaction invariants; schema/audit tests.
- tests: `npm test` (112 passed), `npm run typecheck`.
- next: Wire audit log into fill flow; optional v2 import/export in popup.

### 2026-08-12 05:35 UTC
- commit: `e04b18dd433c69461ace7bb1b01f95ae54a44b7e`
- changed: Overnight reliability build — semantic recognition + confidence hierarchy; author-group detection; fast-check property tests; DOM chaos harness; adapter contract suite; compatibility capture/redaction; fixture corpus replay; identity v2 + provenance; local audit trail; failure states; Corresponding branding/UX tokens; perf benchmarks; platform research; DX scripts/template; coverage report.
- tests: `npm test` (106 passed), `npm run typecheck`, `npm run build`, `npm run test:coverage`.
- reports: chaos 40/40 correct unsafe=0; fixture replay detection/mapping/unsupported pass rate 1.0; perf 10→1000 authors within thresholds.
- limitations: External OAuth + live portal fixtures still required for Sheets and new adapters; popup UI largely untested by unit coverage.
- next: First-run empty-state UX; Preview confidence badges; raise coverage on chromeClient/popup.
