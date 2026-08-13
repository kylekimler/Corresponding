# Development Log

Chronological overnight / autonomous iteration log.

---

### 2026-08-13 03:45 UTC
- bioRxiv live follow-up: After one saved author, the portal closes the dialog before remounting its Add control. The orchestrator now waits for the refreshed external action and accepts the observed “Add Another Author” state instead of failing immediately.
- popup: Removed the optional-Preview subtitle entirely.
- manuscript import phase 1: Added local DOCX archive parsing with `fflate`, strict compressed/XML size limits, and deterministic extraction of structured author tables. The parser returns only the selected table; manuscript prose is discarded and never stored.
- fail-closed scope: DOCX tables must expose separate given/family columns. Paragraph front matter, superscript-only layouts, PDF, and OCR remain blocked pending anonymized fixtures.
- tests: Added delayed post-save Add remount coverage, label-variant coverage, DOCX selection among unrelated tables, blank-column preservation, paragraph-layout refusal, malformed archive refusal, and production popup DOCX upload.

### 2026-08-13 02:50 UTC
- copy: Changed the popup purpose line to “Giving scientists more time to do science.” Replaced mandatory-sounding safety copy with optional Preview guidance.
- direct Fill: Fill no longer requires a user-triggered Preview. It reuses a matching clean Preview when available; otherwise it performs a fresh internal dry-run bound to the current roster/version, overwrite setting, and tab before any mutation. Blocking adapter errors still stop Fill.
- sample UX: Development sample rosters now expose a prominent one-click removal control instead of appearing permanently stuck in local storage.
- discovery: Added local DOCX front-matter author/affiliation extraction to the backlog for fixture-first assessment; no manuscript parser was introduced without evidence.
- verification: 185 Vitest tests, typecheck, production build, zero-warning security lint, and all three Playwright MV3 journeys passed. Nature exercises visible Preview invalidation followed by direct Fill; bioRxiv exercises direct Fill with internal preflight.

### 2026-08-13 02:40 UTC
- bug: Spreadsheet paste used `trim()`, which removed a leading tab from an unlabeled header column but not from following rows. Wide Google Sheets data shifted one column right, produced incorrect mappings (for example publication name as ORCID), then failed import validation without surfacing the rejected promise.
- fix: Preserve leading/trailing tab structure, keep blank headers as Ignore, and catch mapping-import validation failures beside the Import action.
- schema/import: Added optional project-level `fundingStatements` and `disclosureStatements` to rosters and identity-v2 round trips. Support/Funding and Conflicts/Competing Interests columns map explicitly instead of false-matching author state.
- UX: Read-only roster review summarizes imported project statements. Adapters do not fill them until portal fixtures prove the corresponding fields, and no certification/attestation is automated.
- tests: Added the reported leading-blank-column shape, project metadata mapping/deduplication, identity migration preservation, and production popup E2E coverage.
- verification: 185 Vitest tests, typecheck, production build, zero-warning security lint, and all three Playwright MV3 journeys passed.

### 2026-08-13 02:30 UTC
- branding: Added a “Corr” extension icon using the popup's mint, cream, parchment, and pale-sage gradient with dark forest serif lettering.
- assets: Retained 1024px source artwork under `assets/brand`; generated Lanczos-resized Chrome icons at 16/32/48/128px and wired both extension and toolbar manifest icons.
- verification: Production build ships all four icon sizes; 183 Vitest tests, typecheck, zero-warning security lint, and all three Playwright MV3 journeys passed. Permissions remain `activeTab`, `storage`, and `scripting`.

### 2026-08-13 02:20 UTC
- bug: Extension reload/update could leave a popup promise with an undefined or malformed tab response, and an anonymous popup path still read `.type` directly.
- fix: Every popup request now normalizes responses again at the component boundary; response envelopes require their expected payload; interrupted update messaging becomes a user-facing reconnect instruction. Diagnostic capture now catches rejected browser calls instead of producing an unhandled promise.
- tests: Added undefined, null, missing-type, missing-result, and malformed-error response coverage.
- verification: 183 Vitest tests, typecheck, production build, zero-warning security lint, and all three Playwright MV3 journeys passed.

### 2026-08-13 02:10 UTC
- evidence: Reviewed redacted bioRxiv author-page captures with the repeated editor closed/open plus values-free visibility/ancestry output. Confirmed the active Vuetify dialog, stable field names/labels, external Add Author, dialog Save, empty author table, and page-level `CA_continue`.
- adapter: Added `biorxiv` detection, dry Preview, complete-roster preflight, and an asynchronous one-dialog-per-author Fill orchestrator. It refuses to append when author rows already exist, requires names/email/institution before mutation, preserves an already-open first dialog, and never automates ORCID authorization.
- safety: All submit-type controls are now forbidden regardless of label. `CA_continue` is detected but never clicked. The popup blocks Fill when Preview reports adapter errors.
- fixtures/tests: Added capture-derived unit and browser fixtures covering closed/open dialogs, multi-author order, corresponding status, existing-author refusal, missing-data refusal, validation, and zero page-continuation clicks.
- verification: 182 Vitest tests, typecheck, production build, zero-warning security lint, and three Playwright MV3 journeys passed, including production popup → bioRxiv Preview → three modal saves → validation with zero `CA_continue` clicks.
- status: First authenticated live bioRxiv smoke remains required before claiming live validation.

