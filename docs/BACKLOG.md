# Backlog

Status key: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked (external)

## Prior milestones (extension core)

- [x] Scaffold, Nature MTS adapter, CSV import, local rosters, Sheets abstraction, diagnostics, stubs, commercial docs

## Overnight reliability tracks

### Recognition & safety
- [x] A — Generic semantic form recognizer (deterministic, no LLM)
- [x] B — Repeated author-group detection + layout fixtures
- [x] H — Explicit confidence model + fill threshold
- [x] C — Property-based roster stress (fast-check)
- [x] D — DOM chaos harness + `reports/chaos-report.json`
- [x] E — Shared adapter contract suite (Nature MTS opted in)
- [x] F — Compatibility capture + redaction tests
- [x] G — Fixture corpus + replay metrics
- [x] O — Explicit failure states catalog

### Data model & privacy
- [x] I — Identity schema v2 + migrate bridges (v1 adapters unchanged)
- [x] J — Provenance model (never auto-claim external verification)
- [x] M — Local audit trail (operation metadata + aggregate counts, clearable)

### UX / product
- [x] K — Corresponding branding + design tokens + popup hierarchy
- [x] L — UX adversarial review → `docs/UX_BACKLOG.md`
- [x] N — Perf benchmarks with generous thresholds
- [x] P — DX scripts + adapter template + `docs/ADDING_AN_ADAPTER.md`
- [x] Q — Public platform research notes (`docs/PLATFORM_RESEARCH.md`)
- [ ] R — Coverage report review / raise on high-risk gaps (run `npm run test:coverage`)

## Local remaining (not blocked)

- [ ] Fix CSV export/import preservation of apostrophe-prefixed formula-like text
  without weakening spreadsheet injection protection. Repro: input `"'+"`
  round-trips as `"''+"`; randomized invariant seed `-1081049180` (2026-09-11).
- [x] Declarative `sites/*.json` adapters (Nature proven; S1/EM detect-only)
- [x] Public compatibility scoreboard (honest ✅ / ⬜, issue CTA, unlock releases)
- [x] MIT license + no-account / no-trial fill (README hook, locked FREE_ACCESS)
- [x] Compact first-use popup + Import authors (paste/CSV) + read-only review
- [x] Preview result card with mapping breakdown (exact/semantic/…)
- [x] CSV mapping data preview
- [x] Empty-state one-click sample roster import
- [x] Confidence badges per author block in Preview
- [x] Post-fill delight line and local lifetime hours footer (example/test fills excluded)
- [x] Persist last-selected roster id
- [x] Wire audit log to chrome.storage in popup (metadata + counts, clearable)
- [x] Contextual page/field autofill over existing adapters (Shadow DOM, click-to-fill)
- [ ] Optional visual regression for popup tokens
- [ ] Excel parse enablement after dependency decision (`docs/EXCEL_IMPORT.md`)

## External validation (true blockers)

- [!] Google OAuth client ID for Sheets read-only
- [!] Real Nature MTS HTML capture to validate synthetic IDs
- [x] Editorial Manager author-form IDs from PLOS ONE 2026-08-15 console probe (`FirstName` / `LastName` / `Email` in `RequiredRegistrationQuestions.aspx`). Live multi-author Save smoke still pending.
- [x] Real ScholarOne fixture — Bioinformatics Manuscript Central capture (2026-08-14); live smoke still pending.

## Security / quality (post PR #1)

- [x] Clear npm audit CVEs (WXT upgrade)
- [x] Semgrep CE + ESLint security + Gitleaks baseline (0 findings)
- [x] Roster wipe / linked-PID / corr-conflict / diagnostic redaction hardening
- [ ] Optional CodeQL workflow on GitHub (if Advanced Security available)
- [ ] Raise coverage on popup chrome bridges

## Next five highest-value tasks

1. Expand local DOCX import beyond structured author tables using anonymized paragraph/superscript fixtures
2. Decide and enable safe local XLSX parsing
3. eLife fixture investigation (bioRxiv/medRxiv capture-backed adapter complete)
4. Raise coverage on migrate + capture redaction edge cases
5. Add inline “why unresolved” evidence in Preview

## Founder-context opportunities

### Now — highest-value unblocked

1. [x] One-click sample roster from the empty state; prove sample → Preview → Fill → validate.
2. [x] Persist last-selected roster id in local extension storage.
3. [x] Group Preview by author block with exact/semantic/unresolved confidence.
4. [x] Persist the metadata-and-counts audit trail in `chrome.storage.local`; retain clear control and PII refusal.
5. [ ] Enable local XLSX import after a dependency/security decision; reuse explicit column mapping.

### Soon

- [x] bioRxiv/medRxiv redacted capture + repeated-modal adapter and fixture.
- [x] ScholarOne redacted Bioinformatics capture + email-lookup adapter and fixture.
- [ ] eLife public workflow research + redacted compatibility capture plan.
- [!] Implement eLife only after a real anonymized fixture exists.
- [!] Validate and broaden Nature/eJournalPress only from real captured HTML.
- [!] Authenticated live smoke for ScholarOne / Manuscript Central (Bioinformatics).
- [ ] Expand adversarial coverage for popup bridges, provenance, migration, redaction, and 1/75/500/1000-author flows.
- [x] Local DOCX structured author-table extraction with mapping preview and no prose retention.
- [!] Paragraph/superscript DOCX and PDF extraction require anonymized manuscript fixtures.

### Later

- [ ] Corresponding Profile with reusable, provenance-aware scientific identity.
- [ ] Projects/Teams readiness dashboard and collaborator information requests.
- [ ] Lab and institutional synchronization/administration workflows.
- [ ] Publisher APIs/OEM after a meaningful trusted-data network exists.
- [ ] Contribution-aware graph built from workflow-confirmed data.

### Explicitly deferred

- [ ] Public scientist search/recruitment marketplace.
- [ ] Cloud graph database before private workflows earn the data.
- [x] Fill stays radically free: MIT, no account, no trial, no entitlement gate.
- [ ] Speculative AI filling or unconfirmed low-confidence mutation.
- [ ] General frameworks without an immediate tested user workflow.
