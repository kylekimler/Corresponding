# Development Log

Chronological overnight / autonomous iteration log.

---

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