### 2026-08-13 01:30 UTC
- import reliability: Reproduced the supplied HGCA workbook's 17-column header shape. Unknown, ambiguous, duplicate-affiliation, and administrative columns now default to Ignore; required name columns remain detected. Mapping updates use functional state so a final selection cannot be lost before Import.
- interaction feedback: Preview/Fill show working labels, busy states, and tactile button response. Inline input/action errors use a brief low-intensity red pulse with reduced-motion support.
- example fixture: Removed the deliberately linked second-author PID from the default Nature demo so the ordinary three-author example is a successful fill; linked-account refusal remains covered by dedicated adapter/security tests.
- workflow simplification: Replaced roster CRUD/edit/export controls with a read-only imported-author review and issue summary. Source corrections happen in the spreadsheet followed by re-import.
- Sheets: Made clipboard import explicitly Google Sheets/Excel friendly. Configured builds now support read-only Google Sheet URL import through Chrome Identity; unconfigured builds retain the three-permission/no-host-permission manifest and direct users to private clipboard paste.
- bioRxiv intake: Added reviewed capture download, an unsupported-portal capture entry point, and two-state instructions for the author page plus empty repeated-author dialog. No selectors were guessed without the captures.
- verification: 175 Vitest tests, typecheck, production build, zero-warning security lint, and two Playwright MV3 journeys passed. Default manifest remains `activeTab`/`storage`/`scripting` with no host permissions; a dummy configured build added only `identity`, `https://sheets.googleapis.com/*`, and `spreadsheets.readonly`.

### 2026-08-13 01:00 UTC
- changed: Added an official Playwright MV3 end-to-end environment for remote Cursor terminals. It launches current bundled Chromium with an isolated persistent context, loads a test copy of the production extension, and intercepts the pinned localhost fixture without another server.
- safety gate: E2E setup rejects production manifests with host permissions, automatic content scripts, or permissions beyond `activeTab`, `storage`, and `scripting`. Only the ignored `.wxt/` test copy receives a localhost host grant because programmatic popup tabs do not receive a toolbar `activeTab` gesture.
- browser journey: Production popup imports CSV, proves Preview is dry, proves overwrite changes invalidate Preview, fills only safe author blocks, validates the linked conflict, and confirms submit/certify/copyright/payment controls were never clicked.
- developer experience: `test:e2e`, headed, UI, and report scripts; retained trace/screenshot/video on failure; README guidance for remote testing and safe bioRxiv compatibility capture.
- verification: Playwright 1.62.1 with Chrome for Testing 151; E2E passed. Typecheck, 173 Vitest tests, production build, and lint passed.

### 2026-08-12 23:20 UTC
- changed: Bound every successful Preview to roster ID + `updatedAt`, overwrite setting, and the active tab ID + URL. Fill stays disabled for stale/missing Preview state, and the bridge rechecks the expected tab immediately before sending a mutating request.
- UX: Sample onboarding is development-build only; selector confidence is shown separately from block completeness; every author block remains inspectable in a bounded scroll region; action errors now appear beside Preview/Fill in an accessible live region.
- correctness/privacy: Validation transport errors no longer read as successful validation. Local activity copy now accurately names stored timestamp, operation, portal family, roster ID, and aggregate counts.
- tests added: stale roster/version/setting/tab Preview checks, expected-tab enforcement including a pre-send tab switch, and exact-selector/incomplete-block separation.
- verification: typecheck, 173 tests, production build, and lint passed. Production manifest contains only `activeTab`, `storage`, and `scripting`, with no host permissions or content-script registration. Fresh WXT browser used `.wxt/chrome-data` and opened the pinned fixture; detection, sample load, dry Preview, Fill, validation, confidence/completeness, and protected-control checks passed. The fixture's linked/conflicting Alan Turing block was intentionally preserved while the two safe blocks filled.

### 2026-08-12 16:20 UTC
- commits: `0d284b0` founder context and strategic backlog alignment; `9770509` one-click sample roster
- changed: Added `docs/FOUNDER_CONTEXT.md`; made it required reading in `AGENTS.md`; aligned product/privacy naming; added Now/Soon/Later/Explicitly deferred opportunities to roadmap and backlog without removing existing tasks.
- architecture review: Current local-first canonical schema, deterministic adapter interface, confidence hierarchy, dry-run, and validation align with founder direction. No large redesign needed.
- user-visible: Empty state now offers “Try a sample roster”; creates three canonical example authors, saves/selects locally, and leads directly to Preview → Fill → validate on the synthetic Nature fixture.
- tests: canonical sample/storage/fresh-ID coverage; first-use sample journey proves Preview does not mutate, then Fill and validation succeed; full suite 155 passed, typecheck and build passed.
- follow-up commits: `163fba4` persists the selected roster in local extension storage; `3cc1990` tightens storage-backend typing.
- repeated-use workflow: reopening the popup restores a valid remembered roster, falls back safely after deletion, and clears the preference when no rosters remain.
- Preview commit: `7e6a96d` groups mappings by author sequence and shows Exact/tested, Semantic, or Unresolved badges plus missing/conflict counts. Exact classification is platform-scoped to tested Nature IDs.
- audit commit: `28f0521` switches the popup from memory-only to local `chrome.storage.local` activity metadata and aggregate counts; records Preview and Fill separately, refuses PII-like entries, caps at 200, and exposes a clear control under Advanced. Audit failure cannot break Preview/Fill.
- adversarial/privacy follow-up: `9a96b08` marks sample rosters explicitly, requires successful Preview, blocks sample Fill outside the pinned localhost Nature fixture, adds an atomic double-click guard, and treats optional ORCID as advisory rather than “not ready.”
- quality follow-up: `6007eae` preserves the caught injection error cause, clearing the inherited ESLint failure.
- verification: preference, Preview confidence, persistent audit, sample safety, double-click, and fixture-URL tests; full suite 163 passed; typecheck, build, and lint passed.
- next: Hands-on browser smoke review, then safe XLSX dependency decision or bioRxiv/eLife fixture investigation.

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
