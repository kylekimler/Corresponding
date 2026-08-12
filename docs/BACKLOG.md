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
- [x] M — Local audit trail (counts only, clearable)

### UX / product
- [x] K — Corresponding branding + design tokens + popup hierarchy
- [x] L — UX adversarial review → `docs/UX_BACKLOG.md`
- [x] N — Perf benchmarks with generous thresholds
- [x] P — DX scripts + adapter template + `docs/ADDING_AN_ADAPTER.md`
- [x] Q — Public platform research notes (`docs/PLATFORM_RESEARCH.md`)
- [ ] R — Coverage report review / raise on high-risk gaps (run `npm run test:coverage`)

## Local remaining (not blocked)

- [x] Compact first-use popup + Import authors (paste/CSV) + Manage roster
- [x] Preview result card with mapping breakdown (exact/semantic/…)
- [x] CSV mapping data preview
- [x] Empty-state one-click sample roster import
- [ ] Confidence badges per author block in Preview
- [x] Persist last-selected roster id
- [ ] Wire audit log to chrome.storage in popup (memory log exists)
- [ ] Optional visual regression for popup tokens
- [ ] Excel parse enablement after dependency decision (`docs/EXCEL_IMPORT.md`)

## External validation (true blockers)

- [!] Google OAuth client ID for Sheets read-only
- [!] Real Nature MTS HTML capture to validate synthetic IDs
- [!] Real ScholarOne / Editorial Manager fixtures before selectors

## Security / quality (post PR #1)

- [x] Clear npm audit CVEs (WXT upgrade)
- [x] Semgrep CE + ESLint security + Gitleaks baseline (0 findings)
- [x] Roster wipe / linked-PID / corr-conflict / diagnostic redaction hardening
- [ ] Optional CodeQL workflow on GitHub (if Advanced Security available)
- [ ] Raise coverage on popup chrome bridges

## Next five highest-value tasks

1. Preview confidence badges (exact / semantic / unresolved)
2. Wire counts-only audit log to local extension storage
3. Decide and enable safe local XLSX parsing
4. bioRxiv/medRxiv + eLife fixture investigation (no selectors without evidence)
5. Raise coverage on migrate + capture redaction edge cases

## Founder-context opportunities

### Now — highest-value unblocked

1. [x] One-click sample roster from the empty state; prove sample → Preview → Fill → validate.
2. [x] Persist last-selected roster id in local extension storage.
3. [ ] Group Preview by author block with exact/structural/semantic/unresolved confidence.
4. [ ] Persist the counts-only audit trail in `chrome.storage.local`; retain clear control and PII refusal.
5. [ ] Enable local XLSX import after a dependency/security decision; reuse explicit column mapping.

### Soon

- [ ] bioRxiv/medRxiv public workflow research + redacted compatibility capture plan.
- [ ] eLife public workflow research + redacted compatibility capture plan.
- [!] Implement those adapters only after real anonymized fixtures exist.
- [!] Validate and broaden Nature/eJournalPress only from real captured HTML.
- [ ] Expand adversarial coverage for popup bridges, provenance, migration, redaction, and 1/75/500/1000-author flows.

### Later

- [ ] Corresponding Profile with reusable, provenance-aware scientific identity.
- [ ] Projects/Teams readiness dashboard and collaborator information requests.
- [ ] Lab and institutional synchronization/administration workflows.
- [ ] Publisher APIs/OEM after a meaningful trusted-data network exists.
- [ ] Contribution-aware graph built from workflow-confirmed data.

### Explicitly deferred

- [ ] Public scientist search/recruitment marketplace.
- [ ] Cloud graph database before private workflows earn the data.
- [ ] Elaborate billing or entitlement infrastructure.
- [ ] Speculative AI filling or unconfirmed low-confidence mutation.
- [ ] General frameworks without an immediate tested user workflow.
